'use client';

import { Parse, ParseClasses, parseObjectToJSON, handleParseError } from './parse';

/**
 * Helper functions for common Parse operations
 */

// Document helpers
export const DocumentHelpers = {
    async getAll() {
        const query = new Parse.Query(ParseClasses.DOCUMENT);
        query.descending('createdAt');
        query.limit(1000);
        const results = await query.find();
        return results.map(parseObjectToJSON);
    },

    async getById(id: string) {
        const query = new Parse.Query(ParseClasses.DOCUMENT);
        const result = await query.get(id);
        return parseObjectToJSON(result);
    },

    async create(data: any) {
        const Document = Parse.Object.extend(ParseClasses.DOCUMENT);
        const doc = new Document();

        Object.keys(data).forEach(key => {
            doc.set(key, data[key]);
        });

        const result = await doc.save();
        return parseObjectToJSON(result);
    },

    async update(id: string, data: any) {
        const query = new Parse.Query(ParseClasses.DOCUMENT);
        const doc = await query.get(id);

        Object.keys(data).forEach(key => {
            doc.set(key, data[key]);
        });

        const result = await doc.save();
        return parseObjectToJSON(result);
    },

    async delete(id: string) {
        try {
            const query = new Parse.Query(ParseClasses.DOCUMENT);
            const document = await query.get(id);
            await document.destroy();
        } catch (error: any) {
            if (error.code === Parse.Error.OBJECT_NOT_FOUND) {
                console.warn(`Document ${id} not found, may have been already deleted`);
                return; // Silently succeed if already deleted
            }
            throw error; // Re-throw other errors
        }
    },

    async getByFolder(folderId: string | null) {
        const query = new Parse.Query(ParseClasses.DOCUMENT);
        if (folderId) {
            query.equalTo('folder_id', folderId);
        } else {
            query.doesNotExist('folder_id');
        }
        query.descending('createdAt');
        const results = await query.find();
        return results.map(parseObjectToJSON);
    },

    async search(searchTerm: string) {
        const query = new Parse.Query(ParseClasses.DOCUMENT);
        query.matches('name', new RegExp(searchTerm, 'i'));
        query.descending('createdAt');
        const results = await query.find();
        return results.map(parseObjectToJSON);
    },
};

