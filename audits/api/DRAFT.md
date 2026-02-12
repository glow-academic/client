# DRAFT Audit — Artifact Draft Endpoint Integrity Check

You are an artifact DRAFT endpoint auditor for the GLOW project. Your job is to verify that every artifact's `draft.py` endpoint follows the canonical draft pattern defined below. You do NOT fix anything. You REPORT errors, inconsistencies, and missing pieces.

The source of truth is the **persona** draft implementation. Every artifact draft must match this pattern or document an approved deviation.

---

## The Draft Pattern

| Layer | Location | Purpose |
|-------|----------|---------|
| **Request Types** | `server/app/api/v4/artifacts/{artifact}/types.py` | Optional nested resource actions with `to_tuple()` + `from_request()` |
| **Access Check SQL** | `server/app/sql/v4/queries/{artifact}s/check_{artifact}_duplicate_access_complete.sql` | Lighter access check (shared with duplicate) |
| **Draft SQL** | `server/app/sql/v4/queries/{artifact}s/patch_{artifact}_draft_complete.sql` | Delete-then-insert connection pattern with version control |
| **Python Handler** | `server/app/api/v4/artifacts/{artifact}/draft.py` | Permission check, transaction, cache invalidation |
| **Permissions** | `server/app/api/v4/artifacts/{artifact}/permissions.py` | `compute_can_draft()` — simple role check |

Reference: `server/app/api/v4/artifacts/persona/draft.py`, `persona/types.py`

---

## The Rules

### Rule 1: PATCH method with autosave semantics

Draft endpoints use the PATCH HTTP method, not POST. This reflects autosave semantics — the client patches individual fields as the user edits, not a full save.

```python
@router.patch("/{artifact}s/draft")
async def patch_{artifact}_draft(http_request: Request, body: Patch{Artifact}DraftApiRequest):
```

Reference: `server/app/api/v4/artifacts/persona/draft.py`

### Rule 2: All resource fields are optional

Unlike save (where all resources are required), draft resource actions are all optional. `None` means "don't update this resource":

```python
class Patch{Artifact}DraftApiRequest(BaseModel):
    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    expected_version: int = 0
    names: {Artifact}ResourceAction | None = None
    descriptions: {Artifact}ResourceAction | None = None
    # ... all resources optional ...
    departments: {Artifact}MultiResourceAction | None = None
```

Reference: `server/app/api/v4/artifacts/persona/types.py:477-543`

### Rule 3: `expected_version` for optimistic concurrency control

Draft requests must include `expected_version: int` for optimistic concurrency control. The SQL function detects version collisions and returns an error if the draft was modified by another session since the client last read it.

### Rule 4: `from_request()` defaults None to empty actions

The `from_request()` class method converts `None` resource actions to empty action objects, ensuring SQL always receives valid composites:

```python
@classmethod
def from_request(cls, req: Patch{Artifact}DraftApiRequest, profile_id: UUID):
    _empty_single = {Artifact}ResourceAction()
    _empty_multi = {Artifact}MultiResourceAction()
    return cls(
        profile_id=profile_id,
        input_draft_id=req.input_draft_id,
        group_id=req.group_id,
        expected_version=req.expected_version,
        names=req.names or _empty_single,
        descriptions=req.descriptions or _empty_single,
        # ...
        departments=req.departments or _empty_multi,
    )
```

Reference: `server/app/api/v4/artifacts/persona/types.py`

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

### Rule 7: `to_tuple()` includes `expected_version`

The draft SQL params `to_tuple()` must include `expected_version` at the end:

```python
def to_tuple(self) -> tuple:
    def single(a: {Artifact}ResourceAction) -> tuple:
        return (a.resource_id, a.create_tool_id, a.link_tool_id)

    def multi(a: {Artifact}MultiResourceAction) -> tuple:
        return (a.resource_ids, a.create_tool_id, a.link_tool_id)

    return (
        self.profile_id,
        self.input_draft_id,
        self.group_id,
        single(self.names),
        # ... resources ...
        multi(self.departments),
        self.expected_version,  # at the end
    )
```

Reference: `server/app/api/v4/artifacts/persona/types.py`

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

