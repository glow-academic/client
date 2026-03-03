# SAVE Audit — Artifact Save Endpoint Integrity Check

You are an artifact SAVE endpoint auditor for the GLOW project. Your job is to verify that every artifact's `save.py` endpoint follows the canonical save pattern defined below. You do NOT fix anything. You REPORT errors, inconsistencies, and missing pieces.

The source of truth is the **persona** save implementation. Every artifact save must match this pattern or document an approved deviation.

---

## The Save Pattern

| Layer | Location | Purpose |
|-------|----------|---------|
| **Request Types** | `server/app/routes/v5/api/main/{artifact}/types.py` | Nested resource action payloads with `to_tuple()` + `from_request()` |
| **Access Check SQL** | `server/app/sql/queries/{artifact}s/check_{artifact}_save_access_complete.sql` | Pre-save permission data |
| **Save SQL** | `server/app/sql/queries/{artifact}s/save_{artifact}_complete.sql` | Junction linker — receives resource IDs, links via junctions |
| **Python Handler** | `server/app/routes/v5/api/main/{artifact}/save.py` | Permission check, resource creation, transaction, cache invalidation |
| **Permissions** | `server/app/routes/v5/api/main/{artifact}/permissions.py` | `compute_can_save()`, `compute_can_create()` |

Reference: `server/app/routes/v5/api/main/persona/save.py`, `persona/types.py`

---

## The Rules

### Rule 1: Unified create/update endpoint

Save is a single endpoint that handles both create and update:

- `input_{artifact}_id = NULL` → create new artifact
- `input_{artifact}_id = <UUID>` → update existing artifact

There are no separate `/create` and `/update` endpoints at the artifact level.

Reference: `server/app/routes/v5/api/main/persona/save.py`

### Rule 2: Flat resource ID parameters

Save requests use flat resource ID parameters — no nested wrapper types:

```python
class Save{Artifact}ApiRequest(BaseModel):
    input_{artifact}_id: UUID | None = None
    name_id: UUID | None = None
    description_id: UUID | None = None
    color_id: UUID | None = None
    icon_id: UUID | None = None
    instruction_id: UUID | None = None
    # ... all single-select resources as flat UUIDs ...
    department_ids: list[UUID] | None = None
    # ... all multi-select resources as flat UUID lists ...
```

The client sends only resource IDs. No `group_id` (server-resolved), no tool IDs (server-resolved). ALL resources must be present in the save request — `None` means no resource selected.

Reference: `server/app/routes/v5/api/main/persona/types.py`

### Rule 3: Server-resolved tool call tracking

The server resolves a single `tool_id` per resource type from the artifact's `resource_agent_ids` mapping via `tool_ids_map()`. The client does NOT send tool IDs.

The save handler:
1. Calls `get_{artifact}_internal()` or uses the access check to obtain `resource_agent_ids`
2. Builds `tool_ids: dict[str, UUID | None]` from the selected agents
3. Passes each resource's `tool_id` to the SQL function for mutation tracking

Tool IDs are propagated to SQL for lineage via `runs_entry` + `calls_entry` + `tool_calls_junction`.

### Rule 4: `to_tuple()` serialization

The SQL params class must have a `to_tuple()` method that serializes flat resource IDs for asyncpg:

```python
def to_tuple(self) -> tuple:
    return (
        self.profile_id,
        self.input_{artifact}_id,
        self.group_id,          # Server-resolved
        self.name_id,
        self.description_id,
        # ... all single-select flat IDs ...
        self.department_ids,
        # ... all multi-select flat ID lists ...
        self.tool_ids_json,     # Server-resolved JSONB
    )
```

Reference: `server/app/routes/v5/api/main/persona/types.py`

### Rule 5: `from_request()` class method

SQL params class must have a `from_request()` class method that adds server-resolved fields (`profile_id`, `group_id`, `tool_ids`):

