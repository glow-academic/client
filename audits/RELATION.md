# Relation Audit — Database Integrity Check

You are a database auditor for the GLOW project. Your job is to verify that all relation tables, junction tables, connection tables, entry tables, resource tables, artifact tables, and materialized views follow the canonical rules defined below. You do NOT fix anything. You REPORT errors, inconsistencies, and missing constraints.

**IMPORTANT**: Before running the audit, run `make restore-db` to get the raw migration state. This ensures you audit the schema as defined by migrations only — before `make sql-compile` injects MVs and stored procedures. MVs and SPs are JIT-compiled at server startup and are NOT permanent schema objects.

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
| **Resource** | `{entity}_resource` | Shared reusable components. NO `call_id` — traceability via `{resource}_calls_connection`. | Read/Write |
| **Entry** | `{entity}_entry` | Analytical/operational write-only tables. Sessions, attempts, logs, metrics. | Write-only (read via MVs) |
| **Junction** | `{artifact}_{resource}_junction` | Connect an artifact to a resource. Composite PK. Suffix `_junction`. | Read/Write |
| **Connection** | `{entry}_{resource}_connection` | Connect an entry/resource to another entry/resource. Composite PK. Suffix `_connection`. | Write-only |

### Connection Table Sub-Types

Connection tables come in several categories, all sharing the `_connection` suffix:

| Sub-Type | Pattern | Purpose |
|----------|---------|---------|
| **Resource-to-Call** | `{resource}_calls_connection` | Traces which call created a resource (replaces old `call_id` column on resource) |
| **Resource-to-Draft** | `{resource}_drafts_connection` | Traces which draft session created a resource |
| **Entry-to-Resource** | `{entry}_{resource}_connection` | Operational link from entry to resource at write time |
| **Resource-to-Resource** | `{resource}_{resource}_connection` | Direct resource-to-resource link (e.g., `domains_domains_connection`) |
| **Entry-to-Entry** | Embedded via FK | Entry tables use direct FK columns for parent-child (not connection tables) |
| **Compound** | `{parent}_{child}_connection` | Nested operational links (e.g., `training_bundle_departments_*_connection`) |

---

## The Relation Registry Tables

These are metadata registries that declare what relationships ARE ALLOWED. They do not store operational data — they store the schema's own rules.

| Registry | PK | Purpose |
|----------|-----|---------|
| `artifact_resources_relation` | `(artifact, resource)` | Which artifact types can link to which resource types via junction tables |
| `artifact_flags_relation` | `(artifact, flag_type)` | Which flag types each artifact supports |
| `artifact_outputs_relation` | `(id)` | Master list of output field definitions (name, field_type) |
| `artifact_view_relation` | `(artifact, view)` | Which artifact types (pages) use which view types |
| `entry_resource_relation` | `(entry, resource)` | Which entry types can link to which resource types via connection tables |
| `entry_entry_relation` | `(parent, child)` | Which entry types can have parent-child FK relationships |
| `entry_outputs_relation` | `(entry, output_id)` | Which output fields each entry type exposes |
| `resource_outputs_relation` | `(resource, outputs_id)` | Which output fields each resource type exposes. Has `creatable` flag. |
| `resource_resource_relation` | `(parent_resource, child_resource)` | Which resource types can FK to other resource types |
| `resource_flags_relation` | `(resource_id, flag_type)` | Per-resource-instance flag type control |
| `view_entry_relation` | `(view, entry)` | Which view types query which entry types |
| `view_resource_relation` | `(view, resource)` | Which view types join which resource types |
| `view_outputs_relation` | `(view, outputs_id)` | Which output fields each view type exposes |

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

### Rule 2: Resource tables must NOT have `call_id`

Resource tables do NOT store `call_id` directly. Instead, call traceability is handled via `{resource}_calls_connection` tables that link a resource row to a `calls_entry` row. Every resource table in `resource_type` enum MUST have a corresponding `{resource}_calls_connection` table.

