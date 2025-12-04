/**
 * Folder Investigation Script
 * 
 * This script investigates the folder structure in Back4App to identify:
 * - All folders in the database
 * - Folders belonging to specific users
 * - Orphaned folders (missing created_by)
 * - Folder-document relationships
 * 
 * Usage: node investigate-folders.js [email]
 * Example: node investigate-folders.js lamine.dadji@pmn.sn
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

async function investigateFolders(userEmail) {
    console.log('🔍 Starting Folder Investigation...\n');
    console.log('='.repeat(80));

    try {
        // 1. Get all folders
        console.log('\n📁 Fetching all folders from database...');
        const folderQuery = new Parse.Query('Folder');
        folderQuery.limit(10000);
        const allFolders = await folderQuery.find({ useMasterKey: true });

        console.log(`✅ Found ${allFolders.length} total folders in database\n`);

        // 2. Find user if email provided
        let targetUser = null;
        if (userEmail) {
            console.log(`👤 Looking for user: ${userEmail}...`);
            const userQuery = new Parse.Query(Parse.User);
            userQuery.equalTo('email', userEmail);
            targetUser = await userQuery.first({ useMasterKey: true });

            if (targetUser) {
                console.log(`✅ User found: ${targetUser.get('full_name')} (ID: ${targetUser.id})`);
                console.log(`   Role: ${targetUser.get('role')}`);
                console.log(`   Active: ${targetUser.get('is_active')}`);
                console.log(`   Verified: ${targetUser.get('is_verified')}\n`);
            } else {
                console.log(`❌ User not found: ${userEmail}\n`);
            }
        }

        // 3. Categorize folders
        const userFolders = [];
        const orphanedFolders = [];
        const otherFolders = [];

        for (const folder of allFolders) {
            const createdBy = folder.get('created_by');
            const folderData = {
                id: folder.id,
                name: folder.get('name'),
                folder_number: folder.get('folder_number'),
                created_by: createdBy,
                parent_id: folder.get('parent_id'),
                category: folder.get('category'),
                status: folder.get('status'),
                createdAt: folder.get('createdAt')
            };

            if (!createdBy) {
                orphanedFolders.push(folderData);
            } else if (targetUser && createdBy === targetUser.id) {
                userFolders.push(folderData);
            } else {
                otherFolders.push(folderData);
            }
        }

        // 4. Display results
        console.log('='.repeat(80));
        console.log('📊 INVESTIGATION RESULTS');
        console.log('='.repeat(80));

        if (targetUser) {
            console.log(`\n✅ Folders belonging to ${userEmail}:`);
            console.log(`   Total: ${userFolders.length} folders\n`);

            if (userFolders.length > 0) {
                userFolders.forEach((folder, index) => {
                    console.log(`   ${index + 1}. ${folder.name}`);
                    console.log(`      ID: ${folder.id}`);
                    console.log(`      Number: ${folder.folder_number || 'N/A'}`);
                    console.log(`      Category: ${folder.category || 'N/A'}`);
                    console.log(`      Parent: ${folder.parent_id || 'ROOT'}`);
                    console.log(`      Created: ${folder.createdAt}`);
                    console.log('');
                });
            } else {
                console.log('   ⚠️  No folders found for this user!\n');
            }
        }

        console.log(`\n⚠️  Orphaned Folders (missing created_by):`);
        console.log(`   Total: ${orphanedFolders.length} folders\n`);

        if (orphanedFolders.length > 0) {
            orphanedFolders.forEach((folder, index) => {
                console.log(`   ${index + 1}. ${folder.name}`);
                console.log(`      ID: ${folder.id}`);
                console.log(`      Number: ${folder.folder_number || 'N/A'}`);
                console.log(`      Created: ${folder.createdAt}`);
                console.log('');
            });
        }

        console.log(`\n📂 Other Folders:`);
        console.log(`   Total: ${otherFolders.length} folders\n`);

        // 5. Check documents for user
        if (targetUser) {
            console.log('='.repeat(80));
            console.log('📄 Checking documents...\n');

            const docQuery = new Parse.Query('Document');
            docQuery.equalTo('uploaded_by', targetUser.id);
            docQuery.limit(10000);
            const userDocs = await docQuery.find({ useMasterKey: true });

            console.log(`✅ Found ${userDocs.length} documents uploaded by ${userEmail}\n`);

            if (userDocs.length > 0) {
                const docsInFolders = userDocs.filter(d => d.get('folder_id'));
                const docsAtRoot = userDocs.filter(d => !d.get('folder_id'));

                console.log(`   - In folders: ${docsInFolders.length}`);
                console.log(`   - At root: ${docsAtRoot.length}\n`);

                // Check if documents reference folders that don't exist
                const folderIds = new Set(userFolders.map(f => f.id));
                const orphanedDocs = docsInFolders.filter(d => !folderIds.has(d.get('folder_id')));

                if (orphanedDocs.length > 0) {
                    console.log(`   ⚠️  ${orphanedDocs.length} documents reference folders that don't belong to user:\n`);
                    orphanedDocs.forEach((doc, index) => {
                        console.log(`      ${index + 1}. ${doc.get('name')}`);
                        console.log(`         Folder ID: ${doc.get('folder_id')}`);
                        console.log('');
                    });
                }
            }
        }

        // 6. Summary
        console.log('='.repeat(80));
        console.log('📋 SUMMARY');
        console.log('='.repeat(80));
        console.log(`Total folders in database: ${allFolders.length}`);
        if (targetUser) {
            console.log(`Folders for ${userEmail}: ${userFolders.length}`);
        }
        console.log(`Orphaned folders: ${orphanedFolders.length}`);
        console.log(`Other folders: ${otherFolders.length}`);
        console.log('='.repeat(80));

        // 7. Recommendations
        console.log('\n💡 RECOMMENDATIONS\n');

        if (targetUser && userFolders.length === 0) {
            console.log('⚠️  User has no folders! Possible causes:');
            console.log('   1. Folders were created with wrong created_by value');
            console.log('   2. Folders were deleted');
            console.log('   3. Migration issue caused data loss');
            console.log('\n   → Check orphaned folders for potential matches');
            console.log('   → Run restore script if folders found\n');
        }

        if (orphanedFolders.length > 0) {
            console.log('⚠️  Orphaned folders detected!');
            console.log('   → These folders have no owner (created_by is null)');
            console.log('   → Review and assign to correct users\n');
        }

    } catch (error) {
        console.error('❌ Error during investigation:', error);
        process.exit(1);
    }
}

// Main execution
const userEmail = process.argv[2];

if (!userEmail) {
    console.log('Usage: node investigate-folders.js <user-email>');
    console.log('Example: node investigate-folders.js lamine.dadji@pmn.sn');
    process.exit(1);
}

investigateFolders(userEmail)
    .then(() => {
        console.log('\n✅ Investigation complete!');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