```python
@classmethod
def from_request(
    cls,
    req: Save{Artifact}ApiRequest,
    profile_id: UUID,
    group_id: UUID,           # Resolved from access check
    tool_ids: dict[str, UUID | None],  # Resolved from resource_agent_ids
):
    return cls(
        profile_id=profile_id,
        input_{artifact}_id=req.input_{artifact}_id,
        group_id=group_id,
        name_id=req.name_id,
        description_id=req.description_id,
        # ... flat IDs from request ...
        tool_ids_json=json.dumps({k: str(v) for k, v in tool_ids.items() if v}),
    )
```

Reference: `server/app/routes/v5/api/main/persona/types.py`

### Rule 6: Two-phase permission check

Save endpoints must perform a two-phase permission check:

1. **SQL phase**: Execute `check_{artifact}_save_access_complete.sql` to get `department_ids`, `usage_counts`, and other access data
2. **Python phase**: Call `compute_can_save()` (for update) or `compute_can_create()` (for create) with the SQL results + user context

```python
# Phase 1: SQL access check
access = await execute_sql_typed(conn, SQL_PATH_ACCESS, params=access_params)

# Phase 2: Python permission check
if input_{artifact}_id:
    can_save = compute_can_save(user_role, access.department_ids, ...)
else:
    can_create = compute_can_create(user_role)
```

Reference: `server/app/routes/v5/api/main/persona/save.py`, `check_persona_save_access_complete.sql`

### Rule 7: Flat UUID parameters in SQL functions

Save SQL receives flat UUID parameters for resource IDs — no composite types needed for the resource IDs themselves. Tool tracking uses a single JSONB parameter with server-resolved `tool_id` per resource:

```sql
CREATE OR REPLACE FUNCTION api_save_{artifact}_v4(
    p_profile_id UUID,
    p_input_{artifact}_id UUID,
    p_group_id UUID,              -- Server-resolved
    p_name_id UUID,
    p_description_id UUID,
    -- ... flat UUID params for single-select ...
    p_department_ids UUID[],
    -- ... flat UUID[] params for multi-select ...
    p_tool_ids JSONB              -- Server-resolved: {"names": "uuid", ...}
)
```

The SQL function extracts tool IDs from the JSONB parameter for lineage tracking.

Reference: `save_persona_complete.sql`

### Rule 8: Transaction wrapper

Save mutations must be wrapped in a transaction:

```python
async with pool.acquire() as conn:
    async with conn.transaction():
        # access check
        # permission check
        # save SQL
```

Reference: `server/app/routes/v5/api/main/persona/save.py`

### Rule 9: SQL junction workflow (deactivate-then-upsert)

Save SQL must follow the deactivate-then-upsert pattern for junctions:

```sql
-- Step 1: Deactivate old active links
UPDATE {artifact}_names_junction
SET active = false
WHERE {artifact}_id = v_{artifact}_id AND active = true;

-- Step 2: Upsert new link
INSERT INTO {artifact}_names_junction ({artifact}_id, names_resource_id, active)
VALUES (v_{artifact}_id, v_name_resource_id, true)
ON CONFLICT ({artifact}_id, names_resource_id) DO UPDATE SET active = true;
```

Reference: `save_persona_complete.sql`

### Rule 10: Run/call/tool-call lineage

Save SQL must create lineage records for mutation tracking:

1. One `runs_entry` per save mutation
2. For each non-null `create_tool_id` or `link_tool_id`: one `calls_entry` + `tool_calls_junction` entry
3. For each resource call: one `{resource}_calls_connection` entry

External call ID format: `'{artifact}_save_create_{resource}_' || v_call_id::text` or `'{artifact}_save_link_{resource}_' || v_call_id::text`.

Reference: `save_persona_complete.sql`

### Rule 11: Resource creation before save (optional fields)

Save SQL is purely a linker — it receives resource IDs and links them via junctions. For optional fields (e.g., descriptions) that might not have been explicitly created by the user, the Python save handler may internally call `create_{resource}_internal()` to ensure the resource exists before passing the ID to SQL.

