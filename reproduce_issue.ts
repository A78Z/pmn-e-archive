
const STRICT_INVALID_CHARS_REGEX = /[/\\]/g;
const CONTROL_CHARS_REGEX = /[\x00-\x1F\x7F-\x9F]/g;
const MAX_FILENAME_LENGTH = 200;

function normalizeUnicode(text: string): string {
    return text.normalize('NFC');
}

function sanitizeFilename(filename: string): string {
    if (!filename || filename.trim().length === 0) {
        return 'unnamed-file';
    }

    const lastDotIndex = filename.lastIndexOf('.');
    let name = filename;
    let extension = '';

    if (lastDotIndex > 0) {
        name = filename.substring(0, lastDotIndex);
        extension = filename.substring(lastDotIndex);
    }

    let sanitized = name;
    sanitized = normalizeUnicode(sanitized);
    sanitized = sanitized.replace(CONTROL_CHARS_REGEX, '');
    sanitized = sanitized.replace(STRICT_INVALID_CHARS_REGEX, '-');
    sanitized = sanitized.trim();

    if (sanitized.length === 0) {
        sanitized = 'unnamed-file';
    }

    let sanitizedExtension = extension;
    if (extension) {
        sanitizedExtension = extension.replace(STRICT_INVALID_CHARS_REGEX, '');
        sanitizedExtension = sanitizedExtension.replace(CONTROL_CHARS_REGEX, '');
    }

    let result = sanitized + sanitizedExtension;

    if (result.length > MAX_FILENAME_LENGTH) {
        const maxNameLength = MAX_FILENAME_LENGTH - sanitizedExtension.length;
        sanitized = sanitized.substring(0, maxNameLength);
        result = sanitized + sanitizedExtension;
    }

    return result;
}

function validateFilename(filename: string): {
    valid: boolean;
    errors: string[];
    sanitized?: string;
} {
    const errors: string[] = [];

    if (!filename || filename.trim().length === 0) {
        errors.push('Le nom de fichier est vide');
        return { valid: false, errors };
    }

    if (STRICT_INVALID_CHARS_REGEX.test(filename)) {
        errors.push('Le nom contient des caractères interdits (/ ou \\)');
    }

    if (CONTROL_CHARS_REGEX.test(filename)) {
        errors.push('Caractères de contrôle invisibles détectés');
    }

    if (filename.length > MAX_FILENAME_LENGTH) {
        errors.push(`Nom trop long (${filename.length} caractères, max ${MAX_FILENAME_LENGTH})`);
    }

    const sanitized = sanitizeFilename(filename);
    const valid = errors.length === 0;

    return {
        valid,
        errors,
        sanitized: valid ? undefined : sanitized
    };
}

const examples = [
    "0852584.pdf",
    "Bordereau d'envoi n°0852584.pdf",
    "d'envoi.pdf",
    "test'file.pdf",
    "12345.pdf"
];

examples.forEach(name => {
    const result = validateFilename(name);
    console.log(`Filename: "${name}"`);
    console.log(`Valid: ${result.valid}`);
    if (!result.valid) {
        console.log(`Errors: ${result.errors.join(', ')}`);
    }
    console.log('---');
});
