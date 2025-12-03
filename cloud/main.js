/**
 * Back4App Cloud Code - Filename Validation and Upload
 * 
 * Server-side validation and sanitization for file uploads
 * Deploy this file to Back4App Cloud Code
 */

// ============================================================================
// Filename Sanitization Utilities (Server-side)
// ============================================================================

const INVALID_CHARS_REGEX = /[:/\\?%*|"<>]/g;
const CONTROL_CHARS_REGEX = /[\x00-\x1F\x7F-\x9F]/g;
const MULTIPLE_SPACES_REGEX = /\s{2,}/g;
const MAX_FILENAME_LENGTH = 200;

/**
 * Normalizes Unicode characters from NFD to NFC
 */
function normalizeUnicode(text) {
    return text.normalize('NFC');
}

/**
 * Sanitizes a filename by removing/replacing invalid characters
 */
function sanitizeFilename(filename) {
    if (!filename || filename.trim().length === 0) {
        return 'unnamed-file';
    }

    // Split filename and extension
    const lastDotIndex = filename.lastIndexOf('.');
    let name = filename;
    let extension = '';

    if (lastDotIndex > 0) {
        name = filename.substring(0, lastDotIndex);
        extension = filename.substring(lastDotIndex);
    }

    // Sanitize the name part
    let sanitized = name;
    sanitized = normalizeUnicode(sanitized);
    sanitized = sanitized.replace(CONTROL_CHARS_REGEX, '');
    sanitized = sanitized.replace(INVALID_CHARS_REGEX, '-');
    sanitized = sanitized.replace(MULTIPLE_SPACES_REGEX, ' ');
    sanitized = sanitized.trim();

    if (sanitized.length === 0) {
        sanitized = 'unnamed-file';
    }

    // Sanitize extension
    let sanitizedExtension = extension;
    if (extension) {
        sanitizedExtension = extension.replace(INVALID_CHARS_REGEX, '');
        sanitizedExtension = sanitizedExtension.replace(CONTROL_CHARS_REGEX, '');
    }

    // Combine and limit length
    let result = sanitized + sanitizedExtension;

    if (result.length > MAX_FILENAME_LENGTH) {
        const maxNameLength = MAX_FILENAME_LENGTH - sanitizedExtension.length;
        sanitized = sanitized.substring(0, maxNameLength);
        result = sanitized + sanitizedExtension;
    }

    return result;
}

/**
 * Validates a filename
 */
function validateFilename(filename) {
    const errors = [];

    if (!filename || filename.trim().length === 0) {
        errors.push('Le nom de fichier est vide');
        return { valid: false, errors };
    }

    if (INVALID_CHARS_REGEX.test(filename)) {
        const invalidChars = filename.match(INVALID_CHARS_REGEX);
        errors.push(`Caractères invalides détectés : ${[...new Set(invalidChars)].join(', ')}`);
    }

    if (CONTROL_CHARS_REGEX.test(filename)) {
        errors.push('Caractères de contrôle invisibles détectés');
    }

    if (filename.length > MAX_FILENAME_LENGTH) {
        errors.push(`Nom trop long (${filename.length} caractères, max ${MAX_FILENAME_LENGTH})`);
    }

    if (filename !== filename.trim()) {
        errors.push('Espaces en début ou fin de nom');
    }

    if (MULTIPLE_SPACES_REGEX.test(filename)) {
        errors.push('Espaces multiples consécutifs détectés');
    }

    return {
        valid: errors.length === 0,
        errors,
        sanitized: errors.length > 0 ? sanitizeFilename(filename) : undefined
    };
}

// ============================================================================
// Cloud Functions
// ============================================================================

/**
 * Cloud Function: Validate Filename
 * 
 * Usage from client:
 * const result = await Parse.Cloud.run('validateFilename', { filename: 'test.pdf' });
 */
Parse.Cloud.define('validateFilename', async (request) => {
    const { filename } = request.params;

    if (!filename) {
        throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Filename is required');
    }

    const validation = validateFilename(filename);

    return {
        valid: validation.valid,
        errors: validation.errors,
        sanitized: validation.sanitized || sanitizeFilename(filename),
        original: filename
    };
});

/**
 * Cloud Function: Sanitize Filename
 * 
 * Usage from client:
 * const sanitized = await Parse.Cloud.run('sanitizeFilename', { filename: 'test:file?.pdf' });
 */
Parse.Cloud.define('sanitizeFilename', async (request) => {
    const { filename } = request.params;

    if (!filename) {
        throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Filename is required');
    }

    return {
        original: filename,
        sanitized: sanitizeFilename(filename)
    };
});

/**
 * Cloud Function: Upload Document with Validation
 * 
 * This function handles the complete upload process with server-side validation
 * 
 * Usage from client:
 * const result = await Parse.Cloud.run('uploadDocument', {
 *   fileName: 'document.pdf',
 *   fileData: base64String,
 *   category: 'Archives',
 *   folderId: 'abc123',
 *   description: 'Description',
 *   tags: ['tag1', 'tag2']
 * });
 */
Parse.Cloud.define('uploadDocument', async (request) => {
    const { fileName, fileData, category, folderId, description, tags } = request.params;
    const user = request.user;

    // Authentication check
    if (!user) {
        throw new Parse.Error(
            Parse.Error.INVALID_SESSION_TOKEN,
            'Utilisateur non authentifié'
        );
    }

    // Validate required fields
    if (!fileName) {
        throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Le nom de fichier est requis');
    }

    if (!fileData) {
        throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Les données du fichier sont requises');
    }

    if (!category) {
        throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'La catégorie est requise');
    }

    // Sanitize filename
    const sanitizedName = sanitizeFilename(fileName);

    // Validate sanitized filename
    const validation = validateFilename(sanitizedName);
    if (!validation.valid) {
        throw new Parse.Error(
            Parse.Error.VALIDATION_ERROR,
            `Le nom de fichier "${fileName}" est invalide: ${validation.errors.join(', ')}`
        );
    }

    try {
        // Create Parse File with sanitized name
        const parseFile = new Parse.File(sanitizedName, { base64: fileData });
        await parseFile.save({ useMasterKey: true });

        // Create Document object
        const Document = Parse.Object.extend('Document');
        const doc = new Document();

        doc.set('name', sanitizedName);
        doc.set('file_path', parseFile.url());
        doc.set('category', category);
        doc.set('description', description || null);
        doc.set('tags', tags || []);
        doc.set('uploaded_by', user.id);

        if (folderId) {
            doc.set('folder_id', folderId);
        }

        // Save document
        await doc.save(null, { useMasterKey: true });

        return {
            success: true,
            documentId: doc.id,
            fileName: sanitizedName,
            fileUrl: parseFile.url(),
            renamed: fileName !== sanitizedName
        };
    } catch (error) {
        console.error('Upload error:', error);
        throw new Parse.Error(
            Parse.Error.INTERNAL_SERVER_ERROR,
            `Erreur lors de l'upload: ${error.message}`
        );
    }
});

