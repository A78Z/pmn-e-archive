/**
 * Script de configuration Back4App
 * Ce script crée toutes les classes nécessaires avec leurs schémas
 * 
 * IMPORTANT: Ce script doit être exécuté avec les droits Master Key
 * Vous devez l'exécuter depuis le Cloud Code de Back4App ou avec un script Node.js
 * utilisant la Master Key (ne jamais exposer la Master Key côté client!)
 */

// Configuration des schémas de classes
const schemas = {
    // User est une classe par défaut, on ajoute juste les champs personnalisés
    _User: {
        fields: {
            full_name: { type: 'String' },
            role: { type: 'String', defaultValue: 'user' },
            department: { type: 'String' },
            is_active: { type: 'Boolean', defaultValue: true },
            is_verified: { type: 'Boolean', defaultValue: false },
            fonction: { type: 'String' },
            assigned_zone: { type: 'String' },
            last_login: { type: 'Date' },
            admin_notes: { type: 'String' }
        }
    },

    Document: {
        fields: {
            name: { type: 'String', required: true },
            category: { type: 'String', required: true },
            file: { type: 'File' },
            size: { type: 'Number' },
            uploaded_by: { type: 'String', required: true },
            folder_id: { type: 'String' }
        },
        classLevelPermissions: {
            find: { '*': true },
            get: { '*': true },
            create: { '*': true },
            update: { '*': true },
            delete: { '*': true }
        }
    },

    Folder: {
        fields: {
            name: { type: 'String', required: true },
            created_by: { type: 'String', required: true },  // ✅ OBLIGATOIRE - Empêche dossiers orphelins
            parent_id: { type: 'String' },  // null = root level
            folder_number: { type: 'String' },  // Numéro de dossier (optionnel)
            order: { type: 'Number', defaultValue: 0 },  // ✅ NOUVEAU - Pour persister le réordonnancement
            last_moved_at: { type: 'Date' },  // ✅ NOUVEAU - Métadonnées de traçabilité
            last_moved_by: { type: 'String' }  // ✅ NOUVEAU - Qui a déplacé le dossier
        },
        classLevelPermissions: {
            find: { '*': true },
            get: { '*': true },
            create: { '*': true },
            update: { '*': true },
            delete: { '*': true }
        },
        // ✅ NOUVEAU - Indexes pour performance
        indexes: {
            created_by_1: { created_by: 1 },
            parent_id_1: { parent_id: 1 },
            order_1: { order: 1 }
        }
    },

    Share: {
        fields: {
            document_id: { type: 'String' },
            folder_id: { type: 'String' },
            shared_by: { type: 'String', required: true },
            shared_with: { type: 'String' },
            token: { type: 'String' },
            can_read: { type: 'Boolean', defaultValue: true },
            can_write: { type: 'Boolean', defaultValue: false },
            can_delete: { type: 'Boolean', defaultValue: false },
            can_share: { type: 'Boolean', defaultValue: false },
            is_link_share: { type: 'Boolean', defaultValue: false },
            expires_at: { type: 'Date' }
        },
        classLevelPermissions: {
            find: { '*': true },
            get: { '*': true },
            create: { '*': true },
            update: { '*': true },
            delete: { '*': true }
        }
    },

    Message: {
        fields: {
            sender_id: { type: 'String', required: true },
            receiver_id: { type: 'String', required: true },
            content: { type: 'String', required: true },
            type: { type: 'String', defaultValue: 'text' },
            read: { type: 'Boolean', defaultValue: false }
        },
        classLevelPermissions: {
            find: { '*': true },
            get: { '*': true },
            create: { '*': true },
            update: { '*': true },
            delete: { '*': true }
        }
    },

    Channel: {
        fields: {
            name: { type: 'String', required: true },
            description: { type: 'String' },
            type: { type: 'String', defaultValue: 'public' },
            created_by: { type: 'String', required: true }
        },
        classLevelPermissions: {
            find: { '*': true },
            get: { '*': true },
            create: { '*': true },
            update: { '*': true },
            delete: { '*': true }
        }
    },

    ChannelMember: {
        fields: {
            channel_id: { type: 'String', required: true },
            user_id: { type: 'String', required: true },
            role: { type: 'String', defaultValue: 'member' }
        },
        classLevelPermissions: {
            find: { '*': true },
            get: { '*': true },
            create: { '*': true },
            update: { '*': true },
            delete: { '*': true }
        }
    },

    AccessRequest: {
        fields: {
            document_id: { type: 'String', required: true },
            requested_by: { type: 'String', required: true },
            status: { type: 'String', defaultValue: 'pending' },
            reviewed_by: { type: 'String' },
            reviewed_at: { type: 'Date' },
            reason: { type: 'String' },
            requested_permissions: { type: 'Object' },
            rejection_reason: { type: 'String' }
        },
        classLevelPermissions: {
            find: { '*': true },
            get: { '*': true },
            create: { '*': true },
            update: { '*': true },
            delete: { '*': true }
        }
    }
};

console.log('📋 Schémas de classes définis');
console.log('');
console.log('⚠️  IMPORTANT: Pour créer ces classes dans Back4App:');
console.log('');
console.log('Option 1 - Via Dashboard (Recommandé):');
console.log('1. Allez sur https://dashboard.back4app.com/');
console.log('2. Sélectionnez votre application');
console.log('3. Allez dans "Database" > "Browser"');
console.log('4. Cliquez sur "Create a class" pour chaque classe');
console.log('5. Ajoutez les colonnes selon le schéma ci-dessus');
console.log('');
console.log('Option 2 - Via Cloud Code:');
console.log('1. Copiez le code des Cloud Functions depuis MIGRATION_GUIDE.md');
console.log('2. Allez dans "Cloud Code" > "Functions"');
console.log('3. Collez le code dans main.js');
console.log('4. Déployez');
console.log('');
console.log('Classes à créer:');
Object.keys(schemas).forEach(className => {
    console.log(`  - ${className}`);
});

module.exports = schemas;
