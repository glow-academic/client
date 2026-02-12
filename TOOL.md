# Tool Audit — Args, Args Outputs, Bindings, Domains, Registry Integrity Check

You are a tool auditor for the GLOW project. Your job is to verify that all tools have consistent, complete, and correctly linked args, args_outputs, bindings, domains, and registry relations. You do NOT fix anything. You REPORT errors, inconsistencies, and orphans.

**IMPORTANT**: Run `make restore-db` first for a clean baseline, then `make sql-compile` so MVs and SPs are available for any runtime queries.

---

## Database Credentials

```
psql postgresql://myuser:mypassword@localhost:5432/mydb
```

---

## The Tool Data Model

### Tool Types

Tools are categorized by naming convention:

- **`create_*` tools**: Create new resource or entry instances. Linked to `domains_resource` (for resources) or `bindings_resource` (for entries).
- **`use_*` tools**: Link/reference existing resources (non-creatable). These are "link tools" that wire existing data into artifacts.

### Entity Relationship

```
tool_artifact
    |
    +-- tool_names_junction -----------> names_resource
    +-- tool_descriptions_junction ----> descriptions_resource
    +-- tool_flags_junction -----------> flags_resource (with value column)
    +-- tool_args_junction ------------> args_resource
    |                                        |
    |                                        +-- args_resource.field_type (string|number|boolean|array|uuid|object)
    |                                        +-- args_resource.required (bool)
    |                                        +-- args_resource.default_value (text)
    |
    +-- tool_arg_positions_junction ---> arg_positions_resource
    |                                        |
    |                                        +-- arg_positions_resource.args_id FK -> args_resource.id
    |                                        +-- arg_positions_resource.value (int, per-tool ordering)
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
resource_tools_relation    — maps resource_type -> tool_artifact.id
                             Every resource should have a create_* tool.
                             Non-creatable resources should also have a use_* tool.

entry_tools_relation       — maps entry_type -> tool_artifact.id
                             Every binding entry type should have a create_* tool.

domains_resource           — declares which resources a tool operates on
                             creatable = true: tool creates new instances
                             creatable = false: tool links existing instances

bindings_resource          — declares which entry types a tool creates
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

### Rule 6: Arg positions must be contiguous per tool

For each tool, the `arg_positions_resource.value` entries (via `tool_arg_positions_junction`) should form a contiguous sequence starting from 0 (0, 1, 2, ...). Gaps indicate missing args or position errors. Positions are per-tool (not per-arg) since args can be shared.

### Rule 7: Args names must be unique per tool

For each tool, no two linked args should have the same `name`.

### Rule 8: Args output names must be unique per arg

For each `args_id`, no two `args_outputs_resource` rows should have the same `name`.

### Rule 9: Field types must be valid

`args_resource.field_type` must be one of the known types: `string`, `number`, `boolean`, `array`, `uuid`, `object`.

### Rule 10: Resource tools must map to exactly one matching domain

For every tool registered in `resource_tools_relation`:
- it must target exactly one active `resource_tools_relation.resource`
- it must have exactly one active `tool_domains_junction` domain
- that domain's `domains_resource.resource` must match the tool's target resource

Entry-oriented tools are validated via bindings and `entry_tools_relation` (Rules 20/21), not via metadata domains.

### Rule 11: Bindings must reference valid entry types

Every `bindings_resource.entry` value must be a valid `entry_type` enum value.

### Rule 12: resource_tools_relation must reference existing tools

Every `resource_tools_relation.tool_id` must reference an existing `tool_artifact.id`.

### Rule 13: entry_tools_relation must reference existing tools

Every `entry_tools_relation.tool_id` must reference an existing `tool_artifact.id`.

### Rule 14: Active junction consistency

If a tool has `tool_args_junction.active = false` for an arg, any `tool_args_outputs_junction` rows linking to args_outputs that reference that arg should also be inactive.

### Rule 15: Calls connection completeness

Every `args_resource` should have a corresponding `args_calls_connection` row. Same for `args_outputs_resource` -> `args_outputs_calls_connection`.

### Rule 16: Every non-creatable domain must have a use_ (link) tool

For every `domains_resource` row with `creatable = false`, there must be a corresponding `use_*` tool registered in `resource_tools_relation` for that resource. Link tools allow wiring existing resources into artifacts without creating new ones.

### Rule 17: Every creatable domain must have a create_ tool

For every `domains_resource` row with `creatable = true`, there must be a corresponding `create_*` tool registered in `resource_tools_relation` for that resource.

### Rule 18: Every domain must have a corresponding resource_tools_relation entry

Every `domains_resource.resource` value must appear in `resource_tools_relation` with at least one tool. A domain without a registered tool is unreachable.

### Rule 19: Every resource in resource_tools_relation must have a domain

Every distinct `resource_tools_relation.resource` value must have a corresponding active `domains_resource` row. Resources registered in the relation table but missing from domains are orphan registrations.

### Rule 20: Every binding must have a create_ tool

For every `bindings_resource.entry` value, there must be a `create_*` tool linked via `tool_bindings_junction` to that binding. Bindings declare entry types that a tool creates — an unlinked binding is unreachable.

### Rule 21: Every binding entry type should be registered in entry_tools_relation

Every `bindings_resource.entry` value should have a corresponding row in `entry_tools_relation` mapping it to its create tool.

### Rule 22: Every arg must have a position entry per tool

For each `(tool_id, args_id)` in `tool_args_junction`, there must be a corresponding `arg_positions_resource` row (with matching `args_id`) linked to the same tool via `tool_arg_positions_junction`.

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
        tapj.tool_id,
        apr.value AS position,
        ROW_NUMBER() OVER (PARTITION BY tapj.tool_id ORDER BY apr.value) - 1 AS expected_position
    FROM tool_arg_positions_junction tapj
    JOIN arg_positions_resource apr ON apr.id = tapj.arg_positions_id
    WHERE tapj.active = true AND apr.active = true
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

### Audit 10: Resource tools without a single matching domain

```sql
WITH resource_tools AS (
    SELECT
        rtr.tool_id,
        ARRAY_AGG(DISTINCT rtr.resource::text ORDER BY rtr.resource::text) AS resources,
        COUNT(DISTINCT rtr.resource) AS resource_count
    FROM resource_tools_relation rtr
    WHERE rtr.active = true
    GROUP BY rtr.tool_id
),
tool_domains AS (
    SELECT
        tdj.tool_id,
        ARRAY_AGG(DISTINCT dr.resource::text ORDER BY dr.resource::text) AS domains,
        COUNT(DISTINCT dr.resource) AS domain_count
    FROM tool_domains_junction tdj
    JOIN domains_resource dr ON dr.id = tdj.domain_id
    WHERE tdj.active = true AND dr.active = true
    GROUP BY tdj.tool_id
),
violations AS (
    SELECT
        rt.tool_id,
        CASE
            WHEN rt.resource_count <> 1 THEN 'resource_relation_not_single'
            WHEN COALESCE(td.domain_count, 0) <> 1 THEN 'domain_not_single'
            WHEN NOT (rt.resources[1] = ANY(COALESCE(td.domains, ARRAY[]::text[]))) THEN 'domain_resource_mismatch'
        END AS issue,
        rt.resources,
        COALESCE(td.domains, ARRAY[]::text[]) AS domains
    FROM resource_tools rt
    LEFT JOIN tool_domains td ON td.tool_id = rt.tool_id
)
SELECT
    v.tool_id,
    (SELECT nr.name
     FROM tool_names_junction tnj
     JOIN names_resource nr ON nr.id = tnj.name_id
     WHERE tnj.tool_id = v.tool_id AND tnj.active = true
     LIMIT 1) AS tool_name,
    v.issue,
    v.resources,
    v.domains