/**
 * Before Save Hook for Document class
 * Ensures all document names are sanitized before saving
 */
Parse.Cloud.beforeSave('Document', async (request) => {
    const doc = request.object;
    const name = doc.get('name');

    if (name) {
        const sanitizedName = sanitizeFilename(name);
        if (name !== sanitizedName) {
            console.log(`Sanitizing document name: "${name}" -> "${sanitizedName}"`);
            doc.set('name', sanitizedName);
        }
    }
});

/**
 * After Save Hook for Document class
 * Log successful uploads for monitoring
 */
Parse.Cloud.afterSave('Document', async (request) => {
    const doc = request.object;
    const user = request.user;

    if (!request.original) {
        // New document created
        console.log(`Document uploaded: ${doc.get('name')} by user ${user ? user.id : 'unknown'}`);
    }
});

// ============================================================================
// Utility Functions for Testing
// ============================================================================

/**
 * Cloud Function: Test Filename Sanitization
 * Tests the sanitization with various edge cases
 */
Parse.Cloud.define('testFilenameSanitization', async (request) => {
    const testCases = [
        'normal-file.pdf',
        'file with spaces.docx',
        'file:with?invalid*chars.pdf',
        "file'with'apostrophes.pdf",
        'file  with   multiple    spaces.pdf',
        'très-long-nom-de-fichier-avec-beaucoup-de-caractères-qui-dépasse-la-limite-maximale-autorisée-pour-un-nom-de-fichier-dans-le-système.pdf',
        'fichier-avec-accents-éàü.pdf',
        '000-Autorisation d\'acquisition de véhicules.pdf',
        '001-AOO VEHICULE 4X4 STATION WAGON DAO CORRIGE.docx'
    ];

    const results = testCases.map(filename => ({
        original: filename,
        sanitized: sanitizeFilename(filename),
        validation: validateFilename(filename)
    }));

    return { testCases: results };
});

