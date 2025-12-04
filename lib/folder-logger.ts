/**
 * LOGGER CENTRALISÉ - Système de Dossiers
 * Pour tracer toutes les opérations critiques
 */

export const FolderLogger = {
    /**
     * Logger pour opération de déplacement (reparentage)
     */
    move: (folderId: string, fromParent: string | null, toParent: string | null, userId: string, folderName?: string) => {
        const log = {
            timestamp: new Date().toISOString(),
            action: 'FOLDER_MOVE',
            folderId,
            folderName,
            fromParent: fromParent || 'root',
            toParent: toParent || 'root',
            userId,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server'
        };

        console.log('[FOLDER_AUDIT]', JSON.stringify(log));

        // ✅ OPTION: Envoyer à un service de monitoring externe
        // if (process.env.NODE_ENV === 'production') {
        //   sendToMonitoring(log);
        // }

        return log;
    },

    /**
     * Logger pour opération de réordonnancement
     */
    reorder: (folderId: string, oldOrder: number, newOrder: number, userId: string, folderName?: string) => {
        const log = {
            timestamp: new Date().toISOString(),
            action: 'FOLDER_REORDER',
            folderId,
            folderName,
            oldOrder,
            newOrder,
            userId
        };

        console.log('[FOLDER_AUDIT]', JSON.stringify(log));

        return log;
    },

    /**
     * Logger pour erreurs
     */
    error: (action: string, error: Error, context: any) => {
        const log = {
            timestamp: new Date().toISOString(),
            action: 'FOLDER_ERROR',
            operation: action,
            error: error.message,
            stack: error.stack,
            context
        };

        console.error('[FOLDER_ERROR]', JSON.stringify(log));

        // ✅ OPTION: Alerter l'équipe en production
        // if (process.env.NODE_ENV === 'production') {
        //   sendAlert(log);
        // }

        return log;
    },

    /**
     * Logger pour création de dossier
     */
    create: (folderId: string, folderName: string, parentId: string | null, userId: string) => {
        const log = {
            timestamp: new Date().toISOString(),
            action: 'FOLDER_CREATE',
            folderId,
            folderName,
            parentId: parentId || 'root',
            userId
        };

        console.log('[FOLDER_AUDIT]', JSON.stringify(log));

        return log;
    },

    /**
     * Logger pour suppression de dossier
     */
    delete: (folderId: string, folderName: string, userId: string) => {
        const log = {
            timestamp: new Date().toISOString(),
            action: 'FOLDER_DELETE',
            folderId,
            folderName,
            userId
        };

        console.log('[FOLDER_AUDIT]', JSON.stringify(log));

        return log;
    }
};