FROM violations v
WHERE v.issue IS NOT NULL
ORDER BY tool_name, v.tool_id;
```

**Expected**: Empty. Any rows = resource tool/domain mapping drift.

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

### Audit 15: Args/args_outputs missing calls_connection

```sql
-- 15a: Args without calls_connection
SELECT ar.id, ar.name
FROM args_resource ar
WHERE NOT EXISTS (
    SELECT 1 FROM args_calls_connection acc WHERE acc.args_id = ar.id
)
ORDER BY ar.name;
```

```sql
-- 15b: Args_outputs without calls_connection
SELECT ao.id, ao.name
FROM args_outputs_resource ao
WHERE NOT EXISTS (
    SELECT 1 FROM args_outputs_calls_connection aocc WHERE aocc.args_outputs_id = ao.id
)
ORDER BY ao.name;
```

**Expected**: Empty. Any rows = resource missing call traceability.

### Audit 16: Non-creatable domains missing use_ (link) tools

```sql
SELECT dr.resource::text AS domain_resource
FROM domains_resource dr
WHERE dr.active = true AND dr.creatable = false
    AND NOT EXISTS (
        SELECT 1 FROM resource_tools_relation rtr
        JOIN tool_names_junction tnj ON tnj.tool_id = rtr.tool_id AND tnj.active = true
        JOIN names_resource nr ON nr.id = tnj.name_id
        WHERE rtr.resource = dr.resource AND nr.name LIKE 'use_%'
    )
