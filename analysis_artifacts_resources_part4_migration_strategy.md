# Artifacts/Resources Analysis - Part 4: Migration Strategy

## Overview

Migration strategy to convert all 17 top-level graph components to artifacts, and all related tables to resources.

## Migration Phases

### Phase 1: Prepare Artifacts Enum

1. **Add new artifacts to enum**:
   ```sql
   ALTER TYPE artifacts ADD VALUE 'cohort';
   ALTER TYPE artifacts ADD VALUE 'simulation';
   ALTER TYPE artifacts ADD VALUE 'persona';
   ALTER TYPE artifacts ADD VALUE 'parameter';
   ALTER TYPE artifacts ADD VALUE 'field';
   ALTER TYPE artifacts ADD VALUE 'model';
   ALTER TYPE artifacts ADD VALUE 'eval';
   ALTER TYPE artifacts ADD VALUE 'department';
   ALTER TYPE artifacts ADD VALUE 'provider';
   ALTER TYPE artifacts ADD VALUE 'auth';
   ALTER TYPE artifacts ADD VALUE 'key';
   ALTER TYPE artifacts ADD VALUE 'setting';
   ALTER TYPE artifacts ADD VALUE 'profile';
   ```

2. **Resolve field conflict**:
   - Rename existing `field` resource to `document_field`
   - Update all references to `'field'::resources` to `'document_field'::resources`

### Phase 2: Add Resources to Enum

Add all new resources to the `resources` enum. This is a large operation - estimate ~200+ new resources.

**Note**: PostgreSQL doesn't support adding multiple enum values in one statement, so this will require many `ALTER TYPE` statements.

**Alternative**: Drop and recreate the enum (requires downtime):
```sql
-- 1. Create new enum with all values
CREATE TYPE resources_new AS ENUM (...all values...);

-- 2. Update all columns to use new enum
ALTER TABLE resource_schemas ALTER COLUMN resource TYPE resources_new USING resource::text::resources_new;
ALTER TABLE resource_tools ALTER COLUMN resource TYPE resources_new USING resource::text::resources_new;

-- 3. Drop old enum and rename new one
DROP TYPE resources;
ALTER TYPE resources_new RENAME TO resources;
```

### Phase 3: Update Domains Table

The `domains` table already supports the artifacts enum, so no changes needed. New artifacts will automatically work with domains.

### Phase 4: Update Resource Schemas and Resource Tools

Add entries to `resource_schemas` and `resource_tools` for new resources as needed.

### Phase 5: Update Application Code

1. **Update SQL queries** to use new artifact/resource enum values
2. **Update API endpoints** to handle new artifacts
3. **Update type definitions** (TypeScript, Python) to include new enum values

## Challenges

### 1. Enum Value Addition Limitation

PostgreSQL doesn't support adding multiple enum values in one transaction easily. Options:
- Add one at a time (slow but safe)
- Drop and recreate enum (faster but requires downtime)

### 2. Large Number of Resources

~200+ new resources need to be added. This is a massive enum.

**Consideration**: Should resources be a table instead of an enum?
- **Pros**: Easier to add new resources, no enum limitations
- **Cons**: Loses type safety, requires JOINs

### 3. Backward Compatibility

Existing code references artifacts/resources as enums. Need to ensure:
- All SQL queries updated
- All application code updated
- All migrations tested

### 4. Data Migration

No data migration needed for artifacts/resources themselves (they're enums, not data). But need to:
- Update all references in code
- Update all SQL queries
- Test thoroughly

## Estimated Effort

- **Phase 1** (Add artifacts): 1-2 days
- **Phase 2** (Add resources): 3-5 days (due to enum limitations)
- **Phase 3** (Update domains): 0 days (no changes needed)
- **Phase 4** (Update resource tables): 1-2 days
- **Phase 5** (Update application code): 2-4 weeks
- **Testing**: 1-2 weeks

**Total**: ~4-6 weeks

## Recommendations

1. **Consider table-based resources**: Instead of enum, use a `resources` table with `artifact_id` foreign key
2. **Phased rollout**: Add artifacts/resources incrementally, not all at once
3. **Comprehensive testing**: Test each artifact/resource addition thoroughly
4. **Documentation**: Document all new artifacts/resources and their relationships

## Alternative Approach: Table-Based Resources

Instead of enum, use tables:

```sql
CREATE TABLE artifacts (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE resources (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    name TEXT NOT NULL UNIQUE,
    artifact_id UUID NOT NULL REFERENCES artifacts(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Benefits**:
- Easy to add new artifacts/resources
- No enum limitations
- Can add metadata to artifacts/resources

**Drawbacks**:
- Requires JOINs instead of enum checks
- Less type safety
- More complex queries

## Conclusion

Converting all 17 objects to artifacts and all tables to resources is a significant undertaking. The enum approach has limitations (especially for resources), but maintains type safety. The table approach is more flexible but requires more complex queries.

**Recommendation**: Start with a hybrid approach - keep artifacts as enum (small, stable set), but consider making resources a table (large, growing set).

