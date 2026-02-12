# Migration Plan: Remove `view_user_profile_context` Usage

## Goal
Remove all SQL queries that use `view_user_profile_context` and replace with `get_profile_context_internal()` calls in Python.

## Current Status
- ✅ **Completed**: 15 access check queries (`get_*_access_complete.sql`)
- ✅ **Completed**: 1 save query (`save_persona_complete.sql` + Python)
- ✅ **Completed**: Profile access query
- ⏳ **Remaining**: ~108 SQL files + corresponding Python files

## File Categories & Patterns

### Category 1: `check_*_access_complete.sql` (30 files)
**Pattern**: Similar to `get_*_access_complete.sql` - remove user context from SQL

**Files**:
- `auth/check_auth_delete_access_complete.sql`
- `auth/check_auth_duplicate_access_complete.sql`
- `auth/check_auth_save_access_complete.sql`
- `departments/check_department_delete_access_complete.sql`
- `departments/check_department_duplicate_access_complete.sql`
- `departments/check_department_save_access_complete.sql`
- `documents/check_document_delete_access_complete.sql`
- `documents/check_document_duplicate_access_complete.sql`
- `documents/check_document_save_access_complete.sql`
- `evals/check_eval_delete_access_complete.sql`
- `evals/check_eval_duplicate_access_complete.sql`
- `evals/check_eval_save_access_complete.sql`
- `fields/check_field_delete_access_complete.sql`
- `fields/check_field_duplicate_access_complete.sql`
- `fields/check_field_save_access_complete.sql`
- `models/check_model_delete_access_complete.sql`
- `models/check_model_duplicate_access_complete.sql`
- `models/check_model_save_access_complete.sql`
- `parameters/check_parameter_delete_access_complete.sql`
- `parameters/check_parameter_duplicate_access_complete.sql`
- `parameters/check_parameter_save_access_complete.sql`
- `personas/check_persona_delete_access_complete.sql`
- `personas/check_persona_duplicate_access_complete.sql`
- `personas/check_persona_save_access_complete.sql`
- `profile/check_profile_delete_access_complete.sql`
- `profile/check_profile_duplicate_access_complete.sql`
- `profile/check_profile_save_access_complete.sql`
- `providers/check_provider_delete_access_complete.sql`
- `providers/check_provider_duplicate_access_complete.sql`
- `providers/check_provider_save_access_complete.sql`
- `rubrics/check_rubric_delete_access_complete.sql`
- `rubrics/check_rubric_duplicate_access_complete.sql`
- `rubrics/check_rubric_save_access_complete.sql`
- `scenario/check_scenario_delete_access_complete.sql`
- `scenario/check_scenario_duplicate_access_complete.sql`
- `simulations/check_simulation_delete_access_complete.sql`
- `simulations/check_simulation_duplicate_access_complete.sql`
- `simulations/check_simulation_save_access_complete.sql`
- `tools/check_tool_delete_access_complete.sql`
- `tools/check_tool_duplicate_access_complete.sql`
- `tools/check_tool_save_access_complete.sql`
- `settings/get_setting_access_complete.sql`

**SQL Changes** (same pattern as `get_*_access_complete.sql`):
1. Remove from `RETURNS TABLE`: `actor_name text`, `user_role text`, `user_department_ids uuid[]`
2. Remove CTEs: `user_profile AS (SELECT role, actor_name FROM view_user_profile_context...)` and `user_departments AS (...)`
3. Remove from SELECT: `up.actor_name::text as actor_name`, `up.role::text as user_role`, `ud.department_ids as user_department_ids`
4. Remove CROSS JOINs: `CROSS JOIN user_profile up`, `CROSS JOIN user_departments ud`
5. Update comment: "User context (role, actor_name, department_ids) comes from get_profile_context_internal()"

**Python Changes**:
- These are typically called from save/delete/duplicate endpoints
- Fetch context in Python before calling check access SQL
- Use `resolved_context.user_role` and `resolved_context.user_department_ids` for permission checks

---

### Category 2: `save_*_complete.sql` (20 files)
**Pattern**: Remove `actor_name` from SQL return, fetch in Python for audit logging

**Files**:
- `agents/save_agent_complete.sql`
- `auth/save_auth_complete.sql`
- `cohorts/save_cohort_complete.sql`
- `departments/save_department_complete.sql`
- `documents/save_document_complete.sql`
- `evals/save_eval_complete.sql`
- `fields/save_field_complete.sql`
- `models/save_model_complete.sql`
- `parameters/save_parameter_complete.sql`
- `providers/save_provider_complete.sql`
- `rubrics/save_rubric_complete.sql`
- `settings/save_setting_complete.sql`
- `simulations/save_simulation_complete.sql`
- `tools/save_tool_complete.sql`