Resource standard columns: `id`, `created_at`, `active`, `generated`, `mcp`, plus resource-specific data columns.

**Exception**: Binding-type resources (e.g., `auth_item_keys_resource`) that represent cross-entity bindings MAY retain `call_id` directly, since they are inherently transactional.

### Rule 3: Junction tables connect ONLY artifact-to-resource

A junction table `{artifact}_{resource}_junction` must have:
- Two FK columns forming a composite PK
- `created_at`, `generated`, `mcp`, `active` standard columns
- The `_junction` suffix
- NO `call_id` column

### Rule 4: Connection tables use the `_connection` suffix

All connection tables must end in `_connection` and have a composite PK of the two FK columns they join.

### Rule 5: Resource-to-resource is allowed as direct FKs

Resource tables MAY have direct FK columns pointing to other resource tables. These relationships must be registered in `resource_resource_relation`.

### Rule 6: Entry-to-entry is allowed as direct FKs

Entry tables MAY have direct FK columns pointing to other entry tables. These relationships must be registered in `entry_entry_relation`.

### Rule 7: Entry tables are analytical / write-only

Entry tables are written to during operational flows (sessions, attempts, chats, metrics). They are NOT read directly by the API. Reads come from materialized views.

### Rule 8: No normal views in raw migration state

After `make restore-db`, there should be NO `CREATE VIEW` statements in the database beyond known exceptions. All read-side aggregation is done via materialized views (MVs) that are JIT-compiled at server startup via `make sql-compile`.

**Known exceptions**: `hints_entry` and `view_calls_entry` (unification views over split tables).

### Rule 9: No stored procedures for business logic in migrations

Stored procedures/functions should only appear in migration files for:
- Utility functions (e.g., `uuidv7()`, `gen_trace_id`)
- Crypto/pgcrypto extensions
- Test helper functions (`test_*`)
- Trigger functions (`update_updated_at_column`)

All `api_*`, `socket_*`, `infrastructure_*`, `infra_*` functions are JIT-compiled at server startup — they should NOT survive a `make restore-db`. If they do, they were incorrectly placed in a migration file.

### Rule 10: MVs are not permanent schema — they are JIT-compiled

Materialized views are dropped and recreated by `make sql-compile`. After `make restore-db`, only MVs explicitly created in migration files should exist. Currently `mv_draft_agent` and `mv_draft_model` exist in migrations (legacy — should eventually be moved to JIT).

### Rule 11: The `artifact_resources_relation` registry must match actual junction tables

Every row `(artifact, resource)` in `artifact_resources_relation` must have a corresponding physical junction table `{artifact}_{resource}_junction`. Conversely, every `_junction` table that connects an artifact to a resource must have a row in the registry.

### Rule 12: The `entry_resource_relation` registry must match actual connection tables

Every row in `entry_resource_relation` must have a corresponding physical connection table. And vice versa.

### Rule 13: The `entry_entry_relation` registry must match actual FK columns

Every row in `entry_entry_relation (parent, child)` must correspond to an actual FK from the child entry table to the parent entry table.

### Rule 14: The `resource_resource_relation` registry must match actual FK columns

Every row in `resource_resource_relation (parent_resource, child_resource)` must correspond to an actual FK between those resource tables.

### Rule 15: Outputs relation tables must be a whitelist of actual columns

The `resource_outputs_relation`, `entry_outputs_relation`, and `view_outputs_relation` must contain entries that correspond to actual columns on their respective tables. Missing columns mean the outputs registry is incomplete.

### Rule 16: All FKs must be declared and indexed

Every `uuid` column that references another table must have an explicit `FOREIGN KEY` constraint. Every FK column must have a supporting index.

### Rule 17: No NULL-able columns where a DEFAULT would suffice

Boolean columns must be `NOT NULL DEFAULT false` (or `true`). Timestamp columns must be `NOT NULL DEFAULT now()`. Follow the no-nulls policy.