// Folder helpers
export const FolderHelpers = {
    async getAll() {
        const query = new Parse.Query(ParseClasses.FOLDER);
        query.ascending('name');
        const results = await query.find();
        return results.map(parseObjectToJSON);
    },

    async getById(id: string) {
        const query = new Parse.Query(ParseClasses.FOLDER);
        const result = await query.get(id);
        return parseObjectToJSON(result);
    },

    async generateFolderNumber() {
        const query = new Parse.Query(ParseClasses.FOLDER);
        query.descending('folder_number');
        query.limit(1);
        const result = await query.first();

        let nextNumber = 1;
        if (result) {
            const lastNumber = result.get('folder_number');
            if (lastNumber) {
                // Extract number from format D-XXXX
                const match = lastNumber.match(/D-(\d+)/);
                if (match && match[1]) {
                    nextNumber = parseInt(match[1], 10) + 1;
                }
            }
        }

        // Format as D-XXXX
        return `D-${nextNumber.toString().padStart(4, '0')}`;
    },

    async create(data: any) {
        const Folder = Parse.Object.extend(ParseClasses.FOLDER);
        const folder = new Folder();

        // Generate folder number if not provided
        if (!data.folder_number) {
            data.folder_number = await this.generateFolderNumber();
        }

        Object.keys(data).forEach(key => {
            folder.set(key, data[key]);
        });

        const result = await folder.save();
        return parseObjectToJSON(result);
    },

    async update(id: string, data: any) {
        const query = new Parse.Query(ParseClasses.FOLDER);
        const folder = await query.get(id);

        Object.keys(data).forEach(key => {
            folder.set(key, data[key]);
        });

        const result = await folder.save();
        return parseObjectToJSON(result);
    },

    async delete(id: string) {
        try {
            const query = new Parse.Query(ParseClasses.FOLDER);
            const folder = await query.get(id);
            await folder.destroy();
        } catch (error: any) {
            if (error.code === Parse.Error.OBJECT_NOT_FOUND) {
                console.warn(`Folder ${id} not found, may have been already deleted`);
                return; // Silently succeed if already deleted
            }
            throw error; // Re-throw other errors
        }
    },

    async move(folderId: string, newParentId: string | null) {
        const query = new Parse.Query(ParseClasses.FOLDER);
        const folder = await query.get(folderId);

        // Cycle detection
        if (newParentId) {
            if (folderId === newParentId) {
                throw new Error("Impossible de déplacer un dossier dans lui-même");
            }

            // Check if newParentId is a descendant of folderId
            // Traverse up from newParentId. If we hit folderId, it's a cycle.
            let currentId: string | null = newParentId;
            // Limit depth to prevent infinite loops in case of existing cycles
            let depth = 0;
            const maxDepth = 50;

            while (currentId && depth < maxDepth) {
                // Optimization: If we have all folders in memory we could check there,
                // but here we must query safely.
                const parentQuery = new Parse.Query(ParseClasses.FOLDER);
                try {
                    const parent: Parse.Object = await parentQuery.get(currentId);
                    if (parent.id === folderId) {
                        throw new Error("Impossible de déplacer un dossier dans un de ses sous-dossiers");
                    }
                    currentId = parent.get('parent_id');
                    depth++;
                } catch (e) {
                    // Parent not found or other error, stop checking
                    break;
                }
            }
        }

        folder.set('parent_id', newParentId);
        const result = await folder.save();
        return parseObjectToJSON(result);
    },
};

// User helpers
export const UserHelpers = {
    async getAll() {
        const query = new Parse.Query(Parse.User);
        query.descending('createdAt');
        const results = await query.find();
        return results.map(parseObjectToJSON);
    },

    async getById(id: string) {
        const query = new Parse.Query(Parse.User);
        const result = await query.get(id);
        return parseObjectToJSON(result);
    },

    async update(id: string, data: any) {
        const query = new Parse.Query(Parse.User);
        const user = await query.get(id);

        Object.keys(data).forEach(key => {
            user.set(key, data[key]);
        });

        const result = await user.save();
        return parseObjectToJSON(result);
    },

    async getActiveUsers() {
        const query = new Parse.Query(Parse.User);
        query.equalTo('is_active', true);
        query.descending('createdAt');
        const results = await query.find();
        return results.map(parseObjectToJSON);
    },

    async create(data: any) {
        // Note: Creating users client-side without logging in is tricky.
        // Ideally this should be a Cloud Function.
        // For now, we'll try to use Parse.User.signUp but this will log the current user out.
        // So we might need a Cloud Function 'inviteUser'.
        // Assuming we have a Cloud Function or we just use a workaround.
        // Workaround: We can't easily create a user without logging out.
        // We will throw an error for now saying this requires Cloud Code.
        throw new Error("User creation requires Cloud Code 'inviteUser' function.");
    },

    async delete(id: string) {
        // Requires Master Key or specific CLP
        const query = new Parse.Query(Parse.User);
        const user = await query.get(id);
        await user.destroy();
    },
};

