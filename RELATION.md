# Relation Audit — Database Integrity Check

You are a database auditor for the GLOW project. Your job is to verify that all relation tables, junction tables, connection tables, entry tables, resource tables, artifact tables, and materialized views follow the canonical rules defined below. You do NOT fix anything. You REPORT errors, inconsistencies, and missing constraints.

Run each audit step in order. For each step, run the provided SQL query against the database. Compare the results against the rule. If the result set is non-empty (unless stated otherwise), that is an error. Collect all errors into a final report at the end.

---

## Database Credentials

```
psql postgresql://myuser:mypassword@localhost:5432/mydb
```

---

## The Five Table Types

| Type | Naming Convention | Purpose | Mutability |
|------|------------------|---------|------------|
| **Artifact** | `{entity}_artifact` | Core graph nodes (17 total). Represent configurable entities. | Read/Write |
| **Resource** | `{entity}_resource` | Shared reusable components. Always have `call_id`. | Read/Write |
| **Entry** | `{entity}_entry` | Analytical/operational write-only tables. Sessions, attempts, logs, metrics. | Write-only (read via MVs) |
| **Junction** | `{artifact}_{resource}` | Connect an artifact to a resource. Composite PK `(artifact_id, resource_id)`. | Read/Write |
| **Connection** | `{entry}_{resource}_connection` | Connect an entry to a resource. Composite PK `(entry_id, resource_id)`. | Write-only |

---

## The Six Relation Registry Tables

These are metadata registries that declare what relationships ARE ALLOWED. They do not store data — they store the schema's own rules.

| Registry | PK | Purpose |
|----------|-----|---------|
| `artifact_resources_relation` | `(artifact, resource)` | Which artifact types can link to which resource types via junction tables |
| `artifact_flags_relation` | `(artifact, flag_type)` | Which flag types each artifact supports |
| `artifact_outputs_relation` | `(id)` | Master list of output field definitions (name, field_type) |
| `entry_resource_relation` | `(entry, resource)` | Which entry types can link to which resource types via connection tables |
| `entry_entry_relation` | `(parent, child)` | Which entry types can have parent-child FK relationships |
| `entry_outputs_relation` | `(entry, output_id)` | Which output fields each entry type exposes |
| `resource_outputs_relation` | `(resource, outputs_id)` | Which output fields each resource type exposes. Has `creatable` flag. |
| `resource_resource_relation` | `(parent_resource, child_resource)` | Which resource types can FK to other resource types |
| `resource_flags_relation` | `(resource_id, flag_type)` | Per-resource-instance flag type control |
| `view_entry_relation` | `(view, entry)` | Which view types query which entry types |
| `view_resource_relation` | `(view, resource)` | Which view types join which resource types |
| `view_outputs_relation` | `(view, outputs_id)` | Which output fields each view type exposes |
| `artifact_view_relation` | `(artifact, view)` | Which artifact types (pages) use which view types |

---

## The Rules

### Rule 1: Every `_artifact` table must follow the canonical schema