**Known exceptions**:
- `grants_entry.revoked_at`, `grants_entry.used_at` (event-based, legitimately nullable)
- `args_values_entry.boolean_value`, `args_outputs_values_entry.boolean_value` (polymorphic value columns)

### Rule 18: Enum types must match actual table suffixes

- `artifact_type` enum values must include all `*_artifact` table prefixes (plus virtual page types)
- `resource_type` enum values must match the set of `*_resource` tables
- `entry_type` enum values must match the set of `*_entry` base tables

---

## Audit Queries

Run `make restore-db` first, then run each query. Non-empty results indicate violations.

### Audit 1: Artifact tables with extra columns

```sql
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name LIKE '%\_artifact'
    AND column_name NOT IN ('id','created_at','updated_at','generated','mcp','group_id')
ORDER BY table_name, column_name;
```

**Expected**: Empty.

### Audit 2: Resource tables that still have `call_id` (they should NOT)

```sql
SELECT table_name
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name LIKE '%\_resource'
    AND column_name = 'call_id'
ORDER BY table_name;
```

**Expected**: Empty, or only known binding-type exceptions (e.g., `auth_item_keys_resource`). Any other rows = resource table incorrectly retains `call_id`.

### Audit 3: Resource tables missing their `_calls_connection` table

```sql
-- Every resource in resource_type enum should have a {resource}_calls_connection table
SELECT e.enumlabel AS resource_name,
    e.enumlabel || '_calls_connection' AS expected_table
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
WHERE t.typname = 'resource_type'
    AND NOT EXISTS (
        SELECT 1 FROM information_schema.tables tbl
        WHERE tbl.table_schema = 'public'
            AND tbl.table_name = e.enumlabel || '_calls_connection'
    )
ORDER BY e.enumlabel;
```

**Expected**: Empty. Any rows = resource type missing its calls traceability connection.

### Audit 4: Junction/other tables that have `call_id` (they should NOT)

```sql
SELECT table_name
FROM information_schema.columns
WHERE table_schema = 'public'
    AND column_name = 'call_id'
    AND table_name NOT LIKE '%\_entry'
    AND table_name NOT LIKE '%\_connection'
    AND table_name NOT LIKE '%\_relation'
    AND table_name <> 'calls'
    -- Exclude known binding exceptions
    AND table_name NOT IN ('auth_item_keys_resource')
ORDER BY table_name;
```

**Expected**: Empty. Any rows = table incorrectly has `call_id`.

### Audit 5: Registry vs. physical junction table sync

```sql
-- 5a: Registry entries with no matching physical junction table
SELECT ar.artifact, ar.resource,
    ar.artifact || '_' || ar.resource || '_junction' AS expected_table
FROM artifact_resources_relation ar
WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables t
    WHERE t.table_schema = 'public'
        AND t.table_name = ar.artifact || '_' || ar.resource || '_junction'
)
ORDER BY ar.artifact, ar.resource;
```

```sql
-- 5b: Physical junction tables with no registry entry
SELECT t.table_name
FROM information_schema.tables t
WHERE t.table_schema = 'public'
    AND t.table_name LIKE '%\_junction'
    AND t.table_type = 'BASE TABLE'
    AND NOT EXISTS (
        SELECT 1 FROM artifact_resources_relation ar
        WHERE ar.artifact || '_' || ar.resource || '_junction' = t.table_name
    )
ORDER BY t.table_name;
```

**Expected**: Both empty. 5a = phantom registry entries. 5b = unregistered junction tables.

### Audit 6: Entry-resource registry vs. physical connection table sync

```sql
-- 6a: Registry entries with no matching physical connection table
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
-- 6b: Physical connection tables with no registry entry
SELECT t.table_name
FROM information_schema.tables t
WHERE t.table_schema = 'public'
    AND t.table_name LIKE '%\_connection'
    AND t.table_type = 'BASE TABLE'
    AND NOT EXISTS (
        SELECT 1 FROM entry_resource_relation er
        WHERE er.entry || '_' || er.resource || '_connection' = t.table_name
    )
ORDER BY t.table_name;
```

