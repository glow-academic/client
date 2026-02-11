# Tool Audit — Args, Args Outputs, Bindings, Domains Integrity Check

You are a tool auditor for the GLOW project. Your job is to verify that all tools have consistent, complete, and correctly linked args, args_outputs, bindings, and domains. You do NOT fix anything. You REPORT errors, inconsistencies, and orphans.

**IMPORTANT**: Run `make restore-db` first for a clean baseline, then `make sql-compile` so MVs and SPs are available for any runtime queries.

---

## Database Credentials

```
psql postgresql://myuser:mypassword@localhost:5432/mydb
```

---

## The Tool Data Model

### Entity Relationship

```
tool_artifact
    |
    +-- tool_names_junction -----------> names_resource
    +-- tool_descriptions_junction ----> descriptions_resource
    +-- tool_flags_junction -----------> flags_resource (with value column)
    +-- tool_args_junction ------------> args_resource
    |                                        |
    |                                        +-- args_resource.field_type (string|number|boolean|array|uuid|...)
    |                                        +-- args_resource.required (bool)
    |                                        +-- args_resource.position (int, ordering)
    |                                        +-- args_resource.default_value (text)
    |
    +-- tool_args_outputs_junction ----> args_outputs_resource
    |                                        |
    |                                        +-- args_outputs_resource.args_id FK -> args_resource.id (CASCADE)
    |                                        +-- args_outputs_resource.template (Jinja template)
    |
    +-- tool_domains_junction ---------> domains_resource
    |                                        |
    |                                        +-- domains_resource.resource (resource_type enum)
    |                                        +-- domains_resource.creatable (bool)
    |
    +-- tool_bindings_junction --------> bindings_resource
    |                                        |
    |                                        +-- bindings_resource.entry (entry_type enum)
    |
    +-- tool_tools_junction -----------> tools_resource (meta-level tool registry)
    +-- tool_calls_junction -----------> calls_entry (call lineage)
```

### Runtime Value Tables

```
args_values_entry          — stores runtime input values per call
    args_id FK -> args_resource.id
    call_id (nullable — tracks which call produced the value)
    string_value | number_value | boolean_value  (exactly one non-null)

args_outputs_values_entry  — stores runtime output values per call
    args_outputs_id FK -> args_outputs_resource.id (via connection)
    call_id (nullable)
    string_value | number_value | boolean_value  (exactly one non-null)
```

### Registry Tables

```
resource_tools_relation    — maps tool_artifact.id -> resource_type enum for resource-level tool access
entry_tools_relation       — maps entry_type -> tool_artifact.id for entry-level tool access
```

---

## The Rules

### Rule 1: Every tool must have a name

Every `tool_artifact` must have at least one active row in `tool_names_junction`.

### Rule 2: Every args_output must link to a valid arg

Every `args_outputs_resource.args_id` must reference an existing `args_resource.id`. This is enforced by FK CASCADE, but we check for orphans anyway.

### Rule 3: Every args_output linked to a tool must reference an arg also linked to that same tool

If `tool_args_outputs_junction (tool_id, args_outputs_id)` exists, then the `args_outputs_resource.args_id` for that `args_outputs_id` must also appear in `tool_args_junction (tool_id, args_id)` for the SAME `tool_id`.

### Rule 4: No orphan args (linked to no tool)

Every `args_resource` row should be linked to at least one tool via `tool_args_junction`.

### Rule 5: No orphan args_outputs (linked to no tool)

Every `args_outputs_resource` row should be linked to at least one tool via `tool_args_outputs_junction`.

### Rule 6: Args positions must be contiguous per tool

For each tool, the `args_resource.position` values across its linked args should form a contiguous sequence starting from 0 (0, 1, 2, ...). Gaps indicate missing args or position errors.

### Rule 7: Args names must be unique per tool

For each tool, no two linked args should have the same `name`.

### Rule 8: Args output names must be unique per arg

For each `args_id`, no two `args_outputs_resource` rows should have the same `name`.

### Rule 9: Field types must be valid

`args_resource.field_type` must be one of the known types: `string`, `number`, `boolean`, `array`, `uuid`, `object`.

### Rule 10: Every tool must have domain entries for its standard resources

Every tool should have `tool_domains_junction` entries pointing to `domains_resource` rows for at least: `names`, `descriptions`, `flags`, `args`, `args_outputs`.

### Rule 11: Bindings must reference valid entry types

Every `bindings_resource.entry` value must be a valid `entry_type` enum value.

### Rule 12: resource_tools_relation must reference existing tools

