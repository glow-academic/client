# DELETE Audit — Artifact Delete Endpoint Integrity Check

You are an artifact DELETE endpoint auditor for the GLOW project. Your job is to verify that every artifact's `delete.py` endpoint follows the canonical delete pattern defined below. You do NOT fix anything. You REPORT errors, inconsistencies, and missing pieces.

The source of truth is the **persona** delete implementation. Every artifact delete must match this pattern or document an approved deviation.

---

## The Delete Pattern

| Layer | Location | Purpose |
|-------|----------|---------|
| **Access Check SQL** | `server/app/sql/queries/{artifact}s/check_{artifact}_delete_access_complete.sql` | Pre-delete permission data: department_ids + usage counts |
| **Delete SQL** | `server/app/sql/queries/{artifact}s/delete_{artifact}_complete.sql` | Deletes artifact row; CASCADE handles junction cleanup |
| **Python Handler** | `server/app/routes/v5/api/main/{artifact}/delete.py` | Permission check, usage validation, transaction, audit |
| **Permissions** | `server/app/routes/v5/api/main/{artifact}/permissions.py` | `compute_can_delete()` |

Reference: `server/app/routes/v5/api/main/persona/delete.py`, `persona/permissions.py`

---

## The Rules

### Rule 1: Let CASCADE handle junction cleanup

Delete SQL simply deletes the row from `{artifact}_artifact`. All junction table rows are cleaned up by PostgreSQL CASCADE foreign key constraints. The delete SQL must NOT manually delete junction rows.

```sql
DELETE FROM {artifact}_artifact WHERE id = p_{artifact}_id
RETURNING id, ...;
```

Reference: `delete_persona_complete.sql`

### Rule 2: Two-phase permission check

Delete endpoints must perform a two-phase permission check:

1. **SQL phase**: Execute `check_{artifact}_delete_access_complete.sql` to get `department_ids` and `total_usage_links`
2. **Python phase**: Call `compute_can_delete(user_role, artifact_department_ids, total_usage_links)` with the SQL results + user context

```python
from app.v5.auth.profile import get_auth_profile_internal

# User context via cached auth profile internal
profile_ctx = await get_auth_profile_internal(conn, profile_id, bypass_cache=False)

# Phase 1: SQL access check
access = await execute_sql_typed(conn, SQL_PATH_ACCESS, params=access_params)

# Phase 2: Python permission check
can_delete = compute_can_delete(
    user_role=profile_ctx.access.role,
    artifact_department_ids=access.department_ids,
    total_usage_links=access.total_scenario_links,
)
if not can_delete:
    raise HTTPException(status_code=403, detail="Cannot delete")
```

User context must come from `get_auth_profile_internal()`, not the monolithic `get_profile_context_internal()`. See GET.md Rule 2 for the full profile/settings split pattern.

Reference: `server/app/routes/v5/api/main/persona/delete.py`, `permissions.py`

### Rule 3: Usage check counts ACTIVE links only

The access check SQL must count only **active** links (`WHERE active = true` on junction tables). Inactive/soft-deleted links do not block deletion. This is the unified permission model — same check for both edit and delete.

```sql
-- Count only ACTIVE links
SELECT COUNT(*) as active_scenario_count
FROM scenario_personas_junction
WHERE persona_artifact_id = p_persona_id
  AND active = true;
```

Reference: `check_persona_delete_access_complete.sql`

### Rule 4: Python validates usage before delete

The Python handler must check `active_count > 0` and raise a `ValueError` (400) before attempting the delete. This is a separate check from the permission check:

```python
if access.active_scenario_count > 0:
    raise ValueError(f"Cannot delete: {artifact} is used by {access.active_scenario_count} active scenarios")
```

Reference: `server/app/routes/v5/api/main/persona/delete.py`

### Rule 5: Delete SQL returns metadata

The delete SQL must return:

- `deleted: bool` — whether the row was actually deleted
- `name: str` — the artifact's name (for audit context)
- `usage_count: int` — usage count (for validation)

```sql
RETURNING
    true AS deleted,
    (SELECT nr.name FROM {artifact}_names_junction nj
     JOIN names_resource nr ON nj.names_resource_id = nr.id
     WHERE nj.{artifact}_id = p_{artifact}_id AND nj.active = true
     LIMIT 1) AS name;
```

Reference: `delete_persona_complete.sql`

### Rule 6: Superadmin exceptions for default artifacts

Default artifacts (those with no department associations) are only deletable by superadmin users. The `compute_can_delete()` function must enforce this:

```python
def compute_can_delete(user_role, artifact_department_ids, active_parent_count):
    # Default object guard
    if not artifact_department_ids and user_role != "superadmin":
        return False
    # Active parent link guard (same as edit)
    if active_parent_count > 0:
        return False
    # Role check (admin/superadmin for simulation/intelligence tier, superadmin only for admin tier)
    return user_role in ("admin", "superadmin")
```

Reference: `server/app/routes/v5/api/main/persona/permissions.py`

### Rule 7: Transaction wrapper

Delete mutations must be wrapped in a transaction:

```python
async with pool.acquire() as conn:
    async with conn.transaction():
        # access check
        # usage validation
        # permission check
        # delete SQL
```

### Rule 8: Cache invalidation after commit

After the transaction commits, invalidate relevant cache tags:

```python
await invalidate_tags(["{artifact}s"])
```