**Expected**: Both empty.

### Audit 7: entry_entry_relation vs. actual FKs

```sql
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

**Expected**: Empty.

### Audit 8: resource_resource_relation vs. actual FKs

```sql
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

### Audit 9: Nullable booleans/timestamps on base tables

```sql
-- 9a: Nullable booleans
SELECT c.table_name, c.column_name
FROM information_schema.columns c
JOIN information_schema.tables t
    ON t.table_name = c.table_name AND t.table_schema = c.table_schema
WHERE c.table_schema = 'public'
    AND c.data_type = 'boolean'
    AND c.is_nullable = 'YES'
    AND t.table_type = 'BASE TABLE'
ORDER BY c.table_name, c.column_name;
```

```sql
-- 9b: Nullable timestamps
SELECT c.table_name, c.column_name
FROM information_schema.columns c
JOIN information_schema.tables t
    ON t.table_name = c.table_name AND t.table_schema = c.table_schema
WHERE c.table_schema = 'public'
    AND c.data_type LIKE 'timestamp%'
    AND c.is_nullable = 'YES'
    AND t.table_type = 'BASE TABLE'
ORDER BY c.table_name, c.column_name;
```

**Expected**: Empty or known exceptions only.

### Audit 10: UUID columns without FK constraints (base tables only)

```sql
SELECT c.table_name, c.column_name
FROM information_schema.columns c
JOIN information_schema.tables t
    ON t.table_name = c.table_name AND t.table_schema = c.table_schema
WHERE c.table_schema = 'public'
    AND c.udt_name = 'uuid'
    AND c.column_name <> 'id'
    AND t.table_type = 'BASE TABLE'
    AND NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON kcu.constraint_name = tc.constraint_name
            AND kcu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND kcu.table_schema = 'public'
            AND kcu.table_name = c.table_name
            AND kcu.column_name = c.column_name
    )
ORDER BY c.table_name, c.column_name;
```

**Expected**: Empty.

### Audit 11: Enum vs. actual table alignment

```sql
-- 11a: artifact_type enum values with no matching _artifact table (expect virtual page types)
SELECT unnest(enum_range(NULL::artifact_type))::text AS artifact
EXCEPT
SELECT replace(table_name, '_artifact', '')
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE '%\_artifact';
```

```sql
-- 11b: resource_type enum values with no matching _resource table
SELECT e.enumlabel AS resource_name
FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
WHERE t.typname = 'resource_type'
EXCEPT
SELECT replace(table_name, '_resource', '')
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE '%\_resource' AND table_type = 'BASE TABLE';
```

```sql
-- 11c: _resource tables with no matching enum value
SELECT replace(table_name, '_resource', '') AS resource_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE '%\_resource' AND table_type = 'BASE TABLE'
EXCEPT
SELECT e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
WHERE t.typname = 'resource_type';
```

```sql
-- 11d: entry_type enum values with no matching _entry base table
SELECT e.enumlabel AS entry_name
FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
WHERE t.typname = 'entry_type'
EXCEPT
SELECT replace(table_name, '_entry', '')
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE '%\_entry' AND table_type = 'BASE TABLE';
```

```sql
-- 11e: _entry base tables with no matching enum value
SELECT replace(table_name, '_entry', '') AS entry_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE '%\_entry' AND table_type = 'BASE TABLE'
EXCEPT
SELECT e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
WHERE t.typname = 'entry_type';
```

**Expected**: 11a may return virtual page types (expected). 11b-11e should be empty.

### Audit 12: Normal views in raw state

```sql
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;
```

**Expected**: Only `hints_entry` and `view_calls_entry`. Any other rows = view incorrectly created in a migration.

### Audit 13: Stored functions in raw state