All 17 artifact tables must have exactly these standard columns:
- `id uuid PRIMARY KEY DEFAULT uuidv7()`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`
- `generated boolean NOT NULL DEFAULT false`
- `mcp boolean NOT NULL DEFAULT false`
- `group_id uuid NOT NULL REFERENCES groups(id)`

No additional columns beyond these six.

### Rule 2: Every `_resource` table must have `call_id NOT NULL`

All resource tables MUST have `call_id uuid NOT NULL REFERENCES calls(id)`. They must also have the standard columns: `id`, `created_at`, `updated_at`, `active`, `generated`, `mcp`.

### Rule 3: Junction tables connect ONLY artifact-to-resource

A junction table `{artifact}_{resource}` must have:
- `{artifact}_id uuid NOT NULL REFERENCES {artifact}_artifact(id) ON DELETE CASCADE`
- `{resource}_id uuid NOT NULL REFERENCES {resource}_resource(id) ON DELETE CASCADE`
- `created_at`, `updated_at`, `generated`, `mcp`, `active` standard columns
- Composite PK `({artifact}_id, {resource}_id)`
- NO `call_id` column

### Rule 4: Connection tables connect ONLY entry-to-resource

A connection table `{entry}_{resource}_connection` must have:
- `{entry}_id uuid NOT NULL REFERENCES {entry}_entry(id) ON DELETE CASCADE`
- `{resource}_id uuid NOT NULL REFERENCES {resource}_resource(id)`
- `created_at`, `active`, `generated`, `mcp` standard columns
- Composite PK `({entry}_id, {resource}_id)`

### Rule 5: Resource-to-resource is allowed as direct FKs

Resource tables MAY have direct FK columns pointing to other resource tables. These relationships must be registered in `resource_resource_relation`.

### Rule 6: Entry-to-entry is allowed as direct FKs

Entry tables MAY have direct FK columns pointing to other entry tables. These relationships must be registered in `entry_entry_relation`.

### Rule 7: Entry tables are analytical / write-only

Entry tables are written to during operational flows (sessions, attempts, chats, metrics). They are NOT read directly by the API. Reads come from materialized views.

### Rule 8: No normal views — business logic lives in the service layer

There should be NO `CREATE VIEW` statements in the database. All read-side aggregation is done via materialized views (MVs) that are JIT-compiled and refreshed, combined with Python service logic.

### Rule 9: No stored procedures for business logic

Stored procedures/functions (`CREATE FUNCTION`) should only exist for utility purposes (e.g., `uuidv7()`). Business logic belongs in the Python service layer, not in SQL functions.

### Rule 10: MVs are not permanent schema — they are JIT-compiled

Materialized views are dropped and recreated each time they are refreshed. They are defined in SQL files under `server/app/sql/` and compiled at runtime. They should NOT appear in migration files as permanent objects.

### Rule 11: The `artifact_resources_relation` registry must match actual junction tables

Every row in `artifact_resources_relation` must have a corresponding physical junction table `{artifact}_{resource}` in the database. Conversely, every junction table must have a corresponding row in the registry.

### Rule 12: The `entry_resource_relation` registry must match actual connection tables

Every row in `entry_resource_relation` must have a corresponding physical connection table `{entry}_{resource}_connection`. And vice versa.

### Rule 13: The `entry_entry_relation` registry must match actual FK columns

Every row in `entry_entry_relation (parent, child)` must correspond to an actual FK from `{child}_entry` to `{parent}_entry`. And vice versa.

### Rule 14: The `resource_resource_relation` registry must match actual FK columns

Every row in `resource_resource_relation (parent_resource, child_resource)` must correspond to an actual FK from `{parent}_resource` to `{child}_resource`. And vice versa.

### Rule 15: Outputs relation tables must be a whitelist of actual columns

The `resource_outputs_relation` must contain entries that correspond to actual columns on the respective `_resource` table. At minimum, every column on a resource table should appear in the outputs relation (or be explicitly marked inactive). Missing columns mean the outputs registry is incomplete.

Same principle for `entry_outputs_relation` and `view_outputs_relation`.

### Rule 16: All FKs must be declared

Every `uuid` column that references another table must have an explicit `FOREIGN KEY` constraint. No implicit/application-level-only foreign keys.

### Rule 17: No NULL-able columns where a DEFAULT would suffice

Boolean columns must be `NOT NULL DEFAULT false` (or `true`). Timestamp columns must be `NOT NULL DEFAULT now()`. Follow the no-nulls policy.

### Rule 18: Enum types must match actual table suffixes

The `artifact_type` enum values must match the set of `*_artifact` tables. The `resource_type` enum values must match the set of `*_resource` tables. The `entry_type` enum values must match the set of `*_entry` tables.

---

## Audit Queries

Run each query. Non-empty results indicate violations.

### Audit 1: Artifact tables missing standard columns

```sql
-- Find artifact tables that are missing any of the 6 required columns
SELECT
    t.table_name,
    ARRAY['id','created_at','updated_at','generated','mcp','group_id']
        EXCEPT
    ARRAY_AGG(c.column_name::text) AS missing_columns
FROM information_schema.tables t
JOIN information_schema.columns c
    ON c.table_schema = t.table_schema AND c.table_name = t.table_name
WHERE t.table_schema = 'public'
    AND t.table_name LIKE '%_artifact'
GROUP BY t.table_name;
```

More practical version:

```sql
-- Artifact tables with extra columns beyond the standard 6
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name LIKE '%\_artifact'
    AND column_name NOT IN ('id','created_at','updated_at','generated','mcp','group_id')
ORDER BY table_name, column_name;
```

**Expected**: Empty result set. Any rows = artifact table has non-standard columns.

### Audit 2: Resource tables missing `call_id`

```sql
SELECT t.table_name
FROM information_schema.tables t
WHERE t.table_schema = 'public'
    AND t.table_name LIKE '%\_resource'
    AND t.table_name NOT IN (
        SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'call_id'
    )