### Rule 9: Audit context with deleted artifact name

Delete endpoints must set audit context including the deleted artifact's name (from SQL result):

```python
@audit_activity("{{ actor.name }} deleted {artifact} '{{ {artifact}.name }}'")
async def delete_{artifact}(http_request: Request, body: Delete{Artifact}ApiRequest):
    # ...
    audit_set({
        "actor": {"name": actor_name},
        "{artifact}": {"name": result.name},
    })
```

Reference: `server/app/routes/v5/api/main/persona/delete.py`

### Rule 10: Simple request shape

Delete requests only need the artifact ID:

```python
class Delete{Artifact}ApiRequest(BaseModel):
    {artifact}_id: UUID
```

---

## MUST NOT Rules

1. **MUST NOT** manually delete junction rows — CASCADE handles it
2. **MUST NOT** count inactive links for usage — only count `active = true` junction rows
3. **MUST NOT** skip usage validation before delete
4. **MUST NOT** allow non-superadmin to delete default (no-department) artifacts
5. **MUST NOT** skip transaction wrapper
6. **MUST NOT** skip audit context — must include deleted artifact name
7. **MUST NOT** use different checks for edit vs delete — same active parent count blocks both

---

## Audit Checks

### Audit 1: Delete endpoint existence

```bash
for artifact_dir in server/app/routes/v5/api/main/*/; do
  artifact=$(basename "$artifact_dir")
  [ ! -f "${artifact_dir}delete.py" ] && echo "MISSING DELETE ENDPOINT: $artifact"
done
```

**Expected**: All artifacts that support deletion should have `delete.py`.

### Audit 2: Access check SQL exists

```bash
for artifact_dir in server/app/routes/v5/api/main/*/; do
  artifact=$(basename "$artifact_dir")
  [ ! -f "${artifact_dir}delete.py" ] && continue
  found=$(find server/app/sql/queries/ -name "check_${artifact}_delete_access*" 2>/dev/null | head -1)
  [ -z "$found" ] && echo "MISSING DELETE ACCESS SQL: $artifact"
done
```

**Expected**: Empty.

### Audit 3: Delete SQL exists

```bash
for artifact_dir in server/app/routes/v5/api/main/*/; do
  artifact=$(basename "$artifact_dir")
  [ ! -f "${artifact_dir}delete.py" ] && continue
  found=$(find server/app/sql/queries/ -name "delete_${artifact}_complete*" 2>/dev/null | head -1)
  [ -z "$found" ] && echo "MISSING DELETE SQL: $artifact"
done
```

**Expected**: Empty.

### Audit 4: Transaction usage

```bash
for artifact_dir in server/app/routes/v5/api/main/*/; do
  artifact=$(basename "$artifact_dir")
  file="${artifact_dir}delete.py"
  [ ! -f "$file" ] && continue
  grep -q "conn.transaction" "$file" || echo "NO TRANSACTION: $artifact"
done
```

**Expected**: Empty.

### Audit 5: Cache invalidation

```bash
for artifact_dir in server/app/routes/v5/api/main/*/; do
  artifact=$(basename "$artifact_dir")
  file="${artifact_dir}delete.py"
  [ ! -f "$file" ] && continue
  grep -q "invalidate_tags" "$file" || echo "NO CACHE INVALIDATION: $artifact"
done
```

**Expected**: Empty.

### Audit 6: Audit context

```bash
for artifact_dir in server/app/routes/v5/api/main/*/; do
  artifact=$(basename "$artifact_dir")
  file="${artifact_dir}delete.py"
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
  grep -q "compute_can_delete" "$file" || echo "MISSING compute_can_delete: $artifact"
done
```

**Expected**: Empty.

### Audit 8: Delete SQL does not manually delete junctions

```bash
for sql_file in server/app/sql/queries/*/delete_*_complete.sql; do
  artifact=$(basename "$(dirname "$sql_file")")
  # Check for manual junction deletion (should rely on CASCADE)
  grep -i "DELETE FROM.*junction" "$sql_file" && echo "MANUAL JUNCTION DELETE: $artifact ($sql_file)"
done
```

**Expected**: Empty. CASCADE should handle junction cleanup.

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

DELETE COVERAGE
===============
Artifacts with delete.py: {N}
Access check SQL: {N}
Delete SQL: {N}
Transaction usage: {N}
Cache invalidation: {N}
Audit context: {N}
Permission function: {N}
CASCADE-only cleanup: {N}
```

---

## Important Notes

1. **Do NOT fix anything.** This is a read-only audit. Report only.
2. **The persona delete is the gold standard.** Reference: `server/app/routes/v5/api/main/persona/delete.py`.
3. **CASCADE is the rule.** Delete SQL must not manually clean up junctions. If CASCADE is not set up on junction FKs, that's a migration/schema bug, not a delete endpoint bug (report it separately via the RELATION audit).
4. **Usage counts are ACTIVE-only.** Only `active = true` junction rows block deletion. This is the unified permission model — same check for edit and delete.
5. **Default artifacts**: Artifacts with no department associations are system defaults and require superadmin to delete.
6. **Role tiers**: Simulation/Intelligence tier uses `admin`/`superadmin`. Admin tier (Department, Rubric, Auth, Eval) uses `superadmin` only. See `audits/PERMISSION_UNIFICATION_PLAN.md` for the full matrix.
