/**
 * Opérations Parse côté SERVEUR (master key) — Archive PMN
 *
 * ⚠️ SERVEUR UNIQUEMENT. La Master Key n'est jamais exposée au client.
 * Utilisé par les Route Handlers pour créer/mettre à jour des utilisateurs
 * sans déconnecter l'administrateur (contrairement au SDK client).
 */

const SERVER_URL = process.env.NEXT_PUBLIC_PARSE_SERVER_URL || 'https://parseapi.back4app.com';
const APP_ID = process.env.NEXT_PUBLIC_PARSE_APP_ID || '';
const JS_KEY = process.env.NEXT_PUBLIC_PARSE_JS_KEY || '';
const MASTER_KEY = process.env.PARSE_MASTER_KEY || '';

const ADMIN_ROLES = ['admin', 'super_admin'];

export function masterKeyConfigured(): boolean {
    return Boolean(MASTER_KEY);
}

/**
 * Vérifie que le porteur du session token est un administrateur.
 * Retourne l'utilisateur (id, role, full_name…) ou null.
 */
export async function verifyAdmin(sessionToken: string | undefined): Promise<any | null> {
    if (!sessionToken) return null;
    try {
        const res = await fetch(`${SERVER_URL}/users/me`, {
            headers: {
                'X-Parse-Application-Id': APP_ID,
                'X-Parse-Javascript-Key': JS_KEY,
                'X-Parse-Session-Token': sessionToken,
            },
            cache: 'no-store',
        });
        if (!res.ok) return null;
        const user = await res.json();
        if (!ADMIN_ROLES.includes(user?.role)) return null;
        return user;
    } catch {
        return null;
    }
}

/** Crée un utilisateur avec la Master Key (n'ouvre pas de session). */
export async function createParseUser(fields: Record<string, any>): Promise<{ ok: boolean; id?: string; error?: string }> {
    try {
        const res = await fetch(`${SERVER_URL}/users`, {
            method: 'POST',
            headers: {
                'X-Parse-Application-Id': APP_ID,
                'X-Parse-Master-Key': MASTER_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(fields),
            cache: 'no-store',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            return { ok: false, error: data?.error || `HTTP ${res.status}` };
        }
        return { ok: true, id: data.objectId };
    } catch (e: any) {
        return { ok: false, error: e?.message || 'network' };
    }
}

/** Met à jour un utilisateur (Master Key). */
export async function updateParseUser(id: string, fields: Record<string, any>): Promise<{ ok: boolean; error?: string }> {
    try {
        const res = await fetch(`${SERVER_URL}/users/${id}`, {
            method: 'PUT',
            headers: {
                'X-Parse-Application-Id': APP_ID,
                'X-Parse-Master-Key': MASTER_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(fields),
            cache: 'no-store',
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            return { ok: false, error: data?.error || `HTTP ${res.status}` };
        }
        return { ok: true };
    } catch (e: any) {
        return { ok: false, error: e?.message || 'network' };
    }
}

/** Récupère un utilisateur (Master Key). */
export async function getParseUser(id: string): Promise<any | null> {
    try {
        const res = await fetch(`${SERVER_URL}/users/${id}`, {
            headers: {
                'X-Parse-Application-Id': APP_ID,
                'X-Parse-Master-Key': MASTER_KEY,
            },
            cache: 'no-store',
        });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

/** Vérifie l'unicité de l'e-mail avant création. */
export async function emailExists(email: string): Promise<boolean> {
    try {
        const where = encodeURIComponent(JSON.stringify({ email }));
        const res = await fetch(`${SERVER_URL}/users?where=${where}&limit=1`, {
            headers: {
                'X-Parse-Application-Id': APP_ID,
                'X-Parse-Master-Key': MASTER_KEY,
            },
            cache: 'no-store',
        });
        if (!res.ok) return false;
        const data = await res.json();
        return (data?.results?.length || 0) > 0;
    } catch {
        return false;
    }
}