This keeps the SQL function simple (just IDs in, junctions out) while ensuring resources go through the proper creation layer with caching.

Reference: `server/app/routes/v5/api/main/persona/save.py`

### Rule 12: Cache invalidation after commit

After the transaction commits, invalidate relevant cache tags:

```python
await invalidate_tags(["{artifact}s"])
```

This must happen AFTER the transaction commits, not inside it.

Reference: `server/app/routes/v5/api/main/persona/save.py`

### Rule 13: Audit context

Save endpoints must set audit context with `audit_activity()` decorator and `audit_set()`:

```python
@audit_activity("{{ actor.name }} saved {artifact} '{{ {artifact}.name }}'")
async def save_{artifact}(http_request: Request, body: Save{Artifact}ApiRequest):
    # ...
    audit_set({"actor": {"name": actor_name}, "{artifact}": {"name": artifact_name}})
```

Reference: `server/app/routes/v5/api/main/persona/save.py`

### Rule 14: User context from `get_auth_profile_internal()`

User context (`user_role`, `actor_name`, `user_department_ids`) for permission computation must come from `get_auth_profile_internal()`, not from the monolithic `get_profile_context_internal()`. See GET.md Rule 2 for the full profile/settings split pattern.

```python
from app.v5.auth.profile import get_auth_profile_internal

profile_ctx = await get_auth_profile_internal(conn, profile_id, bypass_cache=False)
actor_name = profile_ctx.access.actor_name
user_role = profile_ctx.access.role
user_department_ids = [d.department_id for d in profile_ctx.departments if d.department_id]
```

Reference: `server/app/routes/v5/api/main/persona/save.py`

### Rule 15: Server-side `group_id` resolution

The client does NOT send `group_id` in the save request. The server resolves it from the access check SQL:

- **Update** (`input_{artifact}_id` provided): `group_id` comes from `check_{artifact}_save_access_complete.sql` which returns the existing artifact's `group_id`.
- **Create** (`input_{artifact}_id` is NULL): A new `group_id` is generated server-side.

This prevents the client from associating a save with an arbitrary group.

---

## MUST NOT Rules

1. **MUST NOT** use nested resource action wrapper types (e.g., `{Artifact}ResourceAction`, `{Artifact}MultiResourceAction`) — use flat ID parameters
2. **MUST NOT** skip tool call tracking — `tool_id` per resource must be server-resolved and propagated to SQL
3. **MUST NOT** create resources in SQL — SQL is a pure linker; resource creation happens in Python via `*_internal()`
4. **MUST NOT** skip transaction wrapper for mutations
5. **MUST NOT** invalidate cache inside the transaction — only after commit
6. **MUST NOT** compute permissions in SQL — permissions are pure Python
7. **MUST NOT** have separate create and update endpoints — unified save handles both
8. **MUST NOT** accept `group_id` from the client in save requests — server resolves it from the access check

---

## Audit Checks

### Audit 1: Save endpoint existence

```bash
for artifact_dir in server/app/routes/v5/api/main/*/; do
  artifact=$(basename "$artifact_dir")
  [ ! -f "${artifact_dir}save.py" ] && echo "MISSING SAVE ENDPOINT: $artifact"
done
```

**Expected**: All artifacts that support saving should have `save.py`.

### Audit 2: Flat resource ID parameters in save request

```bash
for artifact_dir in server/app/routes/v5/api/main/*/; do
  artifact=$(basename "$artifact_dir")
  file="${artifact_dir}types.py"
  [ ! -f "$file" ] && continue
  grep -q "Save.*ApiRequest\|Save.*Request" "$file" || continue
  # Check for legacy nested wrapper types
  grep -q "ResourceAction\|MultiResourceAction" "$file" && echo "LEGACY NESTED WRAPPERS: $artifact"
  # Check for legacy client-sent group_id in save request
  grep -A 30 "class Save.*Request" "$file" | grep -q "group_id.*UUID" && echo "CLIENT group_id IN SAVE REQUEST: $artifact"
done
```