ORDER BY t.table_name;
```

**Expected**: Empty result set. Any rows = resource table missing `call_id`.

### Audit 3: Resource tables missing standard columns

```sql
SELECT table_name, column_name AS missing
FROM (
    SELECT t.table_name, unnest(ARRAY['id','created_at','updated_at','active','generated','mcp','call_id']) AS column_name
    FROM information_schema.tables t
    WHERE t.table_schema = 'public' AND t.table_name LIKE '%\_resource'
) expected
WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public'
        AND c.table_name = expected.table_name
        AND c.column_name = expected.column_name
)
ORDER BY table_name, missing;
```

**Expected**: Empty result set.

### Audit 4: Junction tables that have `call_id` (they should NOT)

```sql
-- Junction tables are identified as tables that are NOT _artifact, _resource, _entry, _connection, _relation
-- and whose name matches {artifact}_{resource} pattern
SELECT table_name
FROM information_schema.columns
WHERE table_schema = 'public'
    AND column_name = 'call_id'
    AND table_name NOT LIKE '%\_resource'
    AND table_name NOT LIKE '%\_entry'
    AND table_name NOT LIKE '%\_artifact'
    AND table_name NOT LIKE '%\_relation'
    AND table_name NOT LIKE '%\_connection'
    AND table_name != 'calls'
ORDER BY table_name;
```

**Expected**: Empty result set. Any rows = non-resource table incorrectly has `call_id`.

### Audit 5: Registry vs. physical junction table sync

```sql
-- Rows in artifact_resources_relation with no matching physical table
SELECT ar.artifact, ar.resource,
    ar.artifact || '_' || ar.resource AS expected_table
FROM artifact_resources_relation ar
WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables t
    WHERE t.table_schema = 'public'
        AND t.table_name = ar.artifact || '_' || ar.resource
)
ORDER BY ar.artifact, ar.resource;
```

```sql
-- Physical junction-like tables with no registry entry
-- (tables named {artifact}_{something} where {artifact} is a known artifact)
WITH artifact_names AS (
    SELECT unnest(enum_range(NULL::artifact_type))::text AS artifact
),
candidate_junctions AS (
    SELECT t.table_name
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
        AND t.table_name NOT LIKE '%\_artifact'
        AND t.table_name NOT LIKE '%\_resource'
        AND t.table_name NOT LIKE '%\_entry'
        AND t.table_name NOT LIKE '%\_relation'
        AND t.table_name NOT LIKE '%\_connection'
        AND t.table_name NOT LIKE 'mv\_%'
)
SELECT cj.table_name
FROM candidate_junctions cj
JOIN artifact_names an ON cj.table_name LIKE an.artifact || '\_%'
WHERE NOT EXISTS (
    SELECT 1 FROM artifact_resources_relation ar
    WHERE ar.artifact || '_' || ar.resource = cj.table_name
)
ORDER BY cj.table_name;
```

**Expected**: Both empty. First = registry has phantom entries. Second = physical tables not registered.

### Audit 6: Registry vs. physical connection table sync

```sql
-- Rows in entry_resource_relation with no matching physical connection table
SELECT er.entry, er.resource,
    er.entry || '_' || er.resource || '_connection' AS expected_table
FROM entry_resource_relation er
WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables t
    WHERE t.table_schema = 'public'
        AND t.table_name = er.entry || '_' || er.resource || '_connection'
)
ORDER BY er.entry, er.resource;
```

```sql
-- Physical connection tables with no registry entry
SELECT t.table_name
FROM information_schema.tables t
WHERE t.table_schema = 'public'
    AND t.table_name LIKE '%\_connection'
    AND NOT EXISTS (
        SELECT 1 FROM entry_resource_relation er
        WHERE er.entry || '_' || er.resource || '_connection' = t.table_name
    )
ORDER BY t.table_name;
```

**Expected**: Both empty.

### Audit 7: entry_entry_relation vs. actual FKs

```sql
-- entry_entry_relation rows with no matching FK constraint
SELECT ee.parent, ee.child
FROM entry_entry_relation ee
WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = ee.child || '_entry'
        AND ccu.table_name = ee.parent || '_entry'
)
ORDER BY ee.parent, ee.child;
```

**Expected**: Empty. Any rows = declared entry-entry relation has no backing FK.

### Audit 8: resource_resource_relation vs. actual FKs

```sql
-- resource_resource_relation rows with no matching FK
SELECT rr.parent_resource, rr.child_resource
FROM resource_resource_relation rr
WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = rr.parent_resource || '_resource'
        AND ccu.table_name = rr.child_resource || '_resource'
)
ORDER BY rr.parent_resource, rr.child_resource;
```

**Expected**: Empty.

### Audit 9: NULL-able boolean/timestamp columns

```sql
-- Boolean columns that allow NULL
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
    AND data_type = 'boolean'
    AND is_nullable = 'YES'
    AND table_name NOT LIKE 'pg_%'