**SQL Changes**:
1. Remove `actor_name text` from `RETURNS TABLE`
2. Remove `v_actor_name text` from DECLARE (if present)
3. Remove CTE: `user_profile AS (SELECT role, actor_name FROM view_user_profile_context...)`
4. Remove CTE: `actor_profile AS (SELECT x.profile_id, up.actor_name FROM params x CROSS JOIN user_profile up)`
5. Remove from SELECT: `ap.actor_name AS actor_name` (or `up.actor_name::text as actor_name`)
6. Remove CROSS JOIN: `CROSS JOIN actor_profile ap` (or `CROSS JOIN user_profile up`)

**Python Changes** (example: `server/app/api/v4/artifacts/persona/save.py`):
```python
# Add import
from app.api.v4.auth.context import get_profile_context_internal
from app.main import get_pool

# Before SQL call, fetch context:
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
else:
    actor_name = None

# Replace: result.actor_name → actor_name
# In audit logging: if result.actor_name: → if actor_name:
```

---

### Category 3: `delete_*_complete.sql` (6 files)
**Pattern**: Same as save - remove `actor_name` from SQL, fetch in Python

**Files**:
- `documents/insert_document_complete.sql` (special case)
- `evals/delete_eval_complete.sql`
- `fields/delete_field_complete.sql`
- `personas/delete_persona_complete.sql`
- `providers/delete_provider_complete.sql`
- `settings/delete_setting_complete.sql`
- `tools/delete_tool_complete.sql`
- `staff/bulk_delete_staff_complete.sql`

**SQL Changes**: Same as Category 2 (save)

**Python Changes**: Same as Category 2 (save)

---

### Category 4: `duplicate_*_complete.sql` (8 files)
**Pattern**: Same as save - remove `actor_name` from SQL, fetch in Python

**Files**:
- `documents/duplicate_document_complete.sql`
- `evals/duplicate_eval_complete.sql`
- `fields/duplicate_field_complete.sql`
- `personas/duplicate_persona_complete.sql`
- `profile/duplicate_profile_complete.sql`
- `providers/duplicate_provider_complete.sql`
- `settings/duplicate_setting_complete.sql`
- `tools/duplicate_tool_complete.sql`

**SQL Changes**: Same as Category 2 (save)

**Python Changes**: Same as Category 2 (save)

---

### Category 5: `get_*_list_complete.sql` (18 files)
**Pattern**: Remove `actor_name` from SQL, add in Python after fetching list

**Files**:
- `agents/get_agents_list_complete.sql`
- `auth/get_auth_list_complete.sql`
- `cohorts/get_cohorts_list_complete.sql`
- `departments/get_departments_list_complete.sql`
- `documents/get_documents_list_complete.sql`
- `evals/get_evals_list_complete.sql`
- `fields/get_fields_list_complete.sql`
- `models/list_models_complete.sql`
- `parameters/get_parameters_list_complete.sql`
- `personas/get_personas_list_complete.sql`
- `providers/get_providers_list_complete.sql`
- `rubric/get_rubrics_list_complete.sql`
- `scenario/get_scenarios_list_complete.sql`
- `settings/get_settings_list_complete.sql`
- `simulations/get_simulations_list_complete.sql`
- `staff/get_staff_list_complete.sql`
- `tools/get_tools_list_complete.sql`

**SQL Changes**:
1. Remove `actor_name text` from `RETURNS TABLE`
2. Remove CTE: `user_profile AS (SELECT actor_name FROM view_user_profile_context...)`
3. Remove from SELECT: `up.actor_name::text as actor_name`
4. Remove CROSS JOIN: `CROSS JOIN user_profile up`

**Python Changes** (example: `server/app/api/v4/artifacts/persona/list.py`):
```python
# Add import
from app.api.v4.auth.context import get_profile_context_internal
from app.main import get_pool

# Before/after SQL call, fetch context:
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
else:
    actor_name = None

# Replace: result.actor_name → actor_name
# In API response: actor_name=result.actor_name → actor_name=actor_name
```

---

### Category 6: `get_*_complete.sql` (non-access) (12 files)
**Pattern**: Check if they return `actor_name` - if yes, remove from SQL, fetch in Python

**Files**:
- `agents/get_agent_complete.sql`
- `auth/get_auth_complete.sql`
- `cohorts/get_cohort_complete.sql`
- `departments/get_department_complete.sql`
- `documents/get_document_complete.sql`
- `fields/get_field_complete.sql`
- `parameters/get_parameter_complete.sql`
- `profile/get_profile_complete.sql`
- `profile/create_or_update_profile_complete.sql`
- `rubrics/get_rubric_complete.sql`
- `settings/get_setting_complete.sql`
- `tools/get_tool_complete.sql`

**SQL Changes**: Same as Category 5 (list)

**Python Changes**: Same as Category 5 (list)

---

