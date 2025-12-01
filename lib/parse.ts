'use client';

import Parse from 'parse';

// Configuration Parse/Back4App
const PARSE_APP_ID = process.env.NEXT_PUBLIC_PARSE_APP_ID || 'YOUR_APP_ID';
const PARSE_JS_KEY = process.env.NEXT_PUBLIC_PARSE_JS_KEY || 'YOUR_JS_KEY';
const PARSE_SERVER_URL = process.env.NEXT_PUBLIC_PARSE_SERVER_URL || 'https://parseapi.back4app.com';

// Initialize Parse
if (typeof window !== 'undefined') {
    Parse.initialize(PARSE_APP_ID, PARSE_JS_KEY);
    Parse.serverURL = PARSE_SERVER_URL;
}

// Export Parse instance
export { Parse };

// Helper to get current user
export const getCurrentUser = () => {
    return Parse.User.current();
};

// Helper to check if user is authenticated
export const isAuthenticated = () => {
    return Parse.User.current() !== null;
};

// Type definitions for our database schema
export interface UserProfile {
    id: string;
    email: string;
    full_name: string;
    role: 'user' | 'admin' | 'super_admin';
    avatar_url: string | null;
    is_verified: boolean;
    is_active: boolean;
    fonction?: string;
    service?: string;
    telephone?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Document {
    id: string;
    name: string;
    description: string | null;
    file_path: string;
    file_size: number;
    file_type: string;
    folder_id: string | null;
    category: string;
    tags: string[];
    uploaded_by: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface Folder {
    id: string;
    name: string;
    parent_id: string | null;
    category: string;
    description?: string;
    folder_number?: string;
    created_by: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface Message {
    id: string;
    conversation_id: string;
    sender_id: string | null;
    content: string;
    is_read: boolean;
    createdAt: Date;
}

export interface Share {
    id: string;
    document_id: string;
    shared_by: string;
    shared_with: string | null;
    can_read: boolean;
    can_write: boolean;
    can_delete: boolean;
    can_share: boolean;
    is_link_share: boolean;
    share_token: string | null;
    expires_at: Date | null;
    createdAt: Date;
}

export interface AccessRequest {
    id: string;
    document_id: string;
    requested_by: string;
    status: 'pending' | 'approved' | 'rejected';
    reviewed_by: string | null;
    reason: string;
    rejection_reason: string | null;
    requested_permissions: {
        can_read: boolean;
        can_write: boolean;
        can_delete: boolean;
        can_share: boolean;
    };
    createdAt: Date;
    reviewed_at: Date | null;
}

export interface Notification {
    id: string;
    user_id: string;
    title: string;
    message: string;
    type: string;
    is_read: boolean;
    link: string | null;
    createdAt: Date;
}

// Parse Class Names
export const ParseClasses = {
    USER: '_User',
    DOCUMENT: 'Document',
    FOLDER: 'Folder',
    MESSAGE: 'Message',
    CONVERSATION: 'Conversation',
    CONVERSATION_PARTICIPANT: 'ConversationParticipant',
    SHARE: 'Share',
    ACCESS_REQUEST: 'AccessRequest',
    ACTIVITY_LOG: 'ActivityLog',
    USER_NOTIFICATION: 'UserNotification',
    USER_PREFERENCE: 'UserPreference',
} as const;

// Helper function to convert Parse Object to plain object
export const parseObjectToJSON = <T>(parseObject: Parse.Object): T => {
    const json = parseObject.toJSON();

    // Handle Parse.File objects - convert them to include the URL
    const processedJson: any = {};
    for (const key in json) {
        const value = parseObject.get(key);
        if (value instanceof Parse.File) {
            processedJson[key] = {
                url: value.url(),
                name: value.name(),
            };
        } else {
            processedJson[key] = json[key];
        }
    }

    return {
        ...processedJson,
        id: parseObject.id,
        createdAt: parseObject.createdAt,
        updatedAt: parseObject.updatedAt,
    } as T;
};

// Helper function to handle Parse errors
export const handleParseError = (error: any): string => {
    if (error instanceof Parse.Error) {
        switch (error.code) {
            case Parse.Error.INVALID_SESSION_TOKEN:
                return 'Session expirée. Veuillez vous reconnecter.';
            case Parse.Error.OBJECT_NOT_FOUND:
                return 'Ressource introuvable.';
            case Parse.Error.USERNAME_TAKEN:
                return 'Cet email est déjà utilisé.';
            case Parse.Error.EMAIL_TAKEN:
                return 'Cet email est déjà utilisé.';
            case Parse.Error.INVALID_EMAIL_ADDRESS:
                return 'Adresse email invalide.';
            case Parse.Error.USERNAME_MISSING:
                return 'Email requis.';
            case Parse.Error.PASSWORD_MISSING:
                return 'Mot de passe requis.';
            case Parse.Error.CONNECTION_FAILED:
                return 'Erreur de connexion au serveur.';
            default:
                return error.message || 'Une erreur est survenue.';
        }
    }
    return error?.message || 'Une erreur est survenue.';
};
