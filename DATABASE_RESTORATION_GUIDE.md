# Database Investigation and Restoration - Setup Guide

## Prerequisites

The investigation and restoration scripts require the **Parse Master Key** to access all folders in the database.

### Adding Master Key to .env.local

Add the following line to your `.env.local` file:

```env
PARSE_MASTER_KEY=your_master_key_here
```

You can find your Master Key in the Back4App dashboard:
1. Go to https://dashboard.back4app.com/
2. Select your application
3. Go to **App Settings** → **Security & Keys**
4. Copy the **Master Key**

### Running the Scripts

Once the Master Key is configured:

```bash
# 1. Investigate folders for a specific user
node investigate-folders.js lamine.dadji@pmn.sn

# 2. Restore folders (dry run first)
node restore-lamine-folders.js --dry-run

# 3. Apply restoration
node restore-lamine-folders.js
```

## Alternative: Manual Database Check

If you don't have access to the Master Key, you can check the database manually:

1. Go to Back4App Dashboard → Database → Browser
2. Select the `Folder` class
3. Look for folders where:
   - `created_by` is empty/null (orphaned folders)
   - `created_by` doesn't match the expected user ID
4. Find the user ID for `lamine.dadji@pmn.sn`:
   - Go to `_User` class
   - Search for email: `lamine.dadji@pmn.sn`
   - Copy the `objectId`
5. Update orphaned folders manually:
   - Set `created_by` to the user's `objectId`

## What the Scripts Do

### investigate-folders.js
- Queries all folders in the database
- Identifies folders belonging to the specified user
- Lists orphaned folders (missing `created_by`)
- Checks document-folder relationships
- Generates a detailed report

### restore-lamine-folders.js
- Finds folders that should belong to the user
- Identifies folders referenced by user's documents
- Fixes the `created_by` field
- Provides dry-run mode for safety
- Generates restoration report

## Code Fixes Already Applied

The following code changes have been deployed to fix the folder visibility issue:

1. **FolderHelpers.getAllByUser(userId)** - Fetches folders for specific user
2. **FolderHelpers.getAllForAdmin()** - Fetches all folders (admin only)
3. **Documents Page** - Now filters folders by current user
4. **Upload Page** - Shows only user's folders in dropdown

These fixes will prevent the issue from recurring, but existing data may need restoration via the scripts above.