### Category 7: Special Cases (6 files)
**Files**:
- `documents/process_document_csv_complete.sql`
- `documents/insert_document_complete.sql`
- `generate/training/get_training_simulations_complete.sql`
- `staff/get_staff_search_complete.sql`
- `staff/process_csv_complete.sql`
- `staff/upsert_staff_complete.sql`
- `views/training/context/get_training_context_view_complete.sql`

**Action**: Inspect each file individually - follow same pattern (remove view usage, fetch in Python)

---

## Step-by-Step Process for Each File

### For Each SQL File:

1. **Open the SQL file**
2. **Find the view usage**: `FROM view_user_profile_context` or `JOIN view_user_profile_context`
3. **Identify what fields are used**: `actor_name`, `user_role`, `user_department_ids`
4. **Remove from RETURNS TABLE**: Remove `actor_name text`, `user_role text`, `user_department_ids uuid[]`
5. **Remove CTEs**: Remove `user_profile` and `user_departments` CTEs
6. **Remove from SELECT**: Remove `up.actor_name::text as actor_name`, etc.
7. **Remove CROSS JOINs**: Remove `CROSS JOIN user_profile up`, etc.
8. **Update comment**: Add note that user context comes from `get_profile_context_internal()`

### For Each Python File:

1. **Find the Python file** that calls the SQL (usually in `server/app/api/v4/artifacts/[resource]/`)
2. **Add import**: `from app.api.v4.auth.context import get_profile_context_internal`
3. **Add pool import** (if not present): `from app.main import get_pool`
4. **Fetch context** before SQL call:
   ```python
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
           user_department_ids = [d.department_id for d in resolved_context.departments if d.department_id]
   else:
       actor_name = None
       user_role = None
       user_department_ids = []
   ```
5. **Replace SQL result references**:
   - `result.actor_name` → `actor_name`
   - `result.user_role` → `user_role`
   - `result.user_department_ids` → `user_department_ids`
   - `access_result.user_role` → `user_role`
   - `access_result.user_department_ids` → `user_department_ids`

---

## Verification Steps

### After Each Batch:

1. **Run SQL compilation**:
   ```bash
   make sql-compile
   ```
   - Should regenerate types without errors (ignore unrelated errors about `position` column)

2. **Check Python types**:
   ```bash
   grep -r "actor_name.*access_result\|access_result\.actor_name\|result\.actor_name" server/app/api/v4/artifacts/
   ```
   - Should find no matches (or only in files not yet migrated)

3. **Check SQL files**:
   ```bash
   grep -r "FROM view_user_profile_context\|JOIN view_user_profile_context" server/app/sql/v4/queries
   ```
   - Count should decrease with each batch

### Final Verification:

1. **No SQL files use the view**:
   ```bash
   grep -r "FROM view_user_profile_context\|JOIN view_user_profile_context" server/app/sql/v4/queries
   ```
   - Should return empty result

2. **No Python files reference removed fields**:
   ```bash
   grep -r "\.actor_name\|\.user_role\|\.user_department_ids" server/app/api/v4/artifacts/ | grep -v "resolved_context\|context\.actor_name\|context\.user_role"
   ```
   - Should only find references to `resolved_context.actor_name`, etc.

3. **Run tests**:
   ```bash
   make test-integration
   ```

---

## Final Step: Remove View Definition

Once all files are migrated:

1. **Delete the view file**:
   ```bash
   rm server/app/sql/v4/views/shared/create_user_profile_context_view.sql
   ```

2. **Check if view is created elsewhere**:
   ```bash
   grep -r "CREATE.*VIEW.*view_user_profile_context\|CREATE OR REPLACE VIEW view_user_profile_context" server/
   ```

3. **Remove view from database** (if needed):
   ```sql
   DROP VIEW IF EXISTS view_user_profile_context CASCADE;
   ```

---

## Reference Examples

### SQL Pattern (Access Check):
See: `server/app/sql/v4/queries/personas/get_persona_access_complete.sql`

### SQL Pattern (Save):
See: `server/app/sql/v4/queries/personas/save_persona_complete.sql`

### Python Pattern (Get):
See: `server/app/api/v4/artifacts/persona/get.py` (lines 146-160)

### Python Pattern (Save):
See: `server/app/api/v4/artifacts/persona/save.py` (lines 64-90, 139)

---

## Progress Tracking

Use this command to track remaining files:
```bash
grep -r "FROM view_user_profile_context\|JOIN view_user_profile_context" server/app/sql/v4/queries --files-with-matches | wc -l
```

Target: **0 files**

---

## Notes

- All changes follow the same pattern - consistency is key
- Test after each artifact type (e.g., all personas, then all agents, etc.)
- Some files may have unique patterns - inspect individually
- The view is only used for `actor_name` and `user_role` - both now come from `get_profile_context_internal()`
