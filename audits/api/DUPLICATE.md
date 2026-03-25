# DUPLICATE Audit — Artifact Duplicate Endpoint Integrity Check

You are an artifact DUPLICATE endpoint auditor for the GLOW project. Your job is to verify that every artifact's `duplicate.py` endpoint follows the canonical duplicate pattern defined below. You do NOT fix anything. You REPORT errors, inconsistencies, and missing pieces.

The source of truth is the **persona** duplicate implementation. Every artifact duplicate must match this pattern or document an approved deviation.

---

## The Duplicate Pattern

| Layer | Location | Purpose |
|-------|----------|---------|
| **Access Check SQL** | `server/app/sql/queries/{artifact}s/check_{artifact}_duplicate_access_complete.sql` | Light access check |
| **Duplicate SQL** | `server/app/sql/queries/{artifact}s/duplicate_{artifact}_complete.sql` | Creates new artifact, links all junctions from source |
| **Python Handler** | `server/app/routes/v5/api/main/{artifact}/duplicate.py` | Permission check, name creation, transaction, audit |
| **Permissions** | `server/app/routes/v5/api/main/{artifact}/permissions.py` | `compute_can_duplicate()` — simple role check |

Reference: `server/app/routes/v5/api/main/persona/duplicate.py`, `duplicate_persona_complete.sql`

---

## The Rules

### Rule 1: Simple role check only

Duplicate permission is a simple role check — no department check, no usage check:

```python
def compute_can_duplicate(user_role: str) -> bool:
    return user_role in ("admin", "instructional", "superadmin")
```

User role must come from `get_auth_profile_internal()`, not the monolithic `get_profile_context_internal()`:

```python
from app.v5.auth.profile import get_auth_profile_internal

profile_ctx = await get_auth_profile_internal(conn, profile_id, bypass_cache=False)
user_role = profile_ctx.access.role
actor_name = profile_ctx.access.actor_name
```

See GET.md Rule 2 for the full profile/settings split pattern.

Reference: `server/app/routes/v5/api/main/persona/permissions.py`, `duplicate.py`

### Rule 2: Light access check SQL

Duplicate endpoints use a light access check SQL (`check_{artifact}_duplicate_access_complete.sql`) that validates the artifact exists and the user has basic access. This is the same SQL used by the draft endpoint.

Reference: `server/app/routes/v5/api/main/persona/duplicate.py`

### Rule 3: Two-phase duplicate flow (Python + SQL)

Duplication is a two-phase process:

1. **Python creates the new name resource** via `create_names_internal()`. The new name is derived from the original (e.g., `"Original Name Copy"`). This goes through the resource layer so caching is properly handled.

2. **SQL creates the new artifact and links all junctions**. SQL receives the new `name_resource_id` as a parameter and copies all other active junctions from the source artifact to the new one.

```python
# Phase 1: Python creates name resource
new_name = f"{original_name} Copy"
new_name_resource = await create_names_internal(pool, new_name, profile_id)

# Phase 2: SQL creates artifact + links junctions
result = await execute_sql_typed(conn, SQL_PATH_DUPLICATE, params=DuplicateSqlParams(
    {artifact}_id=artifact_id,
    profile_id=profile_id,
    name_resource_id=new_name_resource.id,
))
```

### Rule 4: Python creates the name, not SQL

Resource creation must go through `*_internal()` functions so the cache layer stays consistent. If SQL creates resources directly, the cache doesn't know about them.

The correct pattern: Python calls `create_names_internal()` → passes the resulting `name_resource_id` to SQL → SQL links it.

**Note**: The current persona implementation creates the name in SQL directly — this is a known deviation that should be corrected. The audit spec documents the correct pattern.

### Rule 5: SQL links, never creates resources

The duplicate SQL function receives `name_resource_id` from Python and links it. For all other resources, SQL links by reference to existing resource IDs from the source artifact's active junctions. SQL does NOT create any resources.

```sql
-- Copy active junctions from source to new artifact
INSERT INTO {artifact}_descriptions_junction ({artifact}_id, descriptions_resource_id, active)
SELECT v_new_{artifact}_id, descriptions_resource_id, true
FROM {artifact}_descriptions_junction
WHERE {artifact}_id = p_{artifact}_id AND active = true;

-- Link the new name (created by Python)
INSERT INTO {artifact}_names_junction ({artifact}_id, names_resource_id, active)
VALUES (v_new_{artifact}_id, p_name_resource_id, true);
```

Reference: `duplicate_persona_complete.sql`

### Rule 6: Active flag defaults to FALSE

The duplicated artifact is created with `active = false` (inactive). The user must explicitly activate it.

### Rule 7: Returns new artifact ID and original name

Duplicate SQL must return:

- `new_{artifact}_id: UUID` — the ID of the newly created artifact
- `original_name: str` — the name of the source artifact (for audit context)

### Rule 8: Transaction wrapper

Duplicate mutations must be wrapped in a transaction:

```python
async with pool.acquire() as conn:
    async with conn.transaction():
        # access check
        # permission check
        # create name resource (Python)
        # duplicate SQL
```

### Rule 9: Cache invalidation after commit

After the transaction commits, invalidate relevant cache tags:

```python
await invalidate_tags(["{artifact}s"])
```

### Rule 10: Audit context with original artifact name

Duplicate endpoints must set audit context including the original artifact's name:

```python
@audit_activity("{{ actor.name }} duplicated {artifact} '{{ {artifact}.name }}'")
async def duplicate_{artifact}(http_request: Request, body: Duplicate{Artifact}ApiRequest):
    # ...
    audit_set({
        "actor": {"name": actor_name},
        "{artifact}": {"name": result.original_name},
    })
```

Reference: `server/app/routes/v5/api/main/persona/duplicate.py`

