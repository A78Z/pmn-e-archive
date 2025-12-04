/**
 * VALIDATIONS CLOUD CODE - Back4App
 * Ces validations s'exécutent AVANT toute modification en base
 * 
 * DÉPLOIEMENT:
 * 1. Copier ce fichier dans Back4App Dashboard → Cloud Code
 * 2. Ou déployer via Parse CLI: parse deploy
 * 
 * IMPORTANT: Ces validations garantissent l'intégrité des données
 * et empêchent les bugs de régression
 */

// ✅ VALIDATION 1: Empêcher la perte du created_by
Parse.Cloud.beforeSave('Folder', async (request) => {
    const folder = request.object;

    // Vérifier que created_by est toujours présent
    if (!folder.get('created_by')) {
        throw new Parse.Error(
            Parse.Error.VALIDATION_ERROR,
            'Le champ created_by est obligatoire. Un dossier ne peut pas être orphelin.'
        );
    }

    // Si c'est une modification, empêcher la modification du created_by
    if (!folder.isNew() && folder.dirtyKeys().includes('created_by')) {
        const original = await new Parse.Query('Folder').get(folder.id, { useMasterKey: true });
        if (original.get('created_by') !== folder.get('created_by')) {
            throw new Parse.Error(
                Parse.Error.VALIDATION_ERROR,
                'Le propriétaire d\'un dossier ne peut pas être modifié.'
            );
        }
    }

    // Enregistrer les métadonnées de déplacement
    if (folder.dirtyKeys().includes('parent_id')) {
        folder.set('last_moved_at', new Date());
        if (request.user) {
            folder.set('last_moved_by', request.user.id);
        }
    }
});

// ✅ VALIDATION 2: Empêcher les cycles dans la hiérarchie
Parse.Cloud.beforeSave('Folder', async (request) => {
    const folder = request.object;
    const newParentId = folder.get('parent_id');

    if (!newParentId || folder.isNew()) {
        return; // Pas de parent ou nouveau dossier
    }

    // Vérifier qu'on ne crée pas un cycle
    const checkCycle = async (parentId, targetId, depth = 0) => {
        if (depth > 50) {
            throw new Parse.Error(
                Parse.Error.VALIDATION_ERROR,
                'Hiérarchie trop profonde (max 50 niveaux)'
            );
        }

        if (parentId === targetId) {
            return true; // Cycle détecté
        }

        try {
            const parent = await new Parse.Query('Folder').get(parentId, { useMasterKey: true });
            const grandParentId = parent.get('parent_id');

            if (!grandParentId) {
                return false; // Pas de cycle
            }

            return await checkCycle(grandParentId, targetId, depth + 1);
        } catch (e) {
            // Parent n'existe pas
            return false;
        }
    };

    const hasCycle = await checkCycle(newParentId, folder.id);
    if (hasCycle) {
        throw new Parse.Error(
            Parse.Error.VALIDATION_ERROR,
            'Impossible de déplacer un dossier dans un de ses sous-dossiers'
        );
    }
});

// ✅ VALIDATION 3: Logger toutes les modifications
Parse.Cloud.afterSave('Folder', async (request) => {
    const folder = request.object;

    if (folder.dirtyKeys().includes('parent_id')) {
        console.log('[FOLDER_AUDIT] Folder moved');
        console.log(`  - ID: ${folder.id}`);
        console.log(`  - Name: ${folder.get('name')}`);
        console.log(`  - New parent: ${folder.get('parent_id') || 'root'}`);
        console.log(`  - Owner: ${folder.get('created_by')}`);
        console.log(`  - Moved by: ${folder.get('last_moved_by') || 'unknown'}`);
        console.log(`  - Timestamp: ${folder.get('last_moved_at')}`);
    }

    if (folder.dirtyKeys().includes('order')) {
        console.log('[FOLDER_AUDIT] Folder reordered');
        console.log(`  - ID: ${folder.id}`);
        console.log(`  - Name: ${folder.get('name')}`);
        console.log(`  - New order: ${folder.get('order')}`);
        console.log(`  - Owner: ${folder.get('created_by')}`);
    }
});

// ✅ VALIDATION 4: Empêcher la suppression si le dossier a des enfants
Parse.Cloud.beforeDelete('Folder', async (request) => {
    const folder = request.object;

    // Vérifier s'il y a des sous-dossiers
    const subFoldersQuery = new Parse.Query('Folder');
    subFoldersQuery.equalTo('parent_id', folder.id);
    const subFoldersCount = await subFoldersQuery.count({ useMasterKey: true });

    if (subFoldersCount > 0) {
        throw new Parse.Error(
            Parse.Error.VALIDATION_ERROR,
            `Impossible de supprimer ce dossier car il contient ${subFoldersCount} sous-dossier(s). Veuillez d'abord supprimer ou déplacer les sous-dossiers.`
        );
    }

    // Vérifier s'il y a des documents
    const documentsQuery = new Parse.Query('Document');
    documentsQuery.equalTo('folder_id', folder.id);
    const documentsCount = await documentsQuery.count({ useMasterKey: true });

    if (documentsCount > 0) {
        throw new Parse.Error(
            Parse.Error.VALIDATION_ERROR,
            `Impossible de supprimer ce dossier car il contient ${documentsCount} document(s). Veuillez d'abord supprimer ou déplacer les documents.`
        );
    }
});

// ✅ CLOUD FUNCTION: Health Check
Parse.Cloud.define('folderHealthCheck', async (request) => {
    const { useMasterKey } = request;

    if (!useMasterKey) {
        throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Master key required');
    }

    // Récupérer tous les dossiers
    const query = new Parse.Query('Folder');
    query.limit(10000);
    const allFolders = await query.find({ useMasterKey: true });

    // Vérifier les dossiers orphelins (sans created_by)
    const orphans = allFolders.filter(f => !f.get('created_by'));

    // Vérifier les liens cassés (parent_id inexistant)
    const folderIds = new Set(allFolders.map(f => f.id));
    const brokenLinks = allFolders.filter(f => {
        const parentId = f.get('parent_id');
        return parentId && !folderIds.has(parentId);
    });

    // Vérifier les cycles (simplifié)
    let hasCycles = false;
    // TODO: Implémenter détection complète des cycles

    return {
        status: orphans.length === 0 && brokenLinks.length === 0 && !hasCycles ? 'healthy' : 'unhealthy',
        totalFolders: allFolders.length,
        orphanFolders: orphans.length,
        orphanIds: orphans.map(f => f.id),
        brokenLinks: brokenLinks.length,
        brokenLinkIds: brokenLinks.map(f => ({ id: f.id, parent_id: f.get('parent_id') })),
        hasCycles,
        timestamp: new Date().toISOString()
    };
});