**Expected**: Empty. Save requests should use flat IDs with server-resolved group_id.

### Audit 3: `to_tuple()` method

```bash
for artifact_dir in server/app/routes/v5/api/main/*/; do
  artifact=$(basename "$artifact_dir")
  file="${artifact_dir}types.py"
  [ ! -f "$file" ] && continue
  grep -q "SavePersona\|Save.*SqlParams\|Save.*Request" "$file" || continue
  grep -q "to_tuple" "$file" || echo "MISSING to_tuple: $artifact"
done
```

**Expected**: Empty.

### Audit 4: Transaction usage

```bash
for artifact_dir in server/app/routes/v5/api/main/*/; do
  artifact=$(basename "$artifact_dir")
  file="${artifact_dir}save.py"
  [ ! -f "$file" ] && continue
  grep -q "conn.transaction" "$file" || echo "NO TRANSACTION: $artifact"
done
```

**Expected**: Empty.

### Audit 5: Cache invalidation

```bash
for artifact_dir in server/app/routes/v5/api/main/*/; do
  artifact=$(basename "$artifact_dir")
  file="${artifact_dir}save.py"
  [ ! -f "$file" ] && continue
  grep -q "invalidate_tags" "$file" || echo "NO CACHE INVALIDATION: $artifact"
done
```

**Expected**: Empty.

### Audit 6: Access check SQL exists

```bash
for artifact_dir in server/app/routes/v5/api/main/*/; do
  artifact=$(basename "$artifact_dir")
  [ ! -f "${artifact_dir}save.py" ] && continue
  found=$(find server/app/sql/queries/ -name "check_${artifact}_save_access*" 2>/dev/null | head -1)
  [ -z "$found" ] && echo "MISSING ACCESS CHECK SQL: $artifact"
done
```

**Expected**: Empty.

### Audit 7: Audit context

```bash
for artifact_dir in server/app/routes/v5/api/main/*/; do
  artifact=$(basename "$artifact_dir")
  file="${artifact_dir}save.py"
  [ ! -f "$file" ] && continue
  grep -q "audit_activity\|audit_set" "$file" || echo "NO AUDIT CONTEXT: $artifact"
done
```

**Expected**: Empty.

### Audit 8: Flat UUID parameters in save SQL

```bash
for sql_file in server/app/sql/queries/*/save_*_complete.sql; do
  artifact=$(basename "$(dirname "$sql_file")")
  # Check for legacy composite types
  grep -q "resource_action\|multi_resource_action" "$sql_file" && echo "LEGACY COMPOSITES: $artifact ($sql_file)"
done
```

**Expected**: Empty. Save SQL should use flat UUID parameters, not composite types.

---

## Running the Audit

### Prerequisites

```bash
make sql-compile
```

### Execution

Run each audit check in order from the project root.

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
Total audits: 8
Passed: {N}
Failed: {N}

SAVE COVERAGE
=============
Artifacts with save.py: {N}
Nested action types: {N}
to_tuple() serialization: {N}
Transaction usage: {N}
Cache invalidation: {N}
Access check SQL: {N}
Audit context: {N}
SQL composites: {N}
```

---

## Important Notes

1. **Do NOT fix anything.** This is a read-only audit. Report only.
2. **The persona save is the gold standard.** Reference: `server/app/routes/v5/api/main/persona/save.py`.
3. **No composite types needed**: Save SQL receives flat UUID parameters. The previous `types.{artifact}_resource_action` composites are replaced by flat parameters.
4. **PostgreSQL reserved words**: If a resource name is a reserved word (e.g., `values`), it must be quoted in SQL function parameters.
5. **External call ID format**: `'{artifact}_save_{resource}_' || v_call_id::text` for tool call tracking.
6. **Mutation endpoints still using auto-generated SQL types** (e.g., agent save) are known deviations with migration deferred.
