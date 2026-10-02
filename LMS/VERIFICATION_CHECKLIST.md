# Shareable Links Feature - Verification Checklist

## Pre-Deployment Testing

### ✅ Model & Schema Tests
- [ ] School model has `slug` field with correct configuration
- [ ] Classroom model has `slug` field with correct configuration
- [ ] Both models have pre-save hooks for slug generation
- [ ] Slug field is indexed in database
- [ ] Slug field has unique constraint (with sparse option)

### ✅ Backend Route Tests
```bash
# Test school lookup by slug
curl http://localhost:5000/api/schools/public/my-school
# Should return: { school: {...}, classrooms: [...] }

# Test classroom lookup by slug  
curl http://localhost:5000/api/classrooms/public/mathematics-101
# Should return: { classroom: {...} }

# Test backward compatibility with shortCode
curl http://localhost:5000/api/schools/public/a1b2c3d4
# Should still work if shortCode exists

# Test backward compatibility with ID
curl http://localhost:5000/api/schools/public/{mongoId}
# Should still work with ObjectId
```

### ✅ Database Tests
```javascript
// Check if slug is generated on create
db.schools.findOne({ name: "Test School" })
// Should have: slug: "test-school"

// Check if duplicate names get numbered
db.schools.find({ slug: /^test-school/ })
// Should return: "test-school", "test-school-2", "test-school-3", etc.

// Check if shortCode still exists
db.schools.findOne()
// Should have both: slug and shortCode
```

## Functional Testing

### ✅ School Tests
- [ ] Create new school → Verify slug is generated
- [ ] Edit school name → Verify slug updates
- [ ] Create duplicate school name → Verify automatic numbering
- [ ] View SchoolDetail page → Verify shareable link shows slug
- [ ] Copy school link → Verify link format is `/s/slug-name`
- [ ] Open school link in new tab → Verify page loads
- [ ] Test with old shortCode URL → Verify still works

### ✅ Classroom Tests
- [ ] Create new classroom → Verify slug is generated
- [ ] Edit classroom name → Verify slug updates
- [ ] Create duplicate classroom name → Verify automatic numbering
- [ ] View ClassroomDetail → Verify share button uses slug
- [ ] Share classroom → Copy link and verify format
- [ ] Open shared classroom link → Verify page loads
- [ ] Test with old shortCode URL → Verify still works

### ✅ Public Pages Tests
- [ ] Open PublicSchool page with slug → Should load
- [ ] Open PublicSchool page with shortCode → Should load (backward compat)
- [ ] Open PublicSchool page → Classroom links use slug
- [ ] Click classroom link from PublicSchool → Should navigate to PublicClassroom
- [ ] Open PublicClassroom page with slug → Should load
- [ ] Open PublicClassroom page with shortCode → Should load (backward compat)

### ✅ Special Characters Tests
Create schools/classrooms with these names and verify slug generation:
- [ ] "Physics 101" → `physics-101`
- [ ] "St. Mary's School" → `st-marys-school`
- [ ] "ABC-XYZ Academy" → `abc-xyz-academy`
- [ ] "Advanced Calculus (2024)" → `advanced-calculus-2024`
- [ ] "Math@Science" → `mathscience`
- [ ] "Multiple   Spaces" → `multiple-spaces`

### ✅ Edge Cases Tests
- [ ] Very long school name (100+ chars) → Should truncate reasonably
- [ ] School name with only special characters → Should handle gracefully
- [ ] Rapid duplicate creation → Should handle numbering correctly
- [ ] Update school name to existing slug → Should renumber if conflict

## Migration Testing (if applicable)

### ✅ Run Migration Script
```bash
cd backend
node migrate-slugs.js
```
- [ ] Script starts and connects to database
- [ ] Shows number of schools without slugs
- [ ] Shows number of classrooms without slugs
- [ ] Successfully generates slugs for all
- [ ] Displays generated slugs in console
- [ ] Completes without errors
- [ ] No data is lost or corrupted

### ✅ Verify Migration Results
```javascript
// Check all schools have slugs
db.schools.find({ $or: [{ slug: null }, { slug: { $exists: false } }] }).count()
// Should return: 0

// Check all classrooms have slugs
db.classrooms.find({ $or: [{ slug: null }, { slug: { $exists: false } }] }).count()
// Should return: 0
```

## Performance Testing

### ✅ Query Performance
- [ ] Schema has indexes on slug field
- [ ] Schema has indexes on shortCode field
- [ ] Query by slug is fast (< 50ms)
- [ ] Query by shortCode still works fast
- [ ] Query by ID still works fast
- [ ] No N+1 query problems

### ✅ URL Generation Performance
- [ ] Slug generation completes in < 100ms
- [ ] No timeout issues with uniqueness check
- [ ] Concurrent creates don't cause duplicates

## Frontend Visual Tests

### ✅ UI Elements
- [ ] SchoolDetail shareable link display looks correct
- [ ] Link is clickable/copyable
- [ ] ClassroomDetail share button works
- [ ] Copied link uses slug format
- [ ] PublicSchool shows classroom links
- [ ] Links are properly formatted and readable

## Security Tests

### ✅ Access Control
- [ ] Public school URL accessible to anyone
- [ ] Public classroom URL accessible to anyone
- [ ] Private classroom still inaccessible via public link
- [ ] Slug enumeration attack not possible (slugs are predictable from names)
- [ ] No information leakage through URLs

## Documentation Tests

### ✅ Documentation
- [ ] SLUG_IMPLEMENTATION.md is complete
- [ ] SLUG_FEATURE_SUMMARY.md is clear
- [ ] Migration script is documented
- [ ] Code comments explain slug generation
- [ ] API documentation updated

## Rollback Plan (if needed)

- [ ] Can disable slug lookup (set to shortCode → ID priority)
- [ ] All old URLs remain functional
- [ ] No database rollback needed (backward compatible)
- [ ] Zero downtime rollback possible

## Post-Deployment Monitoring

### ✅ Logs to Monitor
- [ ] Check for slug generation errors
- [ ] Monitor for duplicate slug attempts
- [ ] Track URL resolution (which method: slug/shortCode/ID)
- [ ] Watch for 404 errors on public pages

### ✅ Metrics to Track
- [ ] % of users accessing via slug vs shortCode
- [ ] Time to generate slugs
- [ ] Duplicate name frequency
- [ ] Public link access patterns

## Success Criteria

✅ All checks pass
✅ No errors in console or logs
✅ Old URLs work (backward compatible)
✅ New URLs work (slug-based)
✅ Performance is acceptable
✅ No data corruption
✅ Users can access school/classroom via new URLs