Every `resource_tools_relation.tool_id` must reference an existing `tool_artifact.id`.

### Rule 13: entry_tools_relation must reference existing tools

Every `entry_tools_relation.tool_id` must reference an existing `tool_artifact.id`.

### Rule 14: Active junction consistency

If a tool has `tool_args_junction.active = false` for an arg, any `tool_args_outputs_junction` rows linking to args_outputs that reference that arg should also be inactive.

### Rule 15: Args type column should not be nullable

`args_resource.type` (flag_type) is nullable — audit how many rows have NULL vs. a value.

### Rule 16: Calls connection completeness

Every `args_resource` should have a corresponding `args_calls_connection` row. Same for `args_outputs_resource` -> `args_outputs_calls_connection`.

---

## Audit Queries

### Audit 1: Tools without names

```sql
SELECT ta.id AS tool_id
FROM tool_artifact ta
WHERE NOT EXISTS (
    SELECT 1 FROM tool_names_junction tnj
    WHERE tnj.tool_id = ta.id AND tnj.active = true
)
ORDER BY ta.id;
```

**Expected**: Empty. Any rows = tool has no active name.

### Audit 2: Orphan args_outputs (args_id points to non-existent arg)

```sql
SELECT ao.id AS args_outputs_id, ao.args_id, ao.name
FROM args_outputs_resource ao
WHERE NOT EXISTS (
    SELECT 1 FROM args_resource ar WHERE ar.id = ao.args_id
)
ORDER BY ao.id;
```

**Expected**: Empty (FK should prevent this, but check anyway).

### Audit 3: Args_outputs linked to tool but their parent arg is NOT linked to same tool

```sql
SELECT
    taoj.tool_id,
    ao.id AS args_outputs_id,
    ao.args_id,
    ao.name AS output_name
FROM tool_args_outputs_junction taoj
JOIN args_outputs_resource ao ON ao.id = taoj.args_outputs_id
WHERE NOT EXISTS (
    SELECT 1 FROM tool_args_junction taj
    WHERE taj.tool_id = taoj.tool_id
        AND taj.args_id = ao.args_id
)
ORDER BY taoj.tool_id, ao.id;
```

**Expected**: Empty. Any rows = args_output is linked to a tool but its parent arg is not.

### Audit 4: Orphan args (not linked to any tool)

```sql
SELECT ar.id, ar.name, ar.field_type
FROM args_resource ar
WHERE NOT EXISTS (
    SELECT 1 FROM tool_args_junction taj WHERE taj.args_id = ar.id
)
ORDER BY ar.name;
```

**Expected**: Empty. Any rows = arg exists but is not linked to any tool.

### Audit 5: Orphan args_outputs (not linked to any tool)

```sql
SELECT ao.id, ao.name, ao.args_id
FROM args_outputs_resource ao
WHERE NOT EXISTS (
    SELECT 1 FROM tool_args_outputs_junction taoj WHERE taoj.args_outputs_id = ao.id
)
ORDER BY ao.name;
```

**Expected**: Empty.

### Audit 6: Non-contiguous arg positions per tool

```sql
WITH tool_positions AS (
    SELECT
        taj.tool_id,
        ar.position,
        ROW_NUMBER() OVER (PARTITION BY taj.tool_id ORDER BY ar.position) - 1 AS expected_position
    FROM tool_args_junction taj
    JOIN args_resource ar ON ar.id = taj.args_id
    WHERE taj.active = true AND ar.active = true
)
SELECT tool_id, position, expected_position
FROM tool_positions
WHERE position <> expected_position
ORDER BY tool_id, position;
```

**Expected**: Empty. Any rows = position gap or non-zero start.

### Audit 7: Duplicate arg names per tool

```sql
SELECT taj.tool_id, ar.name, COUNT(*) AS cnt
FROM tool_args_junction taj
JOIN args_resource ar ON ar.id = taj.args_id
WHERE taj.active = true AND ar.active = true
GROUP BY taj.tool_id, ar.name
HAVING COUNT(*) > 1
ORDER BY taj.tool_id, ar.name;
```

**Expected**: Empty.

### Audit 8: Duplicate args_output names per arg

```sql
SELECT ao.args_id, ao.name, COUNT(*) AS cnt
FROM args_outputs_resource ao
WHERE ao.active = true
GROUP BY ao.args_id, ao.name
HAVING COUNT(*) > 1
ORDER BY ao.args_id, ao.name;
```

**Expected**: Empty.

### Audit 9: Invalid field_type values

