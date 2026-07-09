/**
 * Empreinte de fichier (SHA-256) — Archive PMN
 *
 * Calcul côté navigateur via l'API Web Crypto (crypto.subtle) : aucun upload
 * nécessaire pour hasher. Sert à détecter les doublons EXACTS (empreinte
 * identique) à l'upload et dans le rapport « Doublons ».
 */

/** Calcule le SHA-256 hexadécimal d'un fichier dans le navigateur. */
export async function computeSHA256(file: File | Blob): Promise<string> {
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return bufferToHex(digest);
}

function bufferToHex(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
        hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
}

/** Formatte une taille en octets → « 1,2 Mo » / « 340 Ko » / « 512 o ». */
export function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes < 0) return '—';
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} Go`;
}
