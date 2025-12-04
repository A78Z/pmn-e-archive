/**
 * Folder Restoration Script for Lamine Badji
 * 
 * This script restores folders for lamine.dadji@pmn.sn by:
 * 1. Finding all folders that should belong to the user
 * 2. Fixing the created_by field
 * 3. Verifying folder-document relationships
 * 
 * Usage: 
 *   node restore-lamine-folders.js --dry-run  (preview changes)
 *   node restore-lamine-folders.js            (apply changes)
 */

const Parse = require('parse/node');
require('dotenv').config({ path: '.env.local' });

// Initialize Parse
Parse.initialize(
    process.env.NEXT_PUBLIC_PARSE_APP_ID,
    process.env.NEXT_PUBLIC_PARSE_JS_KEY,
    process.env.PARSE_MASTER_KEY
);
Parse.serverURL = process.env.NEXT_PUBLIC_PARSE_SERVER_URL;

const TARGET_EMAIL = 'lamine.dadji@pmn.sn';
const DRY_RUN = process.argv.includes('--dry-run');

async function restoreFolders() {
    console.log('🔧 Folder Restoration Script');
    console.log('='.repeat(80));
    console.log(`Target User: ${TARGET_EMAIL}`);
    console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes will be made)' : '✍️  LIVE MODE (changes will be applied)'}`);
    console.log('='.repeat(80));
    console.log('');

    try {
        // 1. Find the target user
        console.log(`👤 Looking for user: ${TARGET_EMAIL}...`);
        const userQuery = new Parse.Query(Parse.User);
        userQuery.equalTo('email', TARGET_EMAIL);
        const targetUser = await userQuery.first({ useMasterKey: true });

        if (!targetUser) {
            console.error(`❌ User not found: ${TARGET_EMAIL}`);
            console.log('\n💡 Please verify the email address is correct.');
            process.exit(1);
        }

        console.log(`✅ User found: ${targetUser.get('full_name')} (ID: ${targetUser.id})\n`);

        // 2. Get all folders
        console.log('📁 Fetching all folders...');
        const folderQuery = new Parse.Query('Folder');
        folderQuery.limit(10000);
        const allFolders = await folderQuery.find({ useMasterKey: true });
        console.log(`✅ Found ${allFolders.length} total folders\n`);

        // 3. Get all documents uploaded by user
        console.log('📄 Fetching user documents...');
        const docQuery = new Parse.Query('Document');
        docQuery.equalTo('uploaded_by', targetUser.id);
        docQuery.limit(10000);
        const userDocs = await docQuery.find({ useMasterKey: true });
        console.log(`✅ Found ${userDocs.length} documents uploaded by user\n`);

        // 4. Identify folders to restore
        console.log('🔍 Identifying folders to restore...\n');

        const foldersToRestore = [];
        const folderIdsFromDocs = new Set(
            userDocs
                .filter(d => d.get('folder_id'))
                .map(d => d.get('folder_id'))
        );

        // Find folders that:
        // a) Are referenced by user's documents but don't have correct created_by
        // b) Have no created_by (orphaned)
        for (const folder of allFolders) {
            const createdBy = folder.get('created_by');
            const folderId = folder.id;

            // Check if this folder is referenced by user's documents
            const isReferencedByUser = folderIdsFromDocs.has(folderId);

            // Check if folder has wrong or missing created_by
            const needsRestore = isReferencedByUser && createdBy !== targetUser.id;

            if (needsRestore) {
                foldersToRestore.push({
                    object: folder,
                    id: folderId,
                    name: folder.get('name'),
                    folder_number: folder.get('folder_number'),
                    current_owner: createdBy || 'NONE',
                    reason: isReferencedByUser ? 'Referenced by user documents' : 'Orphaned folder'
                });
            }
        }

        // 5. Display folders to restore
        console.log('='.repeat(80));
        console.log('📋 FOLDERS TO RESTORE');
        console.log('='.repeat(80));

        if (foldersToRestore.length === 0) {
            console.log('\n✅ No folders need restoration!');
            console.log('   All folders are correctly assigned.\n');
            process.exit(0);
        }

        console.log(`\nFound ${foldersToRestore.length} folders to restore:\n`);

        foldersToRestore.forEach((folder, index) => {
            console.log(`${index + 1}. ${folder.name}`);
            console.log(`   ID: ${folder.id}`);
            console.log(`   Number: ${folder.folder_number || 'N/A'}`);
            console.log(`   Current Owner: ${folder.current_owner}`);
            console.log(`   Reason: ${folder.reason}`);
            console.log('');
        });

        // 6. Apply changes (if not dry run)
        if (DRY_RUN) {
            console.log('='.repeat(80));
            console.log('🔍 DRY RUN COMPLETE');
            console.log('='.repeat(80));
            console.log('\n💡 To apply these changes, run:');
            console.log('   node restore-lamine-folders.js\n');
            process.exit(0);
        }

        // Confirm before proceeding
        console.log('='.repeat(80));
        console.log('⚠️  WARNING: About to modify database');
        console.log('='.repeat(80));
        console.log(`\nThis will update ${foldersToRestore.length} folders.`);
        console.log('Proceeding in 3 seconds...\n');

        await new Promise(resolve => setTimeout(resolve, 3000));

        // 7. Update folders
        console.log('✍️  Updating folders...\n');

        let successCount = 0;
        let errorCount = 0;

        for (const folder of foldersToRestore) {
            try {
                folder.object.set('created_by', targetUser.id);
                await folder.object.save(null, { useMasterKey: true });
                console.log(`✅ Updated: ${folder.name}`);
                successCount++;
            } catch (error) {
                console.error(`❌ Failed to update ${folder.name}:`, error.message);
                errorCount++;
            }
        }

        // 8. Summary
        console.log('\n' + '='.repeat(80));
        console.log('📊 RESTORATION SUMMARY');
        console.log('='.repeat(80));
        console.log(`Total folders processed: ${foldersToRestore.length}`);
        console.log(`Successfully updated: ${successCount}`);
        console.log(`Errors: ${errorCount}`);
        console.log('='.repeat(80));

        if (successCount > 0) {
            console.log('\n✅ Restoration complete!');
            console.log(`\n💡 Next steps:`);
            console.log(`   1. Ask ${TARGET_EMAIL} to log in and verify folders are visible`);
            console.log(`   2. Run investigation script again to confirm:`);
            console.log(`      node investigate-folders.js ${TARGET_EMAIL}`);
        }

    } catch (error) {
        console.error('\n❌ Fatal error during restoration:', error);
        process.exit(1);
    }
}

// Main execution
restoreFolders()
    .then(() => {
        console.log('\n✅ Script completed successfully!');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Script failed:', error);
        process.exit(1);
    });