ORDER BY table_name, column_name;
```

```sql
-- Timestamp columns that allow NULL
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
    AND data_type LIKE 'timestamp%'
    AND is_nullable = 'YES'
    AND table_name NOT LIKE 'pg_%'
ORDER BY table_name, column_name;
```

**Expected**: Empty or a known exception list. Any rows = no-nulls policy violation.

### Audit 10: UUID columns without FK constraints

```sql
-- UUID columns (excluding PKs) that have no FK constraint
SELECT c.table_name, c.column_name
FROM information_schema.columns c
WHERE c.table_schema = 'public'
    AND c.data_type = 'uuid'
    AND c.column_name != 'id'
    AND c.table_name NOT LIKE 'pg_%'
    AND NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON kcu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND kcu.table_name = c.table_name
            AND kcu.column_name = c.column_name
    )
ORDER BY c.table_name, c.column_name;
```

**Expected**: Empty. Any rows = UUID column without a declared FK (possible missing constraint).

### Audit 11: Enum vs. actual table alignment

```sql
-- artifact_type enum values with no matching _artifact table
SELECT unnest(enum_range(NULL::artifact_type))::text AS artifact
EXCEPT
SELECT replace(table_name, '_artifact', '')
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE '%\_artifact';
```

```sql
-- _artifact tables with no matching enum value
SELECT replace(table_name, '_artifact', '') AS artifact
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE '%\_artifact'
EXCEPT
SELECT unnest(enum_range(NULL::artifact_type))::text;
```

**Expected**: First query may return view-type artifacts (home, practice, etc.) that don't have physical tables — note these but they are expected. Second query should be empty.

### Audit 12: Normal views (should not exist)

```sql
-- All non-materialized views in public schema (should be empty)
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;
```

**Expected**: Empty. Any rows = normal view exists (violates Rule 8).

### Audit 13: Stored functions beyond utilities

```sql
-- All user-defined functions in public schema
-- Review manually: only utility functions (uuidv7, etc.) should exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_type = 'FUNCTION'
ORDER BY routine_name;
```

**Expected**: Only utility functions like `uuidv7`. Any business-logic functions = violation of Rule 9.

### Audit 14: Materialized views in migrations (should not be permanent)

```sql
-- List all materialized views currently in the database
SELECT matviewname
FROM pg_matviews
WHERE schemaname = 'public'
ORDER BY matviewname;
```

**Note**: MVs are expected to exist at runtime (they are JIT-compiled from SQL files). This query is informational. Cross-reference with `server/app/sql/v4/queries/` to ensure each MV has a corresponding SQL file.

### Audit 15: Missing FK indexes

```sql
-- FK columns without an index (can cause slow joins)
SELECT
    tc.table_name,
    kcu.column_name,
    tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_name = tc.constraint_name
    AND kcu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND NOT EXISTS (
        SELECT 1
        FROM pg_indexes pi
        WHERE pi.schemaname = 'public'
            AND pi.tablename = tc.table_name
            AND pi.indexdef LIKE '%' || kcu.column_name || '%'
    )
ORDER BY tc.table_name, kcu.column_name;
```

**Expected**: Empty. Any rows = FK column without an index (performance risk).

### Audit 16: Junction table PK structure

```sql
-- Junction tables (in artifact_resources_relation) whose PK is not a 2-column composite
WITH expected_junctions AS (
    SELECT artifact || '_' || resource AS table_name
    FROM artifact_resources_relation
)
SELECT ej.table_name,
    (SELECT COUNT(*) FROM information_schema.key_column_usage kcu
     JOIN information_schema.table_constraints tc
         ON tc.constraint_name = kcu.constraint_name
     WHERE tc.constraint_type = 'PRIMARY KEY'
         AND kcu.table_schema = 'public'
         AND kcu.table_name = ej.table_name) AS pk_column_count
FROM expected_junctions ej
WHERE EXISTS (
    SELECT 1 FROM information_schema.tables t
    WHERE t.table_schema = 'public' AND t.table_name = ej.table_name
)
HAVING (SELECT COUNT(*) FROM information_schema.key_column_usage kcu
     JOIN information_schema.table_constraints tc
         ON tc.constraint_name = kcu.constraint_name
     WHERE tc.constraint_type = 'PRIMARY KEY'
         AND kcu.table_schema = 'public'
         AND kcu.table_name = ej.table_name) != 2;
