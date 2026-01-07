# Artifacts/Resources Analysis - Part 2: Mapping 17 Objects to Artifacts

## Overview

Mapping the 17 core graph components to artifacts (with singular names).

## Current 17 Core Graph Components

1. cohorts
2. simulations
3. scenarios (already an artifact)
4. personas
5. documents (already an artifact)
6. parameters
7. fields
8. agents (already an artifact)
9. models
10. rubrics (already an artifact)
11. evals
12. departments
13. providers
14. auth
15. keys
16. settings
17. profiles

## Proposed Artifact Mappings

### Already Artifacts (8)
- `scenario` ✅
- `document` ✅
- `agent` ✅
- `rubric` ✅
- `message` ✅ (not in 17, but exists)
- `grade` ✅ (not in 17, but exists)
- `run` ✅ (not in 17, but exists)
- `chat` ✅ (not in 17, but exists)

### Need to Add as Artifacts (9 from 17)

| Current Object | Proposed Artifact Name | Rationale |
|----------------|------------------------|------------|
| cohorts | `cohort` | Singular form |
| simulations | `simulation` | Singular form |
| personas | `persona` | Singular form |
| parameters | `parameter` | Singular form |
| fields | `field` | Singular form (note: 'field' already exists as resource) |
| models | `model` | Singular form |
| evals | `eval` | Singular form |
| departments | `department` | Singular form |
| providers | `provider` | Singular form |
| auth | `auth` | Already singular |
| keys | `key` | Singular form |
| settings | `setting` | Singular form |
| profiles | `profile` | Singular form |

### Artifacts Can Also Be Resources

**Important**: An entity can be both an artifact AND a resource. This is not a conflict - it's the intended design.

**Examples**:
- `document` is an artifact (top-level entity in `documents` table)
- `document` is also a resource when referenced by `scenario` artifact (via `scenario_documents` junction table)
- `persona` is an artifact (top-level entity in `personas` table)
- `persona` is also a resource when referenced by `scenario` artifact (via `scenario_personas` junction table)
- `field` is an artifact (top-level entity in `fields` table)
- `field` is also a resource when referenced by `document` artifact (via `document_fields` junction table)

**Pattern**: When an artifact is referenced by another artifact through a junction table, it becomes a resource of that referencing artifact.

### Naming Clarification

- **Artifact names**: Always singular (`document`, `field`, `persona`)
- **Database table names**: May be plural (`documents`, `fields`, `personas`) - this is fine, artifact enum values are singular
- **Resource names**: Usually singular, but can be plural for collections (`fields`, `parameters`)

## Updated Artifacts Enum (Proposed)

After adding all 17 objects as artifacts:

```sql
CREATE TYPE artifacts AS ENUM (
    'agent',        -- ✅ existing
    'auth',         -- ➕ new
    'chat',         -- ✅ existing
    'cohort',       -- ➕ new
    'department',   -- ➕ new
    'document',     -- ✅ existing
    'eval',         -- ➕ new
    'field',        -- ➕ new (also exists as resource - this is intentional)
    'grade',        -- ✅ existing
    'key',          -- ➕ new
    'message',      -- ✅ existing
    'model',        -- ➕ new
    'parameter',    -- ➕ new
    'persona',      -- ➕ new
    'profile',      -- ➕ new
    'provider',     -- ➕ new
    'rubric',       -- ✅ existing
    'run',          -- ✅ existing
    'scenario',     -- ✅ existing
    'setting',      -- ➕ new
    'simulation'    -- ➕ new
);
```

**Total**: 21 artifacts (8 existing + 13 new)

## Migration Considerations

### 1. Field Conflict Resolution

**Recommendation**: Rename resource `field` to `document_field` to avoid conflict with artifact `field`.

**Impact**:
- Update `resource_schemas` table
- Update `resource_tools` table
- Update all SQL queries referencing `'field'::resources`
- Update enum: Remove `field`, add `document_field`

### 2. Singular Name Consistency

All artifacts should be singular:
- ✅ `cohort` (not cohorts)
- ✅ `simulation` (not simulations)
- ✅ `persona` (not personas)
- ✅ `parameter` (not parameters)
- ✅ `field` (not fields)
- ✅ `model` (not models)
- ✅ `eval` (not evals)
- ✅ `department` (not departments)
- ✅ `provider` (not providers)
- ✅ `key` (not keys)
- ✅ `setting` (not settings)
- ✅ `profile` (not profiles)

### 3. Table Name vs Artifact Name

Current table names are plural (e.g., `cohorts`, `simulations`), but artifacts are singular. This is fine - table names can remain plural while artifact enum values are singular.

## Next Steps

See Part 3 for mapping all related tables to resources.