### Rule 11: SQL params include name_resource_id

The duplicate SQL function receives:

- `{artifact}_id: UUID` — source artifact to duplicate
- `profile_id: UUID` — user performing the duplication
- `name_resource_id: UUID` — new name resource created by Python

```python
class Duplicate{Artifact}SqlParams:
    p_{artifact}_id: UUID
    p_profile_id: UUID
    p_name_resource_id: UUID
```

### Rule 12: No tool call tracking, no draft involvement

Duplicate does NOT create tool call lineage (`runs_entry`, `calls_entry`, `tool_calls_junction`). Duplicate does NOT involve drafts. It's a simple copy operation.

---

## MUST NOT Rules

1. **MUST NOT** check department membership — duplicate is role-only
2. **MUST NOT** check usage counts — any artifact can be duplicated
3. **MUST NOT** create resources in SQL — all resource creation goes through Python `*_internal()`
4. **MUST NOT** copy inactive junction links — only active junctions are duplicated
5. **MUST NOT** create the duplicate as active — defaults to inactive
6. **MUST NOT** create tool call lineage — no tracking for duplication
7. **MUST NOT** skip audit context — must include original artifact name

---

## Audit Checks

### Audit 1: Duplicate endpoint existence

```bash
for artifact_dir in server/app/routes/v5/api/main/*/; do
  artifact=$(basename "$artifact_dir")
  [ ! -f "${artifact_dir}duplicate.py" ] && echo "MISSING DUPLICATE ENDPOINT: $artifact"
done
```

**Expected**: All artifacts that support duplication should have `duplicate.py`.

### Audit 2: Access check SQL exists

```bash
for artifact_dir in server/app/routes/v5/api/main/*/; do
  artifact=$(basename "$artifact_dir")
  [ ! -f "${artifact_dir}duplicate.py" ] && continue
  found=$(find server/app/sql/queries/ -name "check_${artifact}_duplicate_access*" 2>/dev/null | head -1)
  [ -z "$found" ] && echo "MISSING DUPLICATE ACCESS SQL: $artifact"
done
```

**Expected**: Empty.

### Audit 3: Duplicate SQL exists

```bash
for artifact_dir in server/app/routes/v5/api/main/*/; do
  artifact=$(basename "$artifact_dir")
  [ ! -f "${artifact_dir}duplicate.py" ] && continue
  found=$(find server/app/sql/queries/ -name "duplicate_${artifact}_complete*" 2>/dev/null | head -1)
  [ -z "$found" ] && echo "MISSING DUPLICATE SQL: $artifact"
done
```

**Expected**: Empty.

### Audit 4: Transaction usage

```bash
for artifact_dir in server/app/routes/v5/api/main/*/; do
  artifact=$(basename "$artifact_dir")
  file="${artifact_dir}duplicate.py"
  [ ! -f "$file" ] && continue
  grep -q "conn.transaction" "$file" || echo "NO TRANSACTION: $artifact"
done
```

**Expected**: Empty.

### Audit 5: Cache invalidation

```bash
for artifact_dir in server/app/routes/v5/api/main/*/; do
  artifact=$(basename "$artifact_dir")
  file="${artifact_dir}duplicate.py"
  [ ! -f "$file" ] && continue
  grep -q "invalidate_tags" "$file" || echo "NO CACHE INVALIDATION: $artifact"
done
```

**Expected**: Empty.

### Audit 6: Audit context

```bash
for artifact_dir in server/app/routes/v5/api/main/*/; do
  artifact=$(basename "$artifact_dir")
  file="${artifact_dir}duplicate.py"
  [ ! -f "$file" ] && continue
  grep -q "audit_activity\|audit_set" "$file" || echo "NO AUDIT CONTEXT: $artifact"
done
```

**Expected**: Empty.

### Audit 7: Permission function exists

```bash
for artifact_dir in server/app/routes/v5/api/main/*/; do
  artifact=$(basename "$artifact_dir")
  file="${artifact_dir}permissions.py"
  [ ! -f "$file" ] && continue
  grep -q "compute_can_duplicate" "$file" || echo "MISSING compute_can_duplicate: $artifact"
done
```

**Expected**: Empty.

### Audit 8: SQL does not create resources

```bash
for sql_file in server/app/sql/queries/*/duplicate_*_complete.sql; do
  artifact=$(basename "$(dirname "$sql_file")")
  # Check for INSERT INTO *_resource (resource creation in SQL)
  grep -i "INSERT INTO.*_resource" "$sql_file" | grep -v "junction\|connection" | while read line; do
    echo "RESOURCE CREATION IN SQL ($artifact): $line"
  done
done
```

**Expected**: Empty (or only the known persona deviation).

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

DUPLICATE COVERAGE
==================
Artifacts with duplicate.py: {N}
Access check SQL: {N}
Duplicate SQL: {N}
Transaction usage: {N}
Cache invalidation: {N}
Audit context: {N}
Permission function: {N}
No SQL resource creation: {N}
```

---

## Important Notes

1. **Do NOT fix anything.** This is a read-only audit. Report only.
2. **The persona duplicate is the gold standard.** Reference: `server/app/routes/v5/api/main/persona/duplicate.py`.
3. **Known deviation**: The current persona implementation creates the name resource in SQL directly instead of Python. This should be corrected but is documented as a known gap.
4. **Light access check**: Duplicate shares its access check SQL with the draft endpoint. Both use `check_{artifact}_duplicate_access_complete.sql`.
5. **No tool tracking**: Unlike save and draft, duplicate does not create `runs_entry`, `calls_entry`, or `tool_calls_junction` records.
6. **Only active junctions**: Only active junction links from the source artifact are copied to the duplicate. Inactive/historical links are not carried over.
