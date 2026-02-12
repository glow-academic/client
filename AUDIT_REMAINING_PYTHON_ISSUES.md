# Audit Report: Remaining Python Issues After SQL Migration

## Status Summary

✅ **SQL Migration**: COMPLETE (0 files remaining)
- All SQL files have been updated to remove `view_user_profile_context` usage
- All `RETURNS TABLE` definitions no longer include `actor_name`, `user_role`, `user_department_ids`

❌ **Python Migration**: INCOMPLETE (~120 files need updates)
- Many Python files still reference removed SQL fields
- These will cause runtime AttributeError when accessing non-existent fields

---

## Issue Categories

### Category 1: Access Check Results (60+ files)
**Pattern**: Accessing `access_result.user_role`, `access_result.user_department_ids`, `access_result.actor_name`

**Files Affected**:
- `persona/save.py` (lines 114, 120-121)
- `setting/get.py` (lines 172-174, 225-226, 252)
- `parameter/get.py` (lines 121-123, 445)
- `field/get.py` (lines 138-140, 505)
- `auth/get.py` (lines 167-168, 503)
- `eval/get.py` (lines 203-205, 590)
- `department/get.py` (lines 173-175, 502)
- `model/draft.py` (line 79)
- `provider/draft.py` (line 78)
- `provider/save.py` (lines 95, 100-101, 134)
- `eval/draft.py` (line 79)
- `eval/save.py` (lines 93, 98-100, 135)
- `tool/draft.py` (line 79)
- `tool/save.py` (lines 93, 97-98, 129)
- `auth/draft.py` (line 79)
- `auth/save.py` (lines 93, 98-99, 135)
- `field/draft.py` (line 79)
- `field/save.py` (lines 93, 98-99, 135)
- `field/duplicate.py` (line 85)
- `field/delete.py` (lines 86-87, 123)
- `rubric/draft.py` (line 79)
- `rubric/save.py` (lines 93, 98-99, 135)
- `parameter/draft.py` (line 79)
- `parameter/save.py` (lines 93, 98-99, 135)
- `department/draft.py` (line 79)
- `department/save.py` (lines 93, 98-99, 135)
- `profile/save.py` (lines 93, 98-99, 135)
- `profile/draft.py` (line 79)
- `profile/get.py` (lines 194-196, 227)
- `scenario/get.py` (lines 194-196, 227)
- `simulation/get.py` (lines 194-196, 227)
- `cohort/get.py` (lines 194-196, 227)
- `document/save.py` (lines 93, 98-99, 135)
- `cohort/save.py` (lines 93, 98-99, 135)
- `simulation/save.py` (lines 93, 98-99, 135)
- `simulation/draft.py` (line 79)
- `scenario/save.py` (lines 93, 98-99, 135)
- `persona/draft.py` (line 79)
- `tool/duplicate.py` (line 85)
- `tool/delete.py` (lines 86-87, 123)
- `rubric/duplicate.py` (line 85)
- `rubric/delete.py` (lines 86-87, 123)
- `eval/duplicate.py` (line 85)
- `eval/delete.py` (lines 86-87, 123)
- `persona/duplicate.py` (line 85)
- `persona/delete.py` (lines 86-87, 123)
- `parameter/duplicate.py` (line 85)
- `parameter/delete.py` (lines 86-87, 123)
- `model/duplicate.py` (line 85)
- `model/delete.py` (lines 86-87, 123)
- `profile/duplicate.py` (line 85)
- `profile/delete.py` (lines 86-87, 123)
- `scenario/duplicate.py` (line 85)
- `scenario/delete.py` (lines 86-87, 123)
- `department/duplicate.py` (line 85)
- `department/delete.py` (lines 86-87, 123)
- `document/duplicate.py` (line 85)
- `document/delete.py` (lines 86-87, 123)
- `provider/duplicate.py` (line 85)
- `provider/delete.py` (lines 86-87, 123)
- `auth/duplicate.py` (line 85)
- `auth/delete.py` (lines 86-87, 123)
- Plus more...

**Fix Required**:
1. Add `get_profile_context_internal()` call before access check SQL
2. Replace `access_result.user_role` → `user_role` (from context)
3. Replace `access_result.user_department_ids` → `user_department_ids` (from context)
4. Replace `access_result.actor_name` → `actor_name` (from context)

**Example Fix** (see `persona/save.py` lines 73-85 for reference):
```python
# Add import
from app.api.v4.auth.context import get_profile_context_internal
from app.main import get_pool

# Before access check SQL:
pool = get_pool()
if pool:
    async with pool.acquire() as context_conn:
        resolved_context = await get_profile_context_internal(
            conn=context_conn,
            profile_id=profile_id,
            department_id_cookie=None,
            bypass_cache=False,
        )
        user_role = resolved_context.user_role
        actor_name = resolved_context.actor_name
        user_department_ids = [d.department_id for d in resolved_context.departments if d.department_id]
else:
    user_role = None
    actor_name = None
    user_department_ids = []

# Then replace all access_result references
```

---

### Category 2: List Query Results (12 files)
**Pattern**: Accessing `result.actor_name`, `result.user_role` from list queries

**Files Affected**:
- `parameter/list.py` (lines 121-122, 125, 252)
- `field/list.py` (lines 109-110, 113, 262)
- `profile/list.py` (lines 119-120, 123, 281)
- `document/list.py` (lines 123-124, 127, 287)
- `persona/list.py` (lines 123-124, 127, 290)
- `scenario/list.py` (lines 110-111, 300)
- `cohort/list.py` (lines 101-102)
- `simulation/list.py` (lines 104-105, 170)
- `tool/list.py` (likely similar pattern)
- `rubric/list.py` (likely similar pattern)
- `eval/list.py` (likely similar pattern)
- `model/list.py` (likely similar pattern)

