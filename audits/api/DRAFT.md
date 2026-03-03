# DRAFT Audit — Artifact Draft Endpoint Integrity Check

You are an artifact DRAFT endpoint auditor for the GLOW project. Your job is to verify that every artifact's `draft.py` endpoint follows the canonical draft pattern defined below. You do NOT fix anything. You REPORT errors, inconsistencies, and missing pieces.

The source of truth is the **persona** draft implementation. Every artifact draft must match this pattern or document an approved deviation.

---

## The Draft Pattern

| Layer | Location | Purpose |
|-------|----------|---------|
| **Request Types** | `server/app/v5/api/main/{artifact}/types.py` | Optional nested resource actions with `to_tuple()` + `from_request()` |
| **Access Check SQL** | `server/app/v5/sql/queries/{artifact}s/check_{artifact}_duplicate_access_complete.sql` | Lighter access check (shared with duplicate) |
| **Draft SQL** | `server/app/v5/sql/queries/{artifact}s/patch_{artifact}_draft_complete.sql` | Delete-then-insert connection pattern with version control |
| **Python Handler** | `server/app/v5/api/main/{artifact}/draft.py` | Permission check, transaction, cache invalidation |
| **Permissions** | `server/app/v5/api/main/{artifact}/permissions.py` | `compute_can_draft()` — simple role check |

Reference: `server/app/v5/api/main/persona/draft.py`, `persona/types.py`

---

## The Rules

### Rule 1: PATCH method with autosave semantics

Draft endpoints use the PATCH HTTP method, not POST. This reflects autosave semantics — the client patches individual fields as the user edits, not a full save.

```python
@router.patch("/{artifact}s/draft")
async def patch_{artifact}_draft(http_request: Request, body: Patch{Artifact}DraftApiRequest):
```

Reference: `server/app/v5/api/main/persona/draft.py`

### Rule 2: All resource fields are flat optional IDs

Unlike save (where all resources are present), draft resource IDs are all optional. `None` means "don't update this resource":

```python
class Patch{Artifact}DraftApiRequest(BaseModel):
    input_draft_id: UUID | None = None
    expected_version: int = 0
    name_id: UUID | None = None
    description_id: UUID | None = None
    # ... all single-select resources as optional flat UUIDs ...
    department_ids: list[UUID] | None = None
    # ... all multi-select resources as optional flat UUID lists ...
```

No `group_id` (server-resolved), no tool IDs (server-resolved), no nested wrapper types.

Reference: `server/app/v5/api/main/persona/types.py`

### Rule 3: `expected_version` for optimistic concurrency control

Draft requests must include `expected_version: int` for optimistic concurrency control. The SQL function detects version collisions and returns an error if the draft was modified by another session since the client last read it.

### Rule 4: `from_request()` adds server-resolved fields

The `from_request()` class method adds `profile_id`, server-resolved `group_id`, and server-resolved `tool_ids`. Flat IDs pass through directly:

```python
@classmethod
def from_request(
    cls,
    req: Patch{Artifact}DraftApiRequest,
    profile_id: UUID,
    group_id: UUID | None,
    tool_ids: dict[str, UUID | None],
):
    return cls(
        profile_id=profile_id,
        input_draft_id=req.input_draft_id,
        group_id=group_id,
        expected_version=req.expected_version,
        name_id=req.name_id,
        description_id=req.description_id,
        # ... flat IDs pass through ...
        tool_ids_json=json.dumps({k: str(v) for k, v in tool_ids.items() if v}) if tool_ids else None,
    )
```

Reference: `server/app/v5/api/main/persona/types.py`

### Rule 5: Create vs update draft

- `input_draft_id = NULL` → create new draft
- `input_draft_id = <UUID>` → update existing draft

### Rule 6: Draft SQL uses delete-then-insert for connections

Unlike save (which uses deactivate-then-upsert on junctions), draft SQL uses delete-then-insert for draft connections:

