# SAVE Audit — Artifact Save Endpoint Integrity Check

You are an artifact SAVE endpoint auditor for the GLOW project. Your job is to verify that every artifact's `save.py` endpoint follows the canonical save pattern defined below. You do NOT fix anything. You REPORT errors, inconsistencies, and missing pieces.

The source of truth is the **persona** save implementation. Every artifact save must match this pattern or document an approved deviation.

---

## The Save Pattern

| Layer | Location | Purpose |
|-------|----------|---------|
| **Request Types** | `server/app/api/v4/artifacts/{artifact}/types.py` | Nested resource action payloads with `to_tuple()` + `from_request()` |
| **Access Check SQL** | `server/app/sql/v4/queries/{artifact}s/check_{artifact}_save_access_complete.sql` | Pre-save permission data |
| **Save SQL** | `server/app/sql/v4/queries/{artifact}s/save_{artifact}_complete.sql` | Junction linker — receives resource IDs, links via junctions |
| **Python Handler** | `server/app/api/v4/artifacts/{artifact}/save.py` | Permission check, resource creation, transaction, cache invalidation |
| **Permissions** | `server/app/api/v4/artifacts/{artifact}/permissions.py` | `compute_can_save()`, `compute_can_create()` |

Reference: `server/app/api/v4/artifacts/persona/save.py`, `persona/types.py`

---

## The Rules

### Rule 1: Unified create/update endpoint

Save is a single endpoint that handles both create and update:

- `input_{artifact}_id = NULL` → create new artifact
- `input_{artifact}_id = <UUID>` → update existing artifact

There are no separate `/create` and `/update` endpoints at the artifact level.

Reference: `server/app/api/v4/artifacts/persona/save.py`

### Rule 2: Nested resource action payloads

Save requests use nested resource action types, NOT flat ID parameters:

```python
class {Artifact}ResourceAction(BaseModel):
    """Single-select resource with tool call tracking."""
    resource_id: UUID | None = None
    create_tool_id: UUID | None = None  # Set if resource was just created (flush)
    link_tool_id: UUID | None = None    # Set if selection changed from previous

class {Artifact}MultiResourceAction(BaseModel):
    """Multi-select resource with tool call tracking."""
    resource_ids: list[UUID] | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None
```

ALL resources must be present in the save request — use empty action if unchanged.

```python
class Save{Artifact}ApiRequest(BaseModel):
    input_{artifact}_id: UUID | None = None
    group_id: UUID
    names: {Artifact}ResourceAction
    descriptions: {Artifact}ResourceAction
    # ... all single-select resources ...
    departments: {Artifact}MultiResourceAction
    # ... all multi-select resources ...
```

Reference: `server/app/api/v4/artifacts/persona/types.py:341-374`

### Rule 3: Tool call ID tracking

Every resource action carries optional `create_tool_id` and `link_tool_id`:

- `create_tool_id` — set when the resource was just AI-created (flush). Used to track which AI tool call created this resource.
- `link_tool_id` — set when the user changed the selection from the previous value. Used to track which AI tool call recommended this link.

Both are propagated to SQL for mutation tracking via `runs_entry` + `calls_entry` + `tool_calls_junction`.

### Rule 4: `to_tuple()` serialization

The SQL params class must have a `to_tuple()` method that serializes resource actions for asyncpg:

```python
def to_tuple(self) -> tuple:
    def single(a: {Artifact}ResourceAction) -> tuple:
        return (a.resource_id, a.create_tool_id, a.link_tool_id)

    def multi(a: {Artifact}MultiResourceAction) -> tuple:
        return (a.resource_ids, a.create_tool_id, a.link_tool_id)

    return (
        self.profile_id,
        self.input_{artifact}_id,
        self.group_id,
        single(self.names),
        single(self.descriptions),
        # ... single-select ...
        multi(self.departments),
        # ... multi-select ...
    )
```

Reference: `server/app/api/v4/artifacts/persona/types.py:408-431`

### Rule 5: `from_request()` class method

SQL params class must have a `from_request()` class method that adds `profile_id` from the request header:

```python
@classmethod
def from_request(cls, req: Save{Artifact}ApiRequest, profile_id: UUID):
    return cls(
        profile_id=profile_id,
        input_{artifact}_id=req.input_{artifact}_id,
        group_id=req.group_id,
        names=req.names,
        descriptions=req.descriptions,
        # ...
    )
```

Reference: `server/app/api/v4/artifacts/persona/types.py`

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

Reference: `server/app/api/v4/artifacts/persona/save.py`, `check_persona_save_access_complete.sql`

### Rule 7: SQL composite types for resource actions

Save SQL must define composite types in the `types` schema for resource actions:

```sql
DROP TYPE IF EXISTS types.{artifact}_resource_action CASCADE;
CREATE TYPE types.{artifact}_resource_action AS (
    resource_id UUID,
    create_tool_id UUID,
    link_tool_id UUID
);

DROP TYPE IF EXISTS types.{artifact}_multi_resource_action CASCADE;
CREATE TYPE types.{artifact}_multi_resource_action AS (
    resource_ids UUID[],
    create_tool_id UUID,
    link_tool_id UUID
);
```

The `DROP TYPE ... CASCADE` is intentional — both save and draft SQL define the same types, and JIT compilation means each file re-creates its dependencies.

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

Reference: `server/app/api/v4/artifacts/persona/save.py`

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

Reference: `server/app/api/v4/artifacts/persona/save.py`

### Rule 12: Cache invalidation after commit

After the transaction commits, invalidate relevant cache tags:

```python
await invalidate_tags(["{artifact}s"])
```

This must happen AFTER the transaction commits, not inside it.

Reference: `server/app/api/v4/artifacts/persona/save.py`

### Rule 13: Audit context

Save endpoints must set audit context with `audit_activity()` decorator and `audit_set()`:

```python
@audit_activity("{{ actor.name }} saved {artifact} '{{ {artifact}.name }}'")
async def save_{artifact}(http_request: Request, body: Save{Artifact}ApiRequest):
    # ...
    audit_set({"actor": {"name": actor_name}, "{artifact}": {"name": artifact_name}})
```

Reference: `server/app/api/v4/artifacts/persona/save.py`

### Rule 14: User context from settings

Profile context provides `user_role`, `actor_name`, `user_department_ids` for permission computation via `get_profile_context_internal()`.

---

## MUST NOT Rules

1. **MUST NOT** use flat ID parameters (e.g., `name_id`, `description_id`) in the save request — use nested resource actions
2. **MUST NOT** skip tool call tracking — `create_tool_id` and `link_tool_id` must be propagated to SQL
3. **MUST NOT** create resources in SQL — SQL is a pure linker; resource creation happens in Python via `*_internal()`
4. **MUST NOT** skip transaction wrapper for mutations
5. **MUST NOT** invalidate cache inside the transaction — only after commit
6. **MUST NOT** compute permissions in SQL — permissions are pure Python
7. **MUST NOT** have separate create and update endpoints — unified save handles both

---

## Audit Checks

### Audit 1: Save endpoint existence

```bash
for artifact_dir in server/app/api/v4/artifacts/*/; do
  artifact=$(basename "$artifact_dir")
  [ ! -f "${artifact_dir}save.py" ] && echo "MISSING SAVE ENDPOINT: $artifact"
done
```

**Expected**: All artifacts that support saving should have `save.py`.

### Audit 2: Nested resource action types

```bash
for artifact_dir in server/app/api/v4/artifacts/*/; do
  artifact=$(basename "$artifact_dir")
  file="${artifact_dir}types.py"
  [ ! -f "$file" ] && continue
  grep -q "ResourceAction" "$file" || continue
  missing=""
  grep -q "resource_id" "$file" || missing="$missing resource_id"
  grep -q "create_tool_id" "$file" || missing="$missing create_tool_id"
  grep -q "link_tool_id" "$file" || missing="$missing link_tool_id"
  [ -n "$missing" ] && echo "MISSING ACTION FIELDS ($artifact):$missing"
done
```

**Expected**: Empty.

### Audit 3: `to_tuple()` method

```bash
for artifact_dir in server/app/api/v4/artifacts/*/; do
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
for artifact_dir in server/app/api/v4/artifacts/*/; do
  artifact=$(basename "$artifact_dir")
  file="${artifact_dir}save.py"
  [ ! -f "$file" ] && continue
  grep -q "conn.transaction" "$file" || echo "NO TRANSACTION: $artifact"
done
```

**Expected**: Empty.

### Audit 5: Cache invalidation

```bash
for artifact_dir in server/app/api/v4/artifacts/*/; do
  artifact=$(basename "$artifact_dir")
  file="${artifact_dir}save.py"
  [ ! -f "$file" ] && continue
  grep -q "invalidate_tags" "$file" || echo "NO CACHE INVALIDATION: $artifact"
done
```

**Expected**: Empty.

### Audit 6: Access check SQL exists

```bash
for artifact_dir in server/app/api/v4/artifacts/*/; do
  artifact=$(basename "$artifact_dir")
  [ ! -f "${artifact_dir}save.py" ] && continue
  found=$(find server/app/sql/v4/queries/ -name "check_${artifact}_save_access*" 2>/dev/null | head -1)
  [ -z "$found" ] && echo "MISSING ACCESS CHECK SQL: $artifact"
done
```

**Expected**: Empty.

### Audit 7: Audit context

```bash
for artifact_dir in server/app/api/v4/artifacts/*/; do
  artifact=$(basename "$artifact_dir")
  file="${artifact_dir}save.py"
  [ ! -f "$file" ] && continue
  grep -q "audit_activity\|audit_set" "$file" || echo "NO AUDIT CONTEXT: $artifact"
done
```

**Expected**: Empty.

### Audit 8: SQL composite types

```bash
for sql_file in server/app/sql/v4/queries/*/save_*_complete.sql; do
  artifact=$(basename "$(dirname "$sql_file")")
  missing=""
  grep -q "resource_action" "$sql_file" || missing="$missing resource_action"
  grep -q "multi_resource_action" "$sql_file" || missing="$missing multi_resource_action"
  [ -n "$missing" ] && echo "MISSING SQL COMPOSITES ($artifact):$missing"
done
```

**Expected**: Empty.

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
2. **The persona save is the gold standard.** Reference: `server/app/api/v4/artifacts/persona/save.py`.
3. **Shared composite types**: Both save and draft SQL define the same `types.{artifact}_resource_action` and `types.{artifact}_multi_resource_action`. The `DROP TYPE ... CASCADE` is intentional for JIT compilation.
4. **PostgreSQL reserved words**: If a resource name is a reserved word (e.g., `values`), it must be quoted in SQL function parameters and composite access expressions.
5. **External call ID format**: `'{artifact}_save_create_{resource}_' || v_call_id::text` for create tool IDs, `'{artifact}_save_link_{resource}_' || v_call_id::text` for link tool IDs.
6. **Mutation endpoints still using auto-generated SQL types** (e.g., agent save) are known deviations with migration deferred.
