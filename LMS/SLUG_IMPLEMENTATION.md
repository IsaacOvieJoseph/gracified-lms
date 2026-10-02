# User-Friendly Shareable Links Implementation

## Overview
Schools and classrooms now have user-friendly shareable links based on their names instead of random codes.

**Examples:**
- School: `https://lms.com/s/my-school` instead of `https://lms.com/s/a1b2c3d4`
- Classroom: `https://lms.com/c/mathematics-101` instead of `https://lms.com/c/e5f6g7h8`

## How It Works

### Slug Generation
1. **Name-based**: Slugs are generated from school/classroom names
2. **Format**: Lowercase, hyphens for spaces, no special characters
3. **Uniqueness**: If a slug already exists, a number suffix is added (e.g., `mathematics-101-2`)

### URL Resolution Priority
When accessing a link, the system tries these in order:
1. **Slug** (e.g., `my-school`) - New format, user-friendly
2. **ShortCode** (e.g., `a1b2c3d4`) - Old format, still works for backward compatibility
3. **ID** (e.g., ObjectId) - Fallback for direct ID access

### Backward Compatibility
✅ Old shortCode-based URLs still work
✅ Old ID-based URLs still work
✅ No breaking changes to API

## Database Changes

### School Model
- Added `slug` field (string, unique, indexed)
- Auto-generated in pre-save hook
- Kept existing `shortCode` field for backward compatibility

### Classroom Model
- Added `slug` field (string, unique, indexed)
- Auto-generated in pre-save hook
- Kept existing `shortCode` field for backward compatibility

## API Changes

### School Public Endpoint
- **Route**: `GET /api/schools/public/:identifier`
- **Identifier can be**: slug, shortCode, or ID
- **Returns**: School data including slug field

### Classroom Public Endpoint
- **Route**: `GET /api/classrooms/public/:identifier`
- **Identifier can be**: slug, shortCode, or ID
- **Returns**: Classroom data including slug field

## Frontend Changes

### URL Display Updates
1. **SchoolDetail.jsx**: Shows school slug in shareable link
2. **ClassroomDetail.jsx**: Shows classroom slug when sharing
3. **PublicSchool.jsx**: Links to classrooms use slug

### Route Parameters
- School route: `/s/:identifier` (accepts slug, shortCode, or ID)
- Classroom route: `/c/:shortCode` (parameter name unchanged, works with slug/shortCode/ID)

## Migration

### For New Data
- Slugs are automatically generated when schools/classrooms are created or updated

### For Existing Data
Run the migration script to backfill slugs for existing schools/classrooms:

```bash
cd backend
node migrate-slugs.js
```

This script will:
1. Find all schools without slugs and generate them
2. Find all classrooms without slugs and generate them
3. Handle uniqueness conflicts automatically
4. Log all changes for verification

## Testing Checklist

- [ ] Create a new school and verify the slug is user-friendly
- [ ] Create a new classroom and verify the slug is user-friendly
- [ ] Test duplicate name handling (create two schools with same name)
- [ ] Verify old shortCode URLs still work
- [ ] Verify old ID-based URLs still work
- [ ] Share a classroom and copy the new slug-based link
- [ ] Open the slug-based link in a new tab
- [ ] Test PublicSchool page links to classrooms
- [ ] Run migration script on staging/production database
- [ ] Verify all existing schools/classrooms got slugs

## Slug Format Examples

| School Name | Generated Slug |
|---|---|
| My School | `my-school` |
| Harvard University | `harvard-university` |
| St. Mary's Academy | `st-marys-academy` |
| ABC-123 School | `abc-123-school` |
| My School (duplicate) | `my-school-2` |

## Troubleshooting

### Slug Not Generated
- Ensure the pre-save hooks are properly defined in models
- Check that the database has the new `slug` field indexed
- Run migration script for existing data

### URL Not Resolving
- Check that identifier lookup order is: slug → shortCode → ID
- Verify slugs are stored in lowercase in database
- Check URL encoding (special characters should be URL-encoded)

### Special Characters
- Slugs should only contain alphanumeric characters and hyphens
- Special characters are automatically removed during slug generation
- Spaces are converted to hyphens

## Future Enhancements

- [ ] Admin dashboard to view/edit slugs
- [ ] Slug collision detection and alerts
- [ ] Slug analytics (which links are most accessed)
- [ ] Customizable slugs (allow admins to set their own)
- [ ] Slug history tracking (previous slugs for redirects)