console.log('Cloud Code loaded: Filename validation and upload functions ready');

// ============================================================================
// User Management Cloud Functions
// ============================================================================

/**
 * Cloud Function: Get All Users
 * Fetches all users with Master Key access (admin only)
 */
Parse.Cloud.define('getAllUsers', async (request) => {
    const { user } = request;

    // Check if user is authenticated and is super_admin or admin
    if (!user) {
        throw new Parse.Error(Parse.Error.INVALID_SESSION_TOKEN, 'User must be authenticated');
    }

    const role = user.get('role');
    if (role !== 'super_admin' && role !== 'admin') {
        throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Only admins can view all users');
    }

    // Use Master Key to fetch all users
    const query = new Parse.Query(Parse.User);
    query.descending('createdAt');
    query.limit(1000);

    const results = await query.find({ useMasterKey: true });

    // Return user data
    return results.map(u => ({
        id: u.id,
        email: u.get('email'),
        username: u.get('username'),
        full_name: u.get('full_name'),
        role: u.get('role'),
        fonction: u.get('fonction'),
        is_verified: u.get('is_verified'),
        is_active: u.get('is_active'),
        assigned_zone: u.get('assigned_zone'),
        department: u.get('department'),
        createdAt: u.get('createdAt'),
        updatedAt: u.get('updatedAt'),
        last_login: u.get('last_login')
    }));
});

/**
 * Cloud Function: Verify User
 * Approve or reject a user account (admin only)
 */
Parse.Cloud.define('verifyUser', async (request) => {
    const { user, params } = request;
    const { userId, approved, notes } = params;

    // Check if user is authenticated and is admin
    if (!user) {
        throw new Parse.Error(Parse.Error.INVALID_SESSION_TOKEN, 'User must be authenticated');
    }

    const role = user.get('role');
    if (role !== 'super_admin' && role !== 'admin') {
        throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Only admins can verify users');
    }

    // Get the user to verify
    const query = new Parse.Query(Parse.User);
    const targetUser = await query.get(userId, { useMasterKey: true });

    if (!targetUser) {
        throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'User not found');
    }

    // Update user verification status
    targetUser.set('is_verified', approved);
    targetUser.set('is_active', approved);

    if (notes) {
        targetUser.set('admin_notes', notes);
    }

    await targetUser.save(null, { useMasterKey: true });

    return {
        success: true,
        message: approved ? 'User approved successfully' : 'User rejected'
    };
});

/**
 * Cloud Function: Update User Role
 * Change a user's role (super_admin only)
 */
Parse.Cloud.define('updateUserRole', async (request) => {
    const { user, params } = request;
    const { userId, newRole } = params;

    // Check if user is authenticated and is super_admin
    if (!user) {
        throw new Parse.Error(Parse.Error.INVALID_SESSION_TOKEN, 'User must be authenticated');
    }

    const role = user.get('role');
    if (role !== 'super_admin') {
        throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Only super admins can change roles');
    }

    // Get the user to update
    const query = new Parse.Query(Parse.User);
    const targetUser = await query.get(userId, { useMasterKey: true });

    if (!targetUser) {
        throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'User not found');
    }

    // Validate role
    const validRoles = ['super_admin', 'admin', 'user', 'guest'];
    if (!validRoles.includes(newRole)) {
        throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Invalid role');
    }

    // Update role
    targetUser.set('role', newRole);
    await targetUser.save(null, { useMasterKey: true });

    return {
        success: true,
        message: `User role updated to ${newRole}`
    };
});

console.log('Cloud Code loaded: User management functions ready');