// Message helpers
export const MessageHelpers = {
    async getByConversation(conversationId: string) {
        const query = new Parse.Query(ParseClasses.MESSAGE);
        query.equalTo('conversation_id', conversationId);
        query.ascending('createdAt');
        const results = await query.find();
        return results.map(parseObjectToJSON);
    },

    async getConversation(userId1: string, userId2: string) {
        const query1 = new Parse.Query(ParseClasses.MESSAGE);
        query1.equalTo('sender_id', userId1);
        query1.equalTo('receiver_id', userId2);

        const query2 = new Parse.Query(ParseClasses.MESSAGE);
        query2.equalTo('sender_id', userId2);
        query2.equalTo('receiver_id', userId1);

        const mainQuery = Parse.Query.or(query1, query2);
        mainQuery.ascending('createdAt');
        query1.include('sender');
        const results = await mainQuery.find();
        return results.map(parseObjectToJSON);
    },

    async getLastMessage(userId1: string, userId2: string) {
        const query1 = new Parse.Query(ParseClasses.MESSAGE);
        query1.equalTo('sender_id', userId1);
        query1.equalTo('receiver_id', userId2);

        const query2 = new Parse.Query(ParseClasses.MESSAGE);
        query2.equalTo('sender_id', userId2);
        query2.equalTo('receiver_id', userId1);

        const mainQuery = Parse.Query.or(query1, query2);
        mainQuery.descending('createdAt');
        const result = await mainQuery.first();
        return result ? parseObjectToJSON(result) : null;
    },

    async countUnread(userId: string, senderId: string) {
        const query = new Parse.Query(ParseClasses.MESSAGE);
        query.equalTo('receiver_id', userId);
        query.equalTo('sender_id', senderId);
        query.equalTo('is_read', false);
        return await query.count();
    },

    async create(data: any) {
        const Message = Parse.Object.extend(ParseClasses.MESSAGE);
        const message = new Message();

        Object.keys(data).forEach(key => {
            message.set(key, data[key]);
        });

        const result = await message.save();
        return parseObjectToJSON(result);
    },

    async send(data: any) {
        return this.create(data);
    },

    async markAsRead(userId: string, senderId: string) {
        const query = new Parse.Query(ParseClasses.MESSAGE);
        query.equalTo('receiver_id', userId);
        query.equalTo('sender_id', senderId);
        query.equalTo('is_read', false);
        const messages = await query.find();

        messages.forEach(msg => msg.set('is_read', true));
        if (messages.length > 0) {
            await Parse.Object.saveAll(messages);
        }
    },
};

// Share helpers
export const ShareHelpers = {
    async getSharedBy(userId: string) {
        const query = new Parse.Query(ParseClasses.SHARE);
        query.equalTo('shared_by', userId);
        query.include('document');
        query.include('shared_with_user');
        query.descending('createdAt');
        const results = await query.find();
        return results.map(r => {
            const json = parseObjectToJSON(r) as any;
            return {
                ...json,
                document: r.get('document') ? parseObjectToJSON(r.get('document')) : null,
                shared_with_user: r.get('shared_with_user') ? parseObjectToJSON(r.get('shared_with_user')) : null
            };
        });
    },

    async getSharedWith(userId: string) {
        const query = new Parse.Query(ParseClasses.SHARE);
        query.equalTo('shared_with', userId);
        query.include('document');
        query.include('shared_by_user');
        query.descending('createdAt');
        const results = await query.find();
        return results.map(r => {
            const json = parseObjectToJSON(r) as any;
            return {
                ...json,
                document: r.get('document') ? parseObjectToJSON(r.get('document')) : null,
                shared_by_user: r.get('shared_by_user') ? parseObjectToJSON(r.get('shared_by_user')) : null
            };
        });
    },

    async create(data: any) {
        const Share = Parse.Object.extend(ParseClasses.SHARE);
        const share = new Share();

        Object.keys(data).forEach(key => {
            share.set(key, data[key]);
        });

        const result = await share.save();
        return parseObjectToJSON(result);
    },

    async getByToken(token: string) {
        const query = new Parse.Query(ParseClasses.SHARE);
        query.equalTo('token', token);
        query.include('document');
        query.include('folder');
        query.include('shared_by_user');
        const result = await query.first();

        if (result) {
            const json = parseObjectToJSON(result) as any;
            return {
                ...json,
                document: result.get('document') ? parseObjectToJSON(result.get('document')) : null,
                folder: result.get('folder') ? parseObjectToJSON(result.get('folder')) : null,
                shared_by_user: result.get('shared_by_user') ? parseObjectToJSON(result.get('shared_by_user')) : null
            };
        }
        return null;
    },


    async delete(id: string) {
        const query = new Parse.Query(ParseClasses.SHARE);
        const share = await query.get(id);
        await share.destroy();
    },
};