```sql
SELECT ar.id, ar.name, ar.field_type
FROM args_resource ar
WHERE ar.field_type NOT IN ('string', 'number', 'boolean', 'array', 'uuid', 'object')
ORDER BY ar.name;
```

**Expected**: Empty. Any rows = unknown field_type (review if intentional).

### Audit 10: Tools missing standard domain entries

```sql
WITH required_domains AS (
    SELECT unnest(ARRAY['names', 'descriptions', 'flags', 'args', 'args_outputs']) AS resource_name
),
tool_domains AS (
    SELECT tdj.tool_id, dr.resource::text AS resource_name
    FROM tool_domains_junction tdj
    JOIN domains_resource dr ON dr.id = tdj.domain_id
    WHERE tdj.active = true
)
SELECT ta.id AS tool_id, rd.resource_name AS missing_domain
FROM tool_artifact ta
CROSS JOIN required_domains rd
WHERE NOT EXISTS (
    SELECT 1 FROM tool_domains AS td
    WHERE td.tool_id = ta.id AND td.resource_name = rd.resource_name
)
ORDER BY ta.id, rd.resource_name;
```

**Expected**: Empty. Any rows = tool missing a standard domain entry.

### Audit 11: Invalid binding entry types

```sql
SELECT br.id, br.entry::text
FROM bindings_resource br
WHERE br.entry::text NOT IN (
    SELECT e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'entry_type'
)
ORDER BY br.entry;
```

**Expected**: Empty (enum constraint should prevent this).

### Audit 12: resource_tools_relation pointing to non-existent tools

```sql
SELECT rtr.tool_id, rtr.resource::text
FROM resource_tools_relation rtr
WHERE NOT EXISTS (
    SELECT 1 FROM tool_artifact ta WHERE ta.id = rtr.tool_id
)
ORDER BY rtr.resource;
```

**Expected**: Empty.

### Audit 13: entry_tools_relation pointing to non-existent tools

```sql
SELECT etr.entry::text, etr.tool_id
FROM entry_tools_relation etr
WHERE NOT EXISTS (
    SELECT 1 FROM tool_artifact ta WHERE ta.id = etr.tool_id
)
ORDER BY etr.entry;
```

**Expected**: Empty.

### Audit 14: Active args_outputs linked to inactive args (within same tool)

```sql
SELECT
    taoj.tool_id,
    ao.id AS args_outputs_id,
    ao.args_id,
    taj.active AS arg_junction_active,
    taoj.active AS output_junction_active
FROM tool_args_outputs_junction taoj
JOIN args_outputs_resource ao ON ao.id = taoj.args_outputs_id
JOIN tool_args_junction taj ON taj.tool_id = taoj.tool_id AND taj.args_id = ao.args_id
WHERE taoj.active = true AND taj.active = false
ORDER BY taoj.tool_id;
```

**Expected**: Empty. Any rows = active output linked to deactivated arg.

### Audit 15: Args with NULL type column

```sql
SELECT ar.id, ar.name, ar.field_type, ar.type IS NULL AS type_is_null
FROM args_resource ar
ORDER BY ar.type IS NULL DESC, ar.name;
```

**Expected**: Informational. Count how many have `type IS NULL`.

### Audit 16: Args/args_outputs missing calls_connection

```sql
-- 16a: Args without calls_connection
SELECT ar.id, ar.name
FROM args_resource ar
WHERE NOT EXISTS (
    SELECT 1 FROM args_calls_connection acc WHERE acc.args_id = ar.id
)
ORDER BY ar.name;
```

```sql
-- 16b: Args_outputs without calls_connection
SELECT ao.id, ao.name
FROM args_outputs_resource ao
WHERE NOT EXISTS (
    SELECT 1 FROM args_outputs_calls_connection aocc WHERE aocc.args_outputs_id = ao.id
)
ORDER BY ao.name;
```

**Expected**: Empty. Any rows = resource missing call traceability.

### Audit 17: Args_outputs template validation

```sql
-- Args_outputs with empty templates (may be intentional but worth flagging)
SELECT ao.id, ao.name, ao.args_id, ar.name AS arg_name
FROM args_outputs_resource ao
JOIN args_resource ar ON ar.id = ao.args_id
WHERE ao.template = '' OR ao.template IS NULL
ORDER BY ar.name, ao.name;
```

**Expected**: Informational. Empty templates may mean the output just passes through the value.

### Audit 18: Cross-tool arg sharing (informational)