ORDER BY dr.resource;
```

**Expected**: Empty. Any rows = non-creatable domain has no link tool. Users cannot wire this resource into artifacts.

### Audit 17: Creatable domains missing create_ tools

```sql
SELECT dr.resource::text AS domain_resource
FROM domains_resource dr
WHERE dr.active = true AND dr.creatable = true
    AND NOT EXISTS (
        SELECT 1 FROM resource_tools_relation rtr
        JOIN tool_names_junction tnj ON tnj.tool_id = rtr.tool_id AND tnj.active = true
        JOIN names_resource nr ON nr.id = tnj.name_id
        WHERE rtr.resource = dr.resource AND nr.name LIKE 'create_%'
    )
ORDER BY dr.resource;
```

**Expected**: Empty. Any rows = creatable domain has no create tool. The resource cannot be created.

### Audit 18: Domains without resource_tools_relation entries

```sql
SELECT dr.resource::text AS domain_resource
FROM domains_resource dr
WHERE dr.active = true
    AND NOT EXISTS (
        SELECT 1 FROM resource_tools_relation rtr WHERE rtr.resource = dr.resource
    )
ORDER BY dr.resource;
```

**Expected**: Empty. Any rows = domain declares a resource but no tool is registered to handle it.

### Audit 19: resource_tools_relation entries without domains

```sql
SELECT rtr.resource::text AS orphan_resource,
    (SELECT nr.name FROM tool_names_junction tnj JOIN names_resource nr ON nr.id = tnj.name_id
     WHERE tnj.tool_id = rtr.tool_id AND tnj.active = true LIMIT 1) AS tool_name
FROM resource_tools_relation rtr
WHERE NOT EXISTS (
    SELECT 1 FROM domains_resource dr WHERE dr.resource = rtr.resource AND dr.active = true
)
ORDER BY rtr.resource;
```

**Expected**: Empty. Any rows = tool is registered for a resource that has no domain declaration.

### Audit 20: Bindings without a linked create_ tool

```sql
SELECT br.entry::text AS binding_entry
FROM bindings_resource br
WHERE br.active = true
    AND NOT EXISTS (
        SELECT 1 FROM tool_bindings_junction tbj
        JOIN tool_names_junction tnj ON tnj.tool_id = tbj.tool_id AND tnj.active = true
        JOIN names_resource nr ON nr.id = tnj.name_id
        WHERE tbj.binding_id = br.id AND tbj.active = true AND nr.name LIKE 'create_%'
    )
ORDER BY br.entry;
```

**Expected**: Empty. Any rows = binding declares an entry type but no create tool is linked to produce it.

### Audit 21: Binding entry types missing from entry_tools_relation

```sql
SELECT br.entry::text AS binding_entry
FROM bindings_resource br
WHERE br.active = true
    AND NOT EXISTS (
        SELECT 1 FROM entry_tools_relation etr WHERE etr.entry = br.entry
    )
ORDER BY br.entry;
```

**Expected**: Empty. Any rows = binding entry type not registered in the entry-tool mapping.

### Audit 22: Args missing position entries per tool

```sql
SELECT taj.tool_id, taj.args_id, ar.name AS arg_name,
    (SELECT nr.name FROM tool_names_junction tnj JOIN names_resource nr ON nr.id = tnj.name_id
     WHERE tnj.tool_id = taj.tool_id AND tnj.active = true LIMIT 1) AS tool_name
FROM tool_args_junction taj
JOIN args_resource ar ON ar.id = taj.args_id
WHERE taj.active = true AND ar.active = true
    AND NOT EXISTS (
        SELECT 1 FROM tool_arg_positions_junction tapj
        JOIN arg_positions_resource apr ON apr.id = tapj.arg_positions_id
        WHERE tapj.tool_id = taj.tool_id AND apr.args_id = taj.args_id
            AND tapj.active = true AND apr.active = true
    )