```

**Expected**: Empty. Any rows = junction table with wrong PK structure.

### Audit 17: Connection table PK structure

```sql
-- Connection tables whose PK is not a 2-column composite
SELECT t.table_name,
    (SELECT COUNT(*) FROM information_schema.key_column_usage kcu
     JOIN information_schema.table_constraints tc
         ON tc.constraint_name = kcu.constraint_name
     WHERE tc.constraint_type = 'PRIMARY KEY'
         AND kcu.table_schema = 'public'
         AND kcu.table_name = t.table_name) AS pk_column_count
FROM information_schema.tables t
WHERE t.table_schema = 'public'
    AND t.table_name LIKE '%\_connection'
HAVING (SELECT COUNT(*) FROM information_schema.key_column_usage kcu
     JOIN information_schema.table_constraints tc
         ON tc.constraint_name = kcu.constraint_name
     WHERE tc.constraint_type = 'PRIMARY KEY'
         AND kcu.table_schema = 'public'
         AND kcu.table_name = t.table_name) != 2;
```

**Expected**: Empty.

### Audit 18: Entry tables not following naming convention

```sql
-- Tables ending in _entry that are not in the entries enum
SELECT replace(table_name, '_entry', '') AS entry_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE '%\_entry'
EXCEPT
SELECT unnest(enum_range(NULL::entries))::text;
```

**Expected**: Empty. Any rows = entry table not registered in enum.

### Audit 19: Resource tables not following naming convention

```sql
-- Tables ending in _resource that are not in the resources enum
SELECT replace(table_name, '_resource', '') AS resource_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE '%\_resource'
EXCEPT
SELECT unnest(enum_range(NULL::resources))::text;
```

**Expected**: Empty.

### Audit 20: ON DELETE CASCADE check for junction tables

```sql
-- Junction FK constraints that are NOT ON DELETE CASCADE
WITH expected_junctions AS (
    SELECT artifact || '_' || resource AS table_name
    FROM artifact_resources_relation
)
SELECT rc.constraint_name, rc.match_option, rc.update_rule, rc.delete_rule,
    tc.table_name
FROM information_schema.referential_constraints rc
JOIN information_schema.table_constraints tc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.table_schema = 'public'
    AND tc.table_name IN (SELECT table_name FROM expected_junctions)
    AND rc.delete_rule != 'CASCADE'
ORDER BY tc.table_name;
```

**Expected**: Empty. Any rows = junction FK missing ON DELETE CASCADE.

---

## Running the Audit

### Option A: Full audit via psql

Save this file's SQL blocks into individual `.sql` files or run them inline:

```bash
psql postgresql://myuser:mypassword@localhost:5432/mydb -f audit_01.sql
```

### Option B: Single-pass script

Concatenate all audit queries into one script, prefixing each with a `\echo` label:

```sql
\echo '=== AUDIT 1: Artifact tables with extra columns ==='
-- paste query here

\echo '=== AUDIT 2: Resource tables missing call_id ==='
-- paste query here

-- ... etc
```

### Option C: Python runner

Use `execute_sql_typed()` from the service layer to run each query programmatically and collect results into a structured report.

---

## Report Format

For each audit that returns rows, report:

```
AUDIT {N}: {Title}
RULE VIOLATED: Rule {N}
ROWS RETURNED: {count}
DETAILS:
  - {table_name}: {description of violation}
  - ...
```

For audits that return no rows:

```
AUDIT {N}: {Title} — PASS
```

End with a summary:

```
SUMMARY
=======
Total audits: 20
Passed: {N}
Failed: {N}
Warnings: {N} (informational audits like 13, 14)
```

---

## Important Notes

1. **Do NOT fix anything**. This is a read-only audit. Report only.
2. **Some exceptions are known**. Document them but still flag them:
   - `agent_tools` junction links to `tool_artifact`, not a resource table
   - `cohort_profiles` links to `profile_artifact`
   - `cohort_simulations` links to `simulation_artifact`
   - `department_settings` links to `setting_artifact`
   - View-type entries in `artifact_type` enum (home, practice, etc.) don't have physical `_artifact` tables
3. **Run this after any migration** to catch regressions.
4. **The relation registries are the source of truth** for what SHOULD exist. Discrepancies between registries and physical schema are always errors (in one direction or the other).
5. **MVs are transient** — their presence at query time depends on whether the server has been started and refreshed them. Their absence is not an error; their presence in migration files IS.