```sql
SELECT
    CASE
        WHEN routine_name LIKE 'api_%' THEN 'api_*'
        WHEN routine_name LIKE 'socket_%' THEN 'socket_*'
        WHEN routine_name LIKE 'infrastructure_%' THEN 'infrastructure_*'
        WHEN routine_name LIKE 'infra_%' THEN 'infra_*'
        WHEN routine_name LIKE 'test_%' THEN 'test_*'
        WHEN routine_name LIKE 'utils_%' THEN 'utils_*'
        ELSE routine_name
    END AS category,
    COUNT(*) as cnt
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
GROUP BY 1 ORDER BY 2 DESC;
```

**Expected (in raw state)**: `api_*` and `socket_*` functions should exist (they live in migrations currently). `infrastructure_*` and `infra_*` are also in migrations. These are candidates for eventual migration to JIT compilation. Flag the counts for tracking.

### Audit 14: Materialized views in raw state

```sql
SELECT matviewname
FROM pg_matviews
WHERE schemaname = 'public'
ORDER BY matviewname;
```

**Expected**: Only `mv_draft_agent` and `mv_draft_model` (legacy, in migrations). Any others = MV incorrectly in a migration file.

### Audit 15: FK columns without indexes

```sql
WITH fk_cols AS (
    SELECT DISTINCT kcu.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
    JOIN information_schema.tables t
        ON t.table_name = kcu.table_name AND t.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' AND t.table_type = 'BASE TABLE'
)
SELECT fk.table_name, fk.column_name
FROM fk_cols fk
WHERE NOT EXISTS (
    SELECT 1 FROM pg_indexes pi
    WHERE pi.schemaname = 'public'
        AND pi.tablename = fk.table_name
        AND pi.indexdef LIKE '%' || fk.column_name || '%'
)
ORDER BY fk.table_name, fk.column_name;
```

**Expected**: Empty.

### Audit 16: ON DELETE CASCADE check for junction tables

```sql
WITH junction_tables AS (
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE '%\_junction' AND table_type = 'BASE TABLE'
)
SELECT rc.constraint_name, rc.delete_rule, tc.table_name
FROM information_schema.referential_constraints rc
JOIN information_schema.table_constraints tc
    ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
WHERE tc.table_schema = 'public'
    AND tc.table_name IN (SELECT table_name FROM junction_tables)
    AND rc.delete_rule <> 'CASCADE'
ORDER BY tc.table_name;
```

**Expected**: Empty.

---

## Running the Audit

### Prerequisites

```bash
make restore-db    # Reset to raw migration state (no JIT MVs/SPs)
```

### Execution

```bash
psql postgresql://myuser:mypassword@localhost:5432/mydb -f audit.sql
```

Or run each query inline with `\echo` labels for a single-pass report.

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
Total audits: 16
Passed: {N}
Failed: {N}
Warnings: {N} (informational audits like 13, 14)
```

---

## Important Notes

1. **Do NOT fix anything**. This is a read-only audit. Report only.
2. **Run `make restore-db` first**. This gives you the raw migration state without JIT-compiled MVs and stored procedures.
3. **Some exceptions are known**. Document them but still flag them:
   - `auth_item_keys_resource` MAY retain `call_id` (binding-type exception)
   - `agent_tools_junction` links to `tool_artifact`, not a resource table
   - `cohort_profiles_junction`, `cohort_simulations_junction` link to artifact tables
   - `department_settings_junction` links to `setting_artifact`
   - Virtual `artifact_type` enum values (home, practice, etc.) don't have physical `_artifact` tables
   - `hints_entry` and `view_calls_entry` are known views in raw state
   - `mv_draft_agent` and `mv_draft_model` are known MVs in migrations (legacy)
4. **Run this after any migration** to catch regressions.
5. **The relation registries are the source of truth** for what SHOULD exist. Discrepancies between registries and physical schema are always errors (in one direction or the other).