```sql
-- Step 1: Delete all existing connections for this draft
DELETE FROM names_drafts_connection WHERE draft_id = v_draft_id;

-- Step 2: Insert fresh connections
INSERT INTO names_drafts_connection (draft_id, names_resource_id)
VALUES (v_draft_id, v_name_resource_id);
```

Drafts always replace all connections — there is no `active` flag on draft connections.

Reference: `patch_persona_draft_complete.sql`

### Rule 7: `to_tuple()` includes flat IDs and `expected_version`

The draft SQL params `to_tuple()` serializes flat resource IDs with `expected_version` at the end:

```python
def to_tuple(self) -> tuple:
    return (
        self.profile_id,
        self.input_draft_id,
        self.group_id,              # Server-resolved
        self.name_id,
        self.description_id,
        # ... flat single-select IDs ...
        self.department_ids,
        # ... flat multi-select ID lists ...
        self.expected_version,      # at the end
        self.tool_ids_json,         # Server-resolved JSONB
    )
```

Reference: `server/app/v5/api/main/persona/types.py`

### Rule 8: Tool-call tracking conditional on `v_group_id IS NOT NULL`

Draft SQL must track tool calls (create `runs_entry` + `calls_entry` + `tool_calls_junction`) only when `v_group_id IS NOT NULL`. A brand-new draft without a group skips tracking since there's no run context.

```sql
IF v_group_id IS NOT NULL THEN
    -- Create runs_entry, calls_entry, tool_calls_junction
END IF;
```

Reference: `patch_persona_draft_complete.sql`

### Rule 9: Simple role-based permission check

Draft permission is a simple role check — no department check, no usage check:

```python
def compute_can_draft(user_role: str) -> bool:
    return user_role in ("admin", "instructional", "superadmin")
```

User role must come from `get_auth_profile_internal()`, not the monolithic `get_profile_context_internal()`:

```python
from app.v5.auth.profile import get_auth_profile_internal

profile_ctx = await get_auth_profile_internal(conn, profile_id, bypass_cache=False)
user_role = profile_ctx.access.role
```

See GET.md Rule 2 for the full profile/settings split pattern.

Reference: `server/app/v5/api/main/persona/permissions.py`, `draft.py`

### Rule 10: Lighter access check SQL

Draft endpoints use the same access check SQL as duplicate (not save):

```python
access = await execute_sql_typed(conn, SQL_PATH_DUPLICATE_ACCESS, params=access_params)
```

This is a lighter check that validates the artifact exists and the user has basic access, without the full save access data.

Reference: `server/app/v5/api/main/persona/draft.py`

### Rule 11: Cache invalidation with draft tags

Draft endpoints must invalidate both artifact and draft cache tags:

```python
await invalidate_tags(["{artifact}s", "drafts"])
```

Reference: `server/app/v5/api/main/persona/draft.py`

### Rule 12: Response shape

Draft response must include:

```python
class Patch{Artifact}DraftApiResponse(BaseModel):
    draft_id: UUID
    new_version: int
    success: bool
    message: str
```

### Rule 13: Same flat ID pattern as save

Draft uses the same flat resource ID pattern as save, but all fields are optional (`None` = skip update). No nested wrapper types.

### Rule 14: Server-side `group_id` resolution

The client does NOT send `group_id` in the draft request. The server resolves it:

- **Update** (`input_draft_id` provided): `group_id` comes from the existing draft's access check.
- **Create** (`input_draft_id` is NULL): `group_id` may be NULL for brand-new drafts without a generation context.

---

## MUST NOT Rules

1. **MUST NOT** use POST method — draft is PATCH
2. **MUST NOT** require all resources — `None` means skip update
3. **MUST NOT** skip `expected_version` — optimistic concurrency control is mandatory
4. **MUST NOT** use deactivate-then-upsert for draft connections — use delete-then-insert
5. **MUST NOT** track tool calls when `group_id` is NULL
6. **MUST NOT** use heavy save access check SQL — use lighter duplicate access check
7. **MUST NOT** skip audit context — even minimal actor ID + draft ID is required
8. **MUST NOT** use nested resource action wrapper types — use flat optional IDs
9. **MUST NOT** accept `group_id` from the client — server resolves it from the access check