**Fix Required**:
1. Add `get_profile_context_internal()` call before list SQL
2. Replace `result.actor_name` → `actor_name` (from context)
3. Replace `result.user_role` → `user_role` (from context)
4. Update API response: `actor_name=result.actor_name` → `actor_name=actor_name`

**Example Fix**:
```python
# Before list SQL:
pool = get_pool()
if pool:
    async with pool.acquire() as context_conn:
        resolved_context = await get_profile_context_internal(
            conn=context_conn,
            profile_id=profile_id,
            department_id_cookie=None,
            bypass_cache=False,
        )
        actor_name = resolved_context.actor_name
        user_role = resolved_context.user_role
else:
    actor_name = None
    user_role = None

# After list SQL:
# Replace: result.actor_name → actor_name
# Replace: result.user_role → user_role
# In API response: actor_name=actor_name
```

---

### Category 3: Save Query Results (20+ files)
**Pattern**: Accessing `result.actor_name` from save queries

**Files Affected**:
- `persona/save.py` (already fixed - line 139 uses `actor_name` from context)
- `setting/save.py` (lines 98, 115)
- `agent/save.py` (lines 143, 165)
- `provider/save.py` (line 134)
- `eval/save.py` (line 135)
- `tool/save.py` (line 129)
- `auth/save.py` (line 135)
- `field/save.py` (line 135)
- `rubric/save.py` (line 135)
- `parameter/save.py` (line 135)
- `department/save.py` (line 135)
- `profile/save.py` (line 135)
- `document/save.py` (line 135)
- `cohort/save.py` (line 135)
- `simulation/save.py` (line 135)
- `scenario/save.py` (line 135)
- `model/save.py` (line 135)
- Plus more...

**Fix Required**:
1. Add `get_profile_context_internal()` call before save SQL (like `persona/save.py`)
2. Replace `result.actor_name` → `actor_name` (from context)
3. Update API response if it includes `actor_name`

**Example Fix** (see `persona/save.py` lines 73-85, 139):
```python
# Fetch context before save SQL
pool = get_pool()
if pool:
    async with pool.acquire() as context_conn:
        resolved_context = await get_profile_context_internal(...)
        actor_name = resolved_context.actor_name
else:
    actor_name = None

# Replace: result.actor_name → actor_name
```

---

### Category 4: Duplicate/Delete Query Results (16+ files)
**Pattern**: Accessing `result.actor_name` from duplicate/delete queries

**Files Affected**:
- `field/duplicate.py` (line 114)
- `field/delete.py` (line 123)
- `tool/duplicate.py` (line 114)
- `tool/delete.py` (line 123)
- `rubric/duplicate.py` (line 114)
- `rubric/delete.py` (line 123)
- `eval/duplicate.py` (line 114)
- `eval/delete.py` (line 123)
- `persona/duplicate.py` (line 114)
- `persona/delete.py` (line 123)
- `parameter/duplicate.py` (line 114)
- `parameter/delete.py` (line 123)
- `model/duplicate.py` (line 114)
- `model/delete.py` (line 123)
- `profile/duplicate.py` (line 114)
- `profile/delete.py` (line 123)
- Plus more...

**Fix Required**: Same as Category 3 (save queries)

---

### Category 5: Get Query Results (8+ files)
**Pattern**: Accessing `access_result.actor_name` in get queries that return internal data

**Files Affected**:
- `parameter/get.py` (line 445)
- `field/get.py` (line 505)
- `auth/get.py` (line 503)
- `eval/get.py` (line 590)
- `department/get.py` (line 502)
- `setting/get.py` (line 252)
- Plus more...

**Fix Required**:
1. These files likely already fetch context (check if `get_profile_context_internal` is called)
2. Replace `access_result.actor_name` → `actor_name` (from context)
3. Update internal data return: `actor_name=access_result.actor_name` → `actor_name=actor_name`

---

## Quick Verification Commands

### Check for remaining SQL view usage:
```bash
grep -r "FROM view_user_profile_context\|JOIN view_user_profile_context" server/app/sql/v4/queries
```
**Expected**: Empty (0 results)

### Check for Python files accessing removed fields:
```bash
grep -r "access_result\.(actor_name|user_role|user_department_ids)\|result\.(actor_name|user_role|user_department_ids)" server/app/api/v4/artifacts
```
**Expected**: Should only find files that need fixing

### Check which files already use get_profile_context_internal:
```bash
grep -r "get_profile_context_internal" server/app/api/v4/artifacts --files-with-matches
```
**Expected**: ~8 files (persona/get.py, agent/get.py, model/get.py, tool/get.py, provider/get.py, document/get.py, rubric/get.py, persona/save.py)

---

## Priority Order

1. **High Priority** (will cause runtime errors):
   - All files accessing `access_result.user_role` or `access_result.user_department_ids` for permission checks
   - All files accessing `result.actor_name` for audit logging

2. **Medium Priority**:
   - Files accessing `result.user_role` for list queries
   - Files accessing `access_result.actor_name` for internal data

3. **Low Priority**:
   - API response fields that include `actor_name` (may work if None is acceptable)

---

## Testing After Fixes

After fixing each category, test:
```bash
# Run integration tests
make test-integration

# Check for type errors
make typecheck

# Verify no AttributeError references
grep -r "AttributeError\|'actor_name'\|'user_role'\|'user_department_ids'" server/app/api/v4/artifacts
```

---

## Reference Implementation

See these files for correct patterns:
- **Get endpoint**: `server/app/api/v4/artifacts/persona/get.py` (lines 146-160)
- **Save endpoint**: `server/app/api/v4/artifacts/persona/save.py` (lines 73-85, 139)
- **List endpoint**: Needs to be created (follow get pattern)