// Access Request helpers
export const AccessRequestHelpers = {
    async getAll() {
        const query = new Parse.Query(ParseClasses.ACCESS_REQUEST);
        query.descending('createdAt');
        const results = await query.find();
        return results.map(parseObjectToJSON);
    },

    async getByUser(userId: string) {
        const query = new Parse.Query(ParseClasses.ACCESS_REQUEST);
        query.equalTo('requested_by', userId);
        query.descending('createdAt');
        const results = await query.find();
        return results.map(parseObjectToJSON);
    },

    async getIncoming(userId: string) {
        const query = new Parse.Query(ParseClasses.ACCESS_REQUEST);
        query.equalTo('document_owner', userId);
        query.equalTo('status', 'pending');
        query.include('document');
        query.include('requester');
        query.descending('createdAt');
        const results = await query.find();
        return results.map(parseObjectToJSON);
    },

    async create(data: any) {
        const AccessRequest = Parse.Object.extend(ParseClasses.ACCESS_REQUEST);
        const request = new AccessRequest();

        Object.keys(data).forEach(key => {
            request.set(key, data[key]);
        });

        const result = await request.save();
        return parseObjectToJSON(result);
    },

    async update(id: string, data: any) {
        const query = new Parse.Query(ParseClasses.ACCESS_REQUEST);
        const request = await query.get(id);

        Object.keys(data).forEach(key => {
            request.set(key, data[key]);
        });

        const result = await request.save();
        return parseObjectToJSON(result);
    },
};

// Notification helpers
export const NotificationHelpers = {
    async getByUser(userId: string, limit = 10) {
        try {
            // Check if user is authenticated
            const currentUser = Parse.User.current();
            if (!currentUser) {
                console.warn('No authenticated user, skipping notifications fetch');
                return [];
            }

            const query = new Parse.Query(ParseClasses.USER_NOTIFICATION);
            query.equalTo('user_id', userId);
            query.descending('createdAt');
            query.limit(limit);
            const results = await query.find();
            return results.map(parseObjectToJSON);
        } catch (error: any) {
            // Handle invalid session token gracefully
            if (error.code === 209 || error.message?.includes('Invalid session token')) {
                console.warn('Invalid session token, user needs to re-login');
                // Optionally log out the user
                try {
                    await Parse.User.logOut();
                } catch (logoutError) {
                    console.error('Error logging out:', logoutError);
                }
                return [];
            }
            console.error('Error fetching notifications:', error);
            return [];
        }
    },

    async create(data: any) {
        const Notification = Parse.Object.extend(ParseClasses.USER_NOTIFICATION);
        const notification = new Notification();

        Object.keys(data).forEach(key => {
            notification.set(key, data[key]);
        });

        const result = await notification.save();
        return parseObjectToJSON(result);
    },

    async markAsRead(notificationId: string) {
        const query = new Parse.Query(ParseClasses.USER_NOTIFICATION);
        const notification = await query.get(notificationId);
        notification.set('is_read', true);
        const result = await notification.save();
        return parseObjectToJSON(result);
    },

    async markAllAsRead(userId: string) {
        const query = new Parse.Query(ParseClasses.USER_NOTIFICATION);
        query.equalTo('user_id', userId);
        query.equalTo('is_read', false);
        const notifications = await query.find();

        notifications.forEach(notification => {
            notification.set('is_read', true);
        });

        await Parse.Object.saveAll(notifications);
    },
};