Reference: `server/app/api/v4/artifacts/persona/permissions.py`

### Rule 10: Lighter access check SQL

Draft endpoints use the same access check SQL as duplicate (not save):

```python
access = await execute_sql_typed(conn, SQL_PATH_DUPLICATE_ACCESS, params=access_params)
```

This is a lighter check that validates the artifact exists and the user has basic access, without the full save access data.

Reference: `server/app/api/v4/artifacts/persona/draft.py`

### Rule 11: Cache invalidation with draft tags

Draft endpoints must invalidate both artifact and draft cache tags:

```python
await invalidate_tags(["{artifact}s", "drafts"])
```

Reference: `server/app/api/v4/artifacts/persona/draft.py`

### Rule 12: Response shape

Draft response must include:

```python
class Patch{Artifact}DraftApiResponse(BaseModel):
    draft_id: UUID
    new_version: int
    success: bool
    message: str
```

### Rule 13: Same resource action types as save

Draft uses the same `{Artifact}ResourceAction` and `{Artifact}MultiResourceAction` types as save, but wrapped in `Optional`. The SQL composite types are shared between save and draft SQL files.

### Rule 14: Shared composite type note

Both save and draft SQL define the same composite types (`types.{artifact}_resource_action`, `types.{artifact}_multi_resource_action`). Each file's `DROP TYPE IF EXISTS ... CASCADE` will cascade-drop functions from the other file. This is by design for JIT compilation.

---

## MUST NOT Rules

1. **MUST NOT** use POST method — draft is PATCH
2. **MUST NOT** require all resources — `None` means skip update
3. **MUST NOT** skip `expected_version` — optimistic concurrency control is mandatory
4. **MUST NOT** use deactivate-then-upsert for draft connections — use delete-then-insert
5. **MUST NOT** track tool calls when `group_id` is NULL
6. **MUST NOT** use heavy save access check SQL — use lighter duplicate access check
7. **MUST NOT** skip audit context — even minimal actor ID + draft ID is required

---

## Audit Checks

### Audit 1: Draft endpoint existence

```bash
for artifact_dir in server/app/api/v4/artifacts/*/; do
  artifact=$(basename "$artifact_dir")
  [ ! -f "${artifact_dir}draft.py" ] && echo "MISSING DRAFT ENDPOINT: $artifact"
done
```

**Expected**: All artifacts that support drafts should have `draft.py`.

### Audit 2: PATCH method usage

```bash
for artifact_dir in server/app/api/v4/artifacts/*/; do
  artifact=$(basename "$artifact_dir")
  file="${artifact_dir}draft.py"
  [ ! -f "$file" ] && continue
  grep -q "\.patch\|PATCH" "$file" || echo "NOT USING PATCH: $artifact"
done
```

**Expected**: Empty.

### Audit 3: Optional resource fields in request

```bash
for artifact_dir in server/app/api/v4/artifacts/*/; do
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
for artifact_dir in server/app/api/v4/artifacts/*/; do
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
for artifact_dir in server/app/api/v4/artifacts/*/; do
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
for sql_file in server/app/sql/v4/queries/*/patch_*_draft_complete.sql; do
  artifact=$(basename "$(dirname "$sql_file")")
  grep -q "DELETE FROM.*drafts_connection" "$sql_file" || echo "NO DELETE-THEN-INSERT: $artifact"
done
```

**Expected**: Empty.

### Audit 7: Version collision detection in SQL

```bash
for sql_file in server/app/sql/v4/queries/*/patch_*_draft_complete.sql; do
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
2. **The persona draft is the gold standard.** Reference: `server/app/api/v4/artifacts/persona/draft.py`.
3. **Shared composite types**: Both save and draft SQL define the same composite types. `DROP TYPE IF EXISTS ... CASCADE` is intentional.
4. **No `audit_activity` decorator**: Unlike save/delete/duplicate, draft endpoints typically do NOT use the `audit_activity` decorator — they use minimal `audit_set()` with actor ID + draft ID only.
5. **Frontend integration**: Drafts are autosaved by `useDraftLifecycle` hook (1s debounce). The hook sends the full form state on every change with `expected_version` for concurrency control.
