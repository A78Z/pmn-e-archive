/**
 * Couche d'envoi serveur — Archive PMN (e-mail + SMS)
 *
 * ⚠️ SERVEUR UNIQUEMENT (importé par des Route Handlers Node). Les clés
 * (RESEND_API_KEY, SMS_API_KEY…) ne doivent JAMAIS être exposées au client
 * (jamais NEXT_PUBLIC_), jamais journalisées en clair.
 *
 * - E-mail : Resend (REST) — même fournisseur que le projet INP.
 * - SMS : adaptateur générique configurable par variables d'environnement.
 *   Si non configuré, `smsConfigured()` renvoie false et l'UI désactive
 *   proprement l'option SMS (aucune simulation d'envoi).
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Archive PMN <onboarding@resend.dev>';

// Adaptateur SMS générique : POST JSON { to, message } vers SMS_API_URL,
// avec clé en en-tête Bearer. Compatible avec la plupart des passerelles HTTP.
const SMS_API_URL = process.env.SMS_API_URL;
const SMS_API_KEY = process.env.SMS_API_KEY;
const SMS_SENDER = process.env.SMS_SENDER || 'ArchivePMN';

export function emailConfigured(): boolean {
    return Boolean(RESEND_API_KEY);
}

export function smsConfigured(): boolean {
    return Boolean(SMS_API_URL && SMS_API_KEY);
}

/** Envoi d'un e-mail via Resend (REST). Échecs non bloquants (retourne false). */
export async function sendEmail(to: string | string[], subject: string, html: string): Promise<boolean> {
    if (!RESEND_API_KEY) return false;
    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({ from: RESEND_FROM_EMAIL, to, subject, html }),
            cache: 'no-store',
        });
        if (!res.ok) {
            const detail = await res.text().catch(() => '');
            console.error(`[notify:email] échec HTTP ${res.status}: ${detail.slice(0, 200)}`);
        }
        return res.ok;
    } catch (e: any) {
        console.error('[notify:email] erreur:', e?.message);
        return false;
    }
}

/** Envoi d'un SMS via la passerelle configurée. Retourne false si non configuré. */
export async function sendSMS(to: string, message: string): Promise<boolean> {
    if (!smsConfigured()) return false;
    try {
        const res = await fetch(SMS_API_URL as string, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${SMS_API_KEY}`,
            },
            body: JSON.stringify({ to, from: SMS_SENDER, message }),
            cache: 'no-store',
        });
        if (!res.ok) {
            const detail = await res.text().catch(() => '');
            console.error(`[notify:sms] échec HTTP ${res.status}: ${detail.slice(0, 200)}`);
        }
        return res.ok;
    } catch (e: any) {
        console.error('[notify:sms] erreur:', e?.message);
        return false;
    }
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://pmn-e-archive.vercel.app';

/** Gabarit e-mail d'accès (charte Archive PMN vert/or). */
export function accessEmailHtml(params: {
    fullName: string;
    email: string;
    tempPassword: string;
}): string {
    const { fullName, email, tempPassword } = params;
    return `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#16231E;line-height:1.6;max-width:560px;margin:auto">
    <div style="background:linear-gradient(135deg,#15654B,#0E3B2E);color:#fff;padding:20px 24px;border-radius:12px 12px 0 0">
      <h2 style="margin:0;font-size:20px">Archive PMN</h2>
      <p style="margin:4px 0 0;color:#E4B429;font-weight:600;font-size:13px">Plateforme numérique du Mobilier National</p>
    </div>
    <div style="border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;padding:24px">
      <p>Bonjour <strong>${escapeHtml(fullName)}</strong>,</p>
      <p>Un compte vous a été créé sur la plateforme d'archivage <strong>Archive PMN</strong>. Voici vos accès :</p>
      <table style="border-collapse:collapse;width:100%;margin:16px 0;background:#F6F5F0;border-radius:8px">
        <tr><td style="padding:10px 14px;color:#66746E">Identifiant</td><td style="padding:10px 14px"><strong>${escapeHtml(email)}</strong></td></tr>
        <tr><td style="padding:10px 14px;color:#66746E">Mot de passe temporaire</td><td style="padding:10px 14px"><strong style="font-family:monospace">${escapeHtml(tempPassword)}</strong></td></tr>
      </table>
      <p style="background:#FBF3D9;border:1px solid #E4B429;border-radius:8px;padding:10px 14px;font-size:14px">
        🔒 Pour votre sécurité, vous devrez <strong>changer ce mot de passe</strong> à votre première connexion.
      </p>
      <p style="margin:20px 0">
        <a href="${SITE_URL}/login" style="display:inline-block;background:#15654B;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600">Se connecter</a>
      </p>
      <p style="color:#93A099;font-size:12px;margin-top:24px">${SITE_URL}</p>
    </div>
  </div>`;
}

/** Message SMS d'accès (court). */
export function accessSmsText(params: { email: string; tempPassword: string }): string {
    return `Archive PMN — Vos acces : identifiant ${params.email}, mot de passe temporaire ${params.tempPassword}. Changez-le a la 1re connexion. ${SITE_URL}/login`;
}

/** Gabarit e-mail « message » (envoi libre depuis l'admin). */
export function messageEmailHtml(params: { subject: string; body: string; fromName: string }): string {
    return `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#16231E;line-height:1.6;max-width:560px;margin:auto">
    <div style="background:linear-gradient(135deg,#15654B,#0E3B2E);color:#fff;padding:18px 24px;border-radius:12px 12px 0 0">
      <h2 style="margin:0;font-size:18px">Archive PMN</h2>
    </div>
    <div style="border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px;padding:24px">
      <p style="white-space:pre-wrap">${escapeHtml(params.body)}</p>
      <p style="color:#93A099;font-size:12px;margin-top:20px">Message envoyé par ${escapeHtml(params.fromName)} via Archive PMN.</p>
    </div>
  </div>`;
}

function escapeHtml(s: string): string {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Génère un mot de passe temporaire lisible (12 caractères). */
export function generateTempPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const bytes = new Uint8Array(12);
    (globalThis.crypto || require('crypto').webcrypto).getRandomValues(bytes);
    let out = '';
    for (let i = 0; i < bytes.length; i++) out += chars[bytes[i] % chars.length];
    // garantir au moins un chiffre
    return out.slice(0, 10) + (bytes[10] % 10) + (bytes[11] % 10);
}
