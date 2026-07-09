/**
 * Route serveur — Gestion des utilisateurs (Archive PMN)
 *
 * POST /api/users  { action, ... }  — create | resend-access | send-message
 * GET  /api/users  — état de configuration des canaux (email/SMS)
 *
 * 🔐 SÉCURITÉ : opérations privilégiées (Master Key) exécutées UNIQUEMENT ici.
 * L'appelant est vérifié admin via son session token. Aucune clé exposée.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    verifyAdmin,
    createParseUser,
    updateParseUser,
    getParseUser,
    emailExists,
    masterKeyConfigured,
} from '@/lib/server/parse-admin';
import {
    sendEmail,
    sendSMS,
    emailConfigured,
    smsConfigured,
    accessEmailHtml,
    accessSmsText,
    messageEmailHtml,
    generateTempPassword,
} from '@/lib/server/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSessionToken(req: NextRequest): string | undefined {
    return req.cookies.get('parse-session-token')?.value;
}

// GET — statut des canaux (pour activer/désactiver l'option SMS côté UI)
export async function GET() {
    return NextResponse.json({
        email: emailConfigured(),
        sms: smsConfigured(),
        masterKey: masterKeyConfigured(),
    });
}

export async function POST(req: NextRequest) {
    // 1. Authentification admin
    const admin = await verifyAdmin(getSessionToken(req));
    if (!admin) {
        return NextResponse.json({ error: 'Accès réservé aux administrateurs.' }, { status: 403 });
    }
    if (!masterKeyConfigured()) {
        return NextResponse.json({ error: 'Configuration serveur incomplète (Master Key absente).' }, { status: 503 });
    }

    const body = await req.json().catch(() => null);
    const action = body?.action;

    try {
        // ============ Créer un utilisateur + envoyer les accès ============
        if (action === 'create') {
            const { firstName, lastName, email, fonction, section, role, telephone, service, channel } = body;
            const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
            const emailNorm = String(email || '').toLowerCase().trim();

            if (!fullName) return NextResponse.json({ error: 'Nom complet requis.' }, { status: 400 });
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) return NextResponse.json({ error: 'E-mail invalide.' }, { status: 400 });
            if (channel === 'sms' && !telephone) return NextResponse.json({ error: 'Téléphone requis pour l\'envoi par SMS.' }, { status: 400 });

            if (await emailExists(emailNorm)) {
                return NextResponse.json({ error: 'Un compte existe déjà avec cet e-mail.' }, { status: 409 });
            }

            const tempPassword = generateTempPassword();
            const created = await createParseUser({
                username: emailNorm,
                email: emailNorm,
                password: tempPassword,
                full_name: fullName,
                fullName: fullName,
                role: role || 'user',
                fonction: fonction || undefined,
                assigned_zone: section || undefined,
                telephone: telephone || undefined,
                service: service || undefined,
                is_active: true,
                is_verified: true,
                must_change_password: true,
                notify_channel: channel === 'sms' ? 'sms' : 'email',
            });
            if (!created.ok) {
                return NextResponse.json({ error: created.error || 'Création impossible.' }, { status: 502 });
            }

            // Envoi des accès par le canal choisi
            const sent = await deliverAccess(channel, { fullName, email: emailNorm, tempPassword, telephone });
            return NextResponse.json({
                ok: true,
                userId: created.id,
                delivery: sent,
            });
        }

        // ============ Renvoyer les accès (nouveau mot de passe temporaire) ============
        if (action === 'resend-access') {
            const { userId, channel } = body;
            const user = await getParseUser(userId);
            if (!user) return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 });

            const tempPassword = generateTempPassword();
            const upd = await updateParseUser(userId, { password: tempPassword, must_change_password: true });
            if (!upd.ok) return NextResponse.json({ error: upd.error || 'Mise à jour impossible.' }, { status: 502 });

            const sent = await deliverAccess(channel || user.notify_channel, {
                fullName: user.full_name || user.email,
                email: user.email,
                tempPassword,
                telephone: user.telephone,
            });
            return NextResponse.json({ ok: true, delivery: sent });
        }

        // ============ Envoyer un message (e-mail / SMS) ============
        if (action === 'send-message') {
            const { userId, channel, subject, message } = body;
            const user = await getParseUser(userId);
            if (!user) return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 });
            if (!message?.trim()) return NextResponse.json({ error: 'Message vide.' }, { status: 400 });

            let ok = false;
            if (channel === 'sms') {
                if (!smsConfigured()) return NextResponse.json({ error: 'SMS non configuré.' }, { status: 503 });
                if (!user.telephone) return NextResponse.json({ error: 'Cet utilisateur n\'a pas de téléphone.' }, { status: 400 });
                ok = await sendSMS(user.telephone, message.trim());
            } else {
                if (!emailConfigured()) return NextResponse.json({ error: 'E-mail non configuré.' }, { status: 503 });
                ok = await sendEmail(
                    user.email,
                    subject?.trim() || 'Message — Archive PMN',
                    messageEmailHtml({ subject: subject || '', body: message.trim(), fromName: admin.full_name || 'Administration' })
                );
            }
            return NextResponse.json({ ok, delivered: ok });
        }

        // ============ Modifier un utilisateur ============
        if (action === 'update') {
            const { userId, fields } = body;
            if (!userId || !fields || typeof fields !== 'object') {
                return NextResponse.json({ error: 'Paramètres invalides.' }, { status: 400 });
            }
            // Liste blanche des champs modifiables (jamais le mot de passe ici)
            const allowed = ['full_name', 'fullName', 'role', 'fonction', 'assigned_zone', 'telephone', 'service', 'is_active', 'notify_channel'];
            const payload: Record<string, any> = {};
            for (const k of allowed) if (k in fields) payload[k] = fields[k];
            if (fields.full_name) payload.fullName = fields.full_name;
            const upd = await updateParseUser(userId, payload);
            if (!upd.ok) return NextResponse.json({ error: upd.error || 'Mise à jour impossible.' }, { status: 502 });
            return NextResponse.json({ ok: true });
        }

        // ============ Activer / Désactiver ============
        if (action === 'set-active') {
            const { userId, active } = body;
            const upd = await updateParseUser(userId, { is_active: Boolean(active) });
            if (!upd.ok) return NextResponse.json({ error: upd.error || 'Mise à jour impossible.' }, { status: 502 });
            return NextResponse.json({ ok: true });
        }

        // ============ Supprimer ============
        if (action === 'delete') {
            const { userId } = body;
            if (userId === admin.objectId) {
                return NextResponse.json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' }, { status: 400 });
            }
            const res = await fetch(`${process.env.NEXT_PUBLIC_PARSE_SERVER_URL}/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'X-Parse-Application-Id': process.env.NEXT_PUBLIC_PARSE_APP_ID || '',
                    'X-Parse-Master-Key': process.env.PARSE_MASTER_KEY || '',
                },
            });
            if (!res.ok) return NextResponse.json({ error: `Suppression impossible (HTTP ${res.status}).` }, { status: 502 });
            return NextResponse.json({ ok: true });
        }

        return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
    } catch (e: any) {
        console.error('[api/users] erreur:', e?.message);
        return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
    }
}

// Envoi des accès par le canal choisi ; repli propre si canal indisponible.
async function deliverAccess(
    channel: string | undefined,
    p: { fullName: string; email: string; tempPassword: string; telephone?: string }
): Promise<{ channel: string; sent: boolean; reason?: string }> {
    if (channel === 'sms') {
        if (!smsConfigured()) return { channel: 'sms', sent: false, reason: 'not_configured' };
        if (!p.telephone) return { channel: 'sms', sent: false, reason: 'no_phone' };
        const sent = await sendSMS(p.telephone, accessSmsText({ email: p.email, tempPassword: p.tempPassword }));
        return { channel: 'sms', sent };
    }
    // e-mail par défaut
    if (!emailConfigured()) return { channel: 'email', sent: false, reason: 'not_configured' };
    const sent = await sendEmail(p.email, 'Vos accès — Archive PMN', accessEmailHtml(p));
    return { channel: 'email', sent };
}