---

## Audit Checks

### Audit 1: Draft endpoint existence

```bash
for artifact_dir in server/app/v5/api/main/*/; do
  artifact=$(basename "$artifact_dir")
  [ ! -f "${artifact_dir}draft.py" ] && echo "MISSING DRAFT ENDPOINT: $artifact"
done
```

**Expected**: All artifacts that support drafts should have `draft.py`.

### Audit 2: PATCH method usage

```bash
for artifact_dir in server/app/v5/api/main/*/; do
  artifact=$(basename "$artifact_dir")
  file="${artifact_dir}draft.py"
  [ ! -f "$file" ] && continue
  grep -q "\.patch\|PATCH" "$file" || echo "NOT USING PATCH: $artifact"
done
```

**Expected**: Empty.

### Audit 3: Optional resource fields in request

```bash
for artifact_dir in server/app/v5/api/main/*/; do
  artifact=$(basename "$artifact_dir")
  file="${artifact_dir}types.py"
  [ ! -f "$file" ] && continue
  grep -q "PatchDraft\|Patch.*Draft" "$file" || continue
  # Check for Optional/None patterns in draft request
  grep -A 30 "class Patch.*Draft.*Request" "$file" | grep -q "None" || echo "NON-OPTIONAL DRAFT FIELDS: $artifact"
done
```

**Expected**: Empty.

### Audit 4: Expected version in request

```bash
for artifact_dir in server/app/v5/api/main/*/; do
  artifact=$(basename "$artifact_dir")
  file="${artifact_dir}types.py"
  [ ! -f "$file" ] && continue
  grep -q "PatchDraft\|Patch.*Draft" "$file" || continue
  grep -q "expected_version" "$file" || echo "MISSING expected_version: $artifact"
done
```

**Expected**: Empty.

### Audit 5: Cache invalidation includes draft tags

```bash
for artifact_dir in server/app/v5/api/main/*/; do
  artifact=$(basename "$artifact_dir")
  file="${artifact_dir}draft.py"
  [ ! -f "$file" ] && continue
  grep -q "invalidate_tags" "$file" || echo "NO CACHE INVALIDATION: $artifact"
  grep -q "drafts" "$file" || echo "MISSING DRAFT TAG: $artifact"
done
```

**Expected**: Empty.

### Audit 6: Draft SQL uses delete-then-insert

```bash
for sql_file in server/app/v5/sql/queries/*/patch_*_draft_complete.sql; do
  artifact=$(basename "$(dirname "$sql_file")")
  grep -q "DELETE FROM.*drafts_connection" "$sql_file" || echo "NO DELETE-THEN-INSERT: $artifact"
done
```

**Expected**: Empty.

### Audit 7: Version collision detection in SQL

```bash
for sql_file in server/app/v5/sql/queries/*/patch_*_draft_complete.sql; do
  artifact=$(basename "$(dirname "$sql_file")")
  grep -q "expected_version\|version" "$sql_file" || echo "NO VERSION CHECK: $artifact"
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
Total audits: 7
Passed: {N}
Failed: {N}

DRAFT COVERAGE
==============
Artifacts with draft.py: {N}
PATCH method: {N}
Optional fields: {N}
Expected version: {N}
Cache invalidation: {N}
Delete-then-insert SQL: {N}
Version collision detection: {N}
```

---

## Important Notes

1. **Do NOT fix anything.** This is a read-only audit. Report only.
2. **The persona draft is the gold standard.** Reference: `server/app/v5/api/main/persona/draft.py`.
3. **No composite types needed**: Both save and draft SQL receive flat UUID parameters. The previous composite types are replaced by flat parameters.
4. **No `audit_activity` decorator**: Unlike save/delete/duplicate, draft endpoints typically do NOT use the `audit_activity` decorator — they use minimal `audit_set()` with actor ID + draft ID only.
5. **Frontend integration**: Drafts are autosaved by `useDraftLifecycle` hook (1s debounce). The hook sends the full form state on every change with `expected_version` for concurrency control.
