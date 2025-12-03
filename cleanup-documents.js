/**
 * Script de nettoyage de la base de données
 * Supprime tous les documents et leurs fichiers associés
 * 
 * Usage: node cleanup-documents.js
 */

const Parse = require('parse/node');

// Configuration Parse
Parse.initialize(
    process.env.NEXT_PUBLIC_PARSE_APP_ID || 'YOUR_APP_ID',
    process.env.NEXT_PUBLIC_PARSE_JS_KEY || 'YOUR_JS_KEY'
);
Parse.serverURL = process.env.NEXT_PUBLIC_PARSE_SERVER_URL || 'https://parseapi.back4app.com';

async function cleanupDocuments() {
    try {
        console.log('🔍 Récupération de tous les documents...');

        const query = new Parse.Query('Document');
        query.limit(1000); // Limite à 1000 documents
        const documents = await query.find();

        console.log(`📄 ${documents.length} documents trouvés`);

        if (documents.length === 0) {
            console.log('✅ Aucun document à supprimer');
            return;
        }

        let deletedFiles = 0;
        let deletedDocs = 0;
        let errors = 0;

        for (const doc of documents) {
            try {
                const docName = doc.get('name') || 'Sans nom';
                console.log(`🗑️  Suppression: ${docName}`);

                // Supprimer le fichier physique
                const file = doc.get('file');
                if (file && file._name) {
                    try {
                        await file.destroy();
                        deletedFiles++;
                        console.log(`   ✓ Fichier supprimé: ${file._name}`);
                    } catch (fileError) {
                        console.warn(`   ⚠️  Erreur fichier: ${fileError.message}`);
                    }
                }

                // Supprimer le document
                await doc.destroy();
                deletedDocs++;
                console.log(`   ✓ Document supprimé`);

            } catch (error) {
                errors++;
                console.error(`   ❌ Erreur: ${error.message}`);
            }
        }

        console.log('\n📊 Résumé:');
        console.log(`   - Documents supprimés: ${deletedDocs}`);
        console.log(`   - Fichiers supprimés: ${deletedFiles}`);
        console.log(`   - Erreurs: ${errors}`);
        console.log('\n✅ Nettoyage terminé!');

    } catch (error) {
        console.error('❌ Erreur lors du nettoyage:', error);
        process.exit(1);
    }
}

// Exécuter le nettoyage
cleanupDocuments()
    .then(() => {
        console.log('\n🎉 Script terminé avec succès!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Erreur fatale:', error);
        process.exit(1);
    });
