# LIST Audit — Artifact List Endpoint Integrity Check

You are an artifact LIST endpoint auditor for the GLOW project. Your job is to verify that every artifact's `list.py` endpoint follows the canonical resource-first list pattern defined below. You do NOT fix anything. You REPORT errors, inconsistencies, and missing pieces.

The source of truth is the **persona** list implementation. Every artifact list must match this pattern or document an approved deviation.

---

## The Resource-First List Pattern

| Layer | Location | Purpose |
|-------|----------|---------|
| **SQL** | `server/app/sql/v4/queries/{artifact}s/get_{artifact}s_list_complete.sql` | Resource-first query: artifact table + own junctions + resource tables only |
| **Python** | `server/app/api/v4/artifacts/{artifact}/list.py` | Hydration, search filtering, permission computation, caching |
| **Permissions** | `server/app/api/v4/artifacts/{artifact}/permissions.py` | Pure Python per-item permission computation |

Reference: `server/app/api/v4/artifacts/persona/list.py`, `server/app/sql/v4/queries/personas/get_personas_list_complete.sql`

---

## The Rules

### Rule 1: SQL only touches artifact's own tables + resource tables

The list SQL must only query:

- `{artifact}_artifact` (the root table)
- `{artifact}_*_junction` (the artifact's own junction tables)
- `*_resource` tables (for names, descriptions, filter data)

It must NOT join through other artifact tables (e.g., `scenario_artifact`, `field_artifact`).

```
Tables ALLOWED:
  persona_artifact, persona_names_junction, persona_descriptions_junction,
  persona_colors_junction, persona_flags_junction, persona_departments_junction,
  names_resource, descriptions_resource, colors_resource, flags_resource,
  departments_resource, personas_resource, scenarios_resource, fields_resource

Tables NOT ALLOWED:
  scenario_artifact, field_artifact, department_artifact,
  view_persona_edit_state, scenario_personas_junction
```

Reference: `server/app/sql/v4/queries/personas/get_personas_list_complete.sql`

### Rule 2: Above-facing filters use denormalized arrays

For filters that reference parent entities (entities that contain this artifact), the SQL must use denormalized arrays on resource tables instead of traversing parent artifact junction tables.

```sql
-- CORRECT: denormalized array on resource table
scenarios_resource WHERE personas_resource.id = ANY(scenarios_resource.persona_ids)

-- INCORRECT: traversing parent artifact junctions
scenario_personas_junction JOIN scenario_artifact
```

Denormalized arrays: `scenarios_resource.persona_ids`, `simulations_resource.scenario_ids`, `cohorts_resource.simulation_ids`.

Reference: REFERENCE.md Section 18

### Rule 3: Each artifact defines 3 filter dimensions

Each artifact list endpoint must define exactly 3 relevant filter dimensions for client-side filtering. The persona example uses:

- **Scenarios** — parent entities that use this persona
- **Fields** — parameter fields associated with this persona
- **Departments** — departments this persona belongs to

Each artifact must define its own 3 dimensions based on its relationships.

### Rule 4: Filter IDs are resource IDs, not artifact IDs

All filter option IDs returned by the list SQL must be resource IDs (e.g., `scenarios_resource.id`, `fields_resource.id`, `departments_resource.id`), never artifact IDs.

### Rule 5: SQL returns option IDs + counts only — no names

The list SQL returns filter option IDs and their counts. It does NOT return option names in the SQL query. Names are hydrated in Python.

```sql
-- SQL returns:
scenario_option_ids UUID[]
scenario_option_counts INT[]
-- NOT: scenario_option_names TEXT[]
```

### Rule 6: Python hydrates filter option names via cached `*_internal()`

After receiving option IDs from SQL, Python hydrates names by calling cached resource `*_internal()` functions in parallel:

```python
(scenario_resources, field_resources, department_resources) = await asyncio.gather(
    get_scenarios_internal(pool, all_scenario_ids),
    get_fields_internal(pool, all_field_ids),
    get_departments_internal(pool, all_department_ids),
)
```

Reference: `server/app/api/v4/artifacts/persona/list.py`

### Rule 7: Python applies search filtering

Search filtering (case-insensitive substring match on name) is applied in Python after name hydration, not in SQL. This ensures consistent behavior across all filter dimensions.

### Rule 8: Per-item permission computation in Python

Each list item must have permissions computed in Python via `permissions.py` functions:

- `can_edit` — via `compute_can_edit()`
- `can_delete` — via `compute_can_delete()`
- `can_duplicate` — via `compute_can_duplicate()`

These functions receive user context from `get_auth_profile_internal()`.

```python
from app.api.v4.auth.profile import get_auth_profile_internal

profile_ctx = await get_auth_profile_internal(conn, profile_id, bypass_cache)
for item in items:
    item.can_edit = compute_can_edit(
        user_role=profile_ctx.access.role,
        artifact_department_ids=item.department_ids,
        active_usage_count=item.active_scenario_count,
    )
```

Reference: `server/app/api/v4/artifacts/persona/list.py`, `permissions.py`

### Rule 9: User context from `get_auth_profile_internal()`

User context (user role, actor name, department IDs) must come from `get_auth_profile_internal()`, not from the list SQL query or the monolithic `get_profile_context_internal()`. See GET.md Rule 2 for the full profile/settings split pattern.

### Rule 10: Caching with proper key and tags

List endpoints must implement caching:

- Cache key: `cache_key(path, body_dict)` including all input parameters
- Read cache: `get_cached()` / `set_cached()`
- Cache tags: `["{artifact}s"]`
- Response headers: `X-Cache-Tags`, `X-Cache-Hit`

```python
cached = await get_cached(cache_key_str)
if cached:
    return JSONResponse(content=cached, headers={"X-Cache-Hit": "true", "X-Cache-Tags": ...})
```

Reference: `server/app/api/v4/artifacts/persona/list.py`

### Rule 11: Pagination support

List endpoints must support pagination via:

- Request: `page_size: int`, `page_offset: int`
- Response: `total_count: int`

### Rule 12: Response shape

The list response must contain:

- `items` — list of items with computed permissions (`can_edit`, `can_delete`, `can_duplicate`)
- `filter_options` — per dimension, each option has `id`, `name`, `description`, `count`
- `total_count` — total number of items matching the query

```python
class ListPersonasApiResponse(BaseModel):
    items: list[PersonaListItem]
    scenario_options: list[FilterOption]
    field_options: list[FilterOption]
    department_options: list[FilterOption]
    total_count: int
```

Reference: `server/app/api/v4/artifacts/persona/types.py`

---

## MUST NOT Rules

1. **MUST NOT** join cross-entity artifact tables in list SQL (e.g., `scenario_artifact` in persona list)
2. **MUST NOT** use legacy views (e.g., `view_persona_edit_state`) for list data
3. **MUST NOT** return filter option names from SQL — Python hydrates them
4. **MUST NOT** use artifact IDs as filter option IDs — always resource IDs
5. **MUST NOT** compute permissions in SQL — permissions are pure Python
6. **MUST NOT** skip caching on list endpoints

---

## Audit Checks

### Audit 1: List endpoint existence

```bash
for artifact_dir in server/app/api/v4/artifacts/*/; do
  artifact=$(basename "$artifact_dir")
  [ ! -f "${artifact_dir}list.py" ] && echo "MISSING LIST ENDPOINT: $artifact"
done
```

**Expected**: All artifacts that need a list page should have `list.py`.

### Audit 2: SQL only touches own tables

```bash
for sql_file in server/app/sql/v4/queries/*/get_*_list_complete.sql; do
  artifact=$(basename "$(dirname "$sql_file")")
  # Check for cross-entity artifact table joins
  grep -iE "JOIN\s+\w+_artifact" "$sql_file" | grep -v "${artifact}_artifact" | while read line; do
    echo "CROSS-ENTITY JOIN ($artifact): $line"
  done
done
```

**Expected**: Empty. No cross-entity artifact joins.

### Audit 3: No legacy view usage

```bash
for sql_file in server/app/sql/v4/queries/*/get_*_list_complete.sql; do
  artifact=$(basename "$(dirname "$sql_file")")
  grep -i "view_.*_edit_state" "$sql_file" && echo "LEGACY VIEW: $artifact ($sql_file)"
done
```

**Expected**: Empty.

### Audit 4: Python hydration pattern

```bash
for artifact_dir in server/app/api/v4/artifacts/*/; do
  artifact=$(basename "$artifact_dir")
  file="${artifact_dir}list.py"
  [ ! -f "$file" ] && continue
  grep -q "asyncio.gather" "$file" || echo "NO PARALLEL HYDRATION: $artifact"
  grep -q "_internal" "$file" || echo "NO INTERNAL HYDRATION: $artifact"
done
```

**Expected**: Empty.

### Audit 5: Permission computation in Python

```bash
for artifact_dir in server/app/api/v4/artifacts/*/; do
  artifact=$(basename "$artifact_dir")
  file="${artifact_dir}list.py"
  [ ! -f "$file" ] && continue
  missing=""
  grep -q "can_edit" "$file" || missing="$missing can_edit"
  grep -q "can_delete" "$file" || missing="$missing can_delete"
  grep -q "can_duplicate" "$file" || missing="$missing can_duplicate"
  [ -n "$missing" ] && echo "MISSING PERMISSIONS ($artifact):$missing"
done
```

**Expected**: Empty.

### Audit 6: Caching implementation

```bash
for artifact_dir in server/app/api/v4/artifacts/*/; do
  artifact=$(basename "$artifact_dir")
  file="${artifact_dir}list.py"
  [ ! -f "$file" ] && continue
  missing=""
  grep -q "get_cached\|cache_key" "$file" || missing="$missing get_cached"
  grep -q "set_cached" "$file" || missing="$missing set_cached"
  grep -q "X-Cache" "$file" || missing="$missing cache_headers"
  [ -n "$missing" ] && echo "MISSING CACHING ($artifact):$missing"
done
```

**Expected**: Empty.

### Audit 7: Auth profile internal usage

```bash
for artifact_dir in server/app/api/v4/artifacts/*/; do
  artifact=$(basename "$artifact_dir")
  file="${artifact_dir}list.py"
  [ ! -f "$file" ] && continue
  grep -q "get_auth_profile_internal" "$file" || echo "NO AUTH PROFILE INTERNAL: $artifact"
  grep -q "get_profile_context_internal" "$file" && echo "LEGACY MONOLITHIC CONTEXT: $artifact"
done
```

**Expected**: Empty. All list endpoints should use `get_auth_profile_internal()`, not the monolithic `get_profile_context_internal()`.

---

## Running the Audit

### Prerequisites

```bash
make sql-compile
```

### Execution

Run each audit check in order from the project root. Checks are filesystem-based except where SQL queries are examined.

---

## Report Format

For each audit that returns results, report:

```
AUDIT {N}: {Title}
RULE VIOLATED: Rule {N}
ITEMS FOUND: {count}
DETAILS:
  - {artifact}: {description of violation}
  - ...
```

For audits that return no results:

```
AUDIT {N}: {Title} — PASS
```

End with a summary:

```
SUMMARY
=======
Total audits: 7
Passed: {N}
Failed: {N}

LIST COVERAGE
=============
Artifacts with list.py: {N}
Resource-first SQL: {N}
Python hydration: {N}
Permission computation: {N}
Caching: {N}
```

---

## Important Notes

1. **Do NOT fix anything.** This is a read-only audit. Report only.
2. **The persona list is the gold standard.** Reference: `server/app/api/v4/artifacts/persona/list.py`.
3. **Denormalization responsibility**: Save endpoints must keep denormalized arrays in sync. If `scenarios_resource.persona_ids` is stale, that's a save endpoint bug, not a list endpoint bug.
4. **Filter dimensions are artifact-specific**. Persona uses scenarios/fields/departments. Other artifacts define their own 3 dimensions.
5. **Delete permission counts are for UI only**. The actual delete endpoint has its own independent access check SQL.