// File upload helper
export const FileHelpers = {
    async uploadFile(file: File, fileName?: string): Promise<Parse.File> {
        try {
            // Import sanitization function dynamically to avoid circular dependencies
            const { sanitizeFilename } = await import('./filename-utils');

            const originalName = fileName || file.name;
            const sanitizedName = sanitizeFilename(originalName);

            // Create Parse File with sanitized name
            const parseFile = new Parse.File(sanitizedName, file);

            // Attempt to save with retry logic
            let lastError: any;
            const MAX_RETRIES = 2;

            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                try {
                    await parseFile.save();
                    return parseFile;
                } catch (error: any) {
                    lastError = error;
                    console.error(`Upload attempt ${attempt} failed:`, error);

                    // Don't retry on validation errors
                    if (error.code === Parse.Error.VALIDATION_ERROR) {
                        break;
                    }

                    // Wait before retry (exponential backoff)
                    if (attempt < MAX_RETRIES) {
                        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                    }
                }
            }

            // All retries failed, throw with French error message
            throw new Error(
                lastError?.message ||
                "Échec de l'upload du fichier. Veuillez réessayer."
            );
        } catch (error: any) {
            // Translate common Parse errors to French
            if (error.code === Parse.Error.FILE_SAVE_ERROR) {
                throw new Error("Erreur lors de la sauvegarde du fichier. Vérifiez votre connexion.");
            } else if (error.code === Parse.Error.VALIDATION_ERROR) {
                throw new Error("Le nom de fichier contient des caractères invalides.");
            } else if (error.code === Parse.Error.CONNECTION_FAILED) {
                throw new Error("Connexion au serveur échouée. Vérifiez votre connexion internet.");
            }

            throw error;
        }
    },

    async deleteFile(fileUrl: string) {
        // Parse files are automatically managed
        // No explicit delete needed in most cases
    },

    getFileUrl(parseFile: Parse.File): string {
        return parseFile.url();
    },
};

// Count helpers
export const CountHelpers = {
    async countDocuments() {
        const query = new Parse.Query(ParseClasses.DOCUMENT);
        return await query.count();
    },

    async countUsers() {
        const query = new Parse.Query(Parse.User);
        query.equalTo('is_active', true);
        return await query.count();
    },

    async countUnreadMessages(userId: string) {
        const query = new Parse.Query(ParseClasses.MESSAGE);
        query.equalTo('is_read', false);
        query.notEqualTo('sender_id', userId);
        return await query.count();
    },


    async countShares(userId: string) {
        const query1 = new Parse.Query(ParseClasses.SHARE);
        query1.equalTo('shared_by', userId);

        const query2 = new Parse.Query(ParseClasses.SHARE);
        query2.equalTo('shared_with', userId);

        const mainQuery = Parse.Query.or(query1, query2);
        return await mainQuery.count();
    },
};

// Channel helpers
export const ChannelHelpers = {
    async getAll() {
        const query = new Parse.Query('Channel');
        query.ascending('name');
        const results = await query.find();
        return results.map(parseObjectToJSON);
    },

    async create(data: any) {
        const Channel = Parse.Object.extend('Channel');
        const channel = new Channel();

        Object.keys(data).forEach(key => {
            channel.set(key, data[key]);
        });

        const result = await channel.save();
        return parseObjectToJSON(result);
    },

    async getMembers(channelId: string) {
        const query = new Parse.Query('ChannelMember');
        query.equalTo('channel_id', channelId);
        const results = await query.find();
        return results.map(parseObjectToJSON);
    },

    async addMember(channelId: string, userId: string, role: string = 'member') {
        const ChannelMember = Parse.Object.extend('ChannelMember');
        const member = new ChannelMember();
        member.set('channel_id', channelId);
        member.set('user_id', userId);
        member.set('role', role);
        const result = await member.save();
        return parseObjectToJSON(result);
    },

    async isMember(channelId: string, userId: string) {
        const query = new Parse.Query('ChannelMember');
        query.equalTo('channel_id', channelId);
        query.equalTo('user_id', userId);
        const result = await query.first();
        return !!result;
    },

    async getMessages(channelId: string) {
        const query = new Parse.Query(ParseClasses.MESSAGE);
        query.equalTo('channel_id', channelId);
        query.ascending('createdAt');
        const results = await query.find();
        return results.map(parseObjectToJSON);
    },
};