ORDER BY tool_name, ar.name;
```

**Expected**: Empty. Any rows = tool has an arg but no position entry for it.

### Audit 23: Args_outputs template validation (informational)

```sql
-- Args_outputs with empty templates (may be intentional but worth flagging)
SELECT ao.id, ao.name, ao.args_id, ar.name AS arg_name
FROM args_outputs_resource ao
JOIN args_resource ar ON ar.id = ao.args_id
WHERE ao.template = '' OR ao.template IS NULL
ORDER BY ar.name, ao.name;
```

**Expected**: Informational. Empty templates may mean the output just passes through the value.

### Audit 24: Cross-tool arg sharing (informational)

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

### Audit 25: Tool completeness summary (informational)

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
     WHERE tfj.tool_id = ta.id AND tfj.active = true) AS has_flag,
    (SELECT COUNT(*) FROM tool_arg_positions_junction tapj
     WHERE tapj.tool_id = ta.id AND tapj.active = true) AS position_count
FROM tool_artifact ta
ORDER BY tool_name;
```

**Expected**: Informational. Every tool should have arg_count >= 0, output_count >= 0, has_description = 1, has_flag >= 1, domain_count >= 5, position_count = arg_count.

### Audit 26: Bidirectional junction integrity

```sql
-- 26a: tool_args_junction rows where the arg no longer exists
SELECT taj.tool_id, taj.args_id
FROM tool_args_junction taj
WHERE NOT EXISTS (
    SELECT 1 FROM args_resource ar WHERE ar.id = taj.args_id
)
ORDER BY taj.tool_id;
```

```sql
-- 26b: tool_args_outputs_junction rows where the args_output no longer exists
SELECT taoj.tool_id, taoj.args_outputs_id
FROM tool_args_outputs_junction taoj
WHERE NOT EXISTS (
    SELECT 1 FROM args_outputs_resource ao WHERE ao.id = taoj.args_outputs_id
)
ORDER BY taoj.tool_id;
```

**Expected**: Both empty (FK CASCADE should handle this).

### Audit 27: Domain/binding coverage summary (informational)

```sql
-- Full domain coverage: resource, creatable, has create tool, has use tool
SELECT
    dr.resource::text,
    dr.creatable,
    EXISTS(
        SELECT 1 FROM resource_tools_relation rtr
        JOIN tool_names_junction tnj ON tnj.tool_id = rtr.tool_id AND tnj.active = true
        JOIN names_resource nr ON nr.id = tnj.name_id
        WHERE rtr.resource = dr.resource AND nr.name LIKE 'create_%'
    ) AS has_create_tool,
    EXISTS(
        SELECT 1 FROM resource_tools_relation rtr
        JOIN tool_names_junction tnj ON tnj.tool_id = rtr.tool_id AND tnj.active = true
        JOIN names_resource nr ON nr.id = tnj.name_id
        WHERE rtr.resource = dr.resource AND nr.name LIKE 'use_%'
    ) AS has_use_tool
FROM domains_resource dr
WHERE dr.active = true
ORDER BY dr.resource;
```

**Expected**: Informational. Creatable domains should have `has_create_tool = true`. Non-creatable domains should have `has_use_tool = true`. Both can also have the other.

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
Total audits: 27
Passed: {N}
Failed: {N}
Warnings: {N} (informational audits like 23, 24, 25, 27)
```

---

## Important Notes

1. **Do NOT fix anything**. This is a read-only audit. Report only.
2. **The old schema/template system was dropped** in migration 261. `schemas`, `schema_fields`, `schema_field_items`, `template_schemas`, `tool_schemas`, `tool_templates` no longer exist. They were replaced by `args_resource` and `args_outputs_resource`.
3. **`templates_resource` is unrelated to tools** — it stores HTML templates for documents/scenarios, not tool I/O definitions.
4. **tool_tools_junction** links `tool_artifact` to `tools_resource` (a meta-level registry resource). This is an artifact-to-resource junction, not self-referential.
5. **tool_calls_junction** links `tool_artifact` to `calls_entry`. This is an artifact-to-entry junction tracking call lineage.
6. **Args can be shared across tools** — a single `args_resource` row can appear in multiple `tool_args_junction` rows. This is valid but changes to shared args affect all linked tools.
7. **Positions are per-tool** — `arg_positions_resource` stores position per (tool, arg) pair via `tool_arg_positions_junction`, not on `args_resource` directly.
8. **`create_*` vs `use_*` naming** — the tool name prefix determines its role. `create_*` tools produce new resources/entries. `use_*` tools link existing ones. The naming convention MUST match the domain's `creatable` flag.
9. **Run this after any tool migration** to catch regressions.
