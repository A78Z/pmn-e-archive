'use client';

/**
 * Icônes de la charte Archive PMN.
 *
 * FolderGlyph : icône « dossier doré » officielle de la charte
 * (public/assets/folder.png, fournie par le client).
 */

import Image from 'next/image';

export function FolderGlyph({ size = 36 }: { size?: number }) {
    return (
        <Image
            src="/assets/folder.png"
            alt=""
            aria-hidden
            width={size}
            height={size}
            className="flex-shrink-0 object-contain"
        />
    );
}

/** Détermine l'extension (majuscule) d'un nom de fichier. */
export function fileExtension(name: string): string {
    const i = name.lastIndexOf('.');
    if (i <= 0) return '';
    return name.slice(i + 1).toUpperCase();
}

const EXT_STYLES: Record<string, { color: string; bg: string }> = {
    PDF: { color: '#C63131', bg: 'rgba(198,49,49,.1)' },
    DOC: { color: '#2B6FDB', bg: 'rgba(43,111,219,.1)' },
    DOCX: { color: '#2B6FDB', bg: 'rgba(43,111,219,.1)' },
    XLS: { color: '#15654B', bg: 'rgba(21,101,75,.1)' },
    XLSX: { color: '#15654B', bg: 'rgba(21,101,75,.1)' },
    CSV: { color: '#15654B', bg: 'rgba(21,101,75,.1)' },
    PNG: { color: '#B8871A', bg: 'rgba(228,180,41,.14)' },
    JPG: { color: '#B8871A', bg: 'rgba(228,180,41,.14)' },
    JPEG: { color: '#B8871A', bg: 'rgba(228,180,41,.14)' },
    GIF: { color: '#B8871A', bg: 'rgba(228,180,41,.14)' },
};

export function fileTypeStyle(name: string): { color: string; bg: string; ext: string } {
    const ext = fileExtension(name);
    const style = EXT_STYLES[ext] || { color: '#8A948F', bg: 'rgba(20,33,28,.05)' };
    return { ...style, ext: ext || 'DOC' };
}

/** Tuile icône de fichier, colorée selon le type (liste Documents). */
export function FileTile({ name, size = 40 }: { name: string; size?: number }) {
    const { color, bg } = fileTypeStyle(name);
    const icon = Math.round(size * 0.45);
    return (
        <div
            className="flex-none rounded-[9px] flex items-center justify-center"
            style={{ width: size, height: size, background: bg, color }}
        >
            <svg
                width={icon}
                height={icon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                <path d="M14 3v5h5" />
            </svg>
        </div>
    );
}

/** Badge extension (écran Uploader) : PDF rouge, XLS vert, DOC bleu… */
export function ExtBadge({ name, size = 40 }: { name: string; size?: number }) {
    const { color, bg, ext } = fileTypeStyle(name);
    return (
        <div
            className="flex-none rounded-[10px] flex items-center justify-center text-[10.5px] font-extrabold tracking-wide"
            style={{ width: size, height: size, background: bg, color }}
        >
            {ext.slice(0, 4)}
        </div>
    );
}