```sql
-- Args linked to multiple tools (not necessarily wrong, but worth knowing)
SELECT ar.id, ar.name, ar.field_type, COUNT(DISTINCT taj.tool_id) AS tool_count
FROM args_resource ar
JOIN tool_args_junction taj ON taj.args_id = ar.id
GROUP BY ar.id, ar.name, ar.field_type
HAVING COUNT(DISTINCT taj.tool_id) > 1
ORDER BY tool_count DESC, ar.name;
```

**Expected**: Informational. Args are resources and CAN be shared, but shared args mean a change affects multiple tools.

### Audit 19: Tool completeness summary

```sql
-- Per-tool summary: name, arg count, output count, binding count, domain count
SELECT
    ta.id AS tool_id,
    (SELECT nr.name FROM tool_names_junction tnj
     JOIN names_resource nr ON nr.id = tnj.name_id
     WHERE tnj.tool_id = ta.id AND tnj.active = true LIMIT 1) AS tool_name,
    (SELECT COUNT(*) FROM tool_args_junction taj
     WHERE taj.tool_id = ta.id AND taj.active = true) AS arg_count,
    (SELECT COUNT(*) FROM tool_args_outputs_junction taoj
     WHERE taoj.tool_id = ta.id AND taoj.active = true) AS output_count,
    (SELECT COUNT(*) FROM tool_bindings_junction tbj
     WHERE tbj.tool_id = ta.id AND tbj.active = true) AS binding_count,
    (SELECT COUNT(*) FROM tool_domains_junction tdj
     WHERE tdj.tool_id = ta.id AND tdj.active = true) AS domain_count,
    (SELECT COUNT(*) FROM tool_descriptions_junction tdej
     WHERE tdej.tool_id = ta.id AND tdej.active = true) AS has_description,
    (SELECT COUNT(*) FROM tool_flags_junction tfj
     WHERE tfj.tool_id = ta.id AND tfj.active = true) AS has_flag
FROM tool_artifact ta
ORDER BY tool_name;
```

**Expected**: Informational. Every tool should have arg_count >= 0, output_count >= 0, has_description = 1, has_flag >= 1, domain_count >= 5.

### Audit 20: Bidirectional junction integrity

```sql
-- 20a: tool_args_junction rows where the arg no longer exists
SELECT taj.tool_id, taj.args_id
FROM tool_args_junction taj
WHERE NOT EXISTS (
    SELECT 1 FROM args_resource ar WHERE ar.id = taj.args_id
)
ORDER BY taj.tool_id;
```

```sql
-- 20b: tool_args_outputs_junction rows where the args_output no longer exists
SELECT taoj.tool_id, taoj.args_outputs_id
FROM tool_args_outputs_junction taoj
WHERE NOT EXISTS (
    SELECT 1 FROM args_outputs_resource ao WHERE ao.id = taoj.args_outputs_id
)
ORDER BY taoj.tool_id;
```

**Expected**: Both empty (FK CASCADE should handle this).

---

## Running the Audit

### Prerequisites

```bash
make restore-db      # Reset to raw migration state
make sql-compile     # Compile MVs and SPs (if needed for runtime queries)
```

### Execution

Run each query inline or concatenate into a single script:

```bash
psql postgresql://myuser:mypassword@localhost:5432/mydb -f tool_audit.sql
```

---

## Report Format

For each audit that returns rows, report:

```
AUDIT {N}: {Title}
RULE VIOLATED: Rule {N}
ROWS RETURNED: {count}
DETAILS:
  - {tool_id}: {description of violation}
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
Warnings: {N} (informational audits like 15, 17, 18, 19)
```

---

## Important Notes

1. **Do NOT fix anything**. This is a read-only audit. Report only.
2. **The old schema/template system was dropped** in migration 261. `schemas`, `schema_fields`, `schema_field_items`, `template_schemas`, `tool_schemas`, `tool_templates` no longer exist. They were replaced by `args_resource` and `args_outputs_resource`.
3. **`templates_resource` is unrelated to tools** — it stores HTML templates for documents/scenarios, not tool I/O definitions.
4. **tool_tools_junction** links `tool_artifact` to `tools_resource` (a meta-level registry resource). This is an artifact-to-resource junction, not self-referential.
5. **tool_calls_junction** links `tool_artifact` to `calls_entry`. This is an artifact-to-entry junction tracking call lineage.
6. **Args can be shared across tools** — a single `args_resource` row can appear in multiple `tool_args_junction` rows. This is valid but changes to shared args affect all linked tools.
7. **Run this after any tool migration** to catch regressions.
