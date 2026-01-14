# Tools, Schemas, and Setup Inconsistencies Report

Generated: 2025-01-14

## Summary

**Total Issues Found**: 6 categories, 20+ specific issues

---

## ✅ GOOD NEWS

1. **All 79 tools have output schemas** ✅
2. **All 79 tools have input schemas** ✅
3. **All 79 resources have exactly 1 tool each** ✅
4. **No tools mapped to multiple resources** ✅
5. **No duplicate artifact-resource mappings** ✅
6. **All resources exist in enum** ✅
7. **No orphaned enum values** ✅
8. **No Jinja template syntax errors detected** ✅

---

## ⚠️ ISSUES FOUND

### 1. Schema-Table Field Mismatches (7 fields)

**Issue**: Output schema fields don't match actual table columns

#### 1.1 `auths` resource (`create_auth` tool)
- **Schema fields present** (should be removed):
  - `auth_type` - Missing from `auths_resource` table
  - `slug` - Missing from `auths_resource` table  
  - `icon_url` - Missing from `auths_resource` table
- **Reason**: These are now handled via `slugs` and `protocols` resource tables
- **Action**: Remove these 3 fields from `create_auth` output schema (matches migration 258)

#### 1.2 `content` resource (`create_content` tool)
- **Schema field**: `content`
- **Table**: `contents_resource` EXISTS ✅
- **Issue**: Table has `content_id` column (FK to `contents` table), not `content` column
- **Reason**: Resource tables store references, not content itself
- **Action**: Either remove `content` field from output schema OR change to `content_id` if tool should reference existing content

#### 1.3 `simulation_scenario_flags` resource (`create_simulation_scenario_flags` tool)
- **Schema fields**: `name`, `description`, `icon_id`
- **Table**: `scenario_flags_resource` EXISTS ✅
- **Table columns**: ✅ `name` (text, NOT NULL), `description` (text, nullable), `icon_id` (uuid, nullable) - ALL EXIST
- **Issue**: Resource enum name (`simulation_scenario_flags`) doesn't match table name (`scenario_flags_resource`)
- **Root Cause**: Audit script checks `simulation_scenario_flags_resource` table, but actual table is `scenario_flags_resource`
- **Action**: ✅ **RESOLVED** - Update audit script to check `scenario_flags_resource` table instead of `simulation_scenario_flags_resource`

---

### 2. Resources Not Mapped to Artifacts (14 resources)

**Issue**: Resources exist with tools but no artifact mapping

1. `cohorts` - ❌ Should NOT map to `cohort` artifact (resources shouldn't map to artifacts with same name)
2. `evals` - ❌ Should NOT map to `eval` artifact
3. `rubrics` - ❌ Should NOT map to `rubric` artifact
4. `schema_field_items` - ⚠️ Should map to `document` artifact (if tool requires it)
5. `schema_fields` - ⚠️ Should map to `document` artifact (if tool requires it)
6. `template_array_items` - ⚠️ Should map to `document` artifact (if tool requires it)
7. `template_values` - ⚠️ Should map to `document` artifact (if tool requires it)
8. `texts` - ✅ Should map to `scenario` artifact
9. `audios` - ✅ Should map to `scenario` artifact
10. `simulation_scenario_flags` - ✅ Should map to `scenario` artifact
11. `conditional_parameters` - ✅ Should map to `parameter` artifact
12. `tools` - ✅ Should map to `tool` artifact
13. `eval_rubric_grade_agents` - ✅ Should map to `eval` artifact
14. `debug_info` - ✅ Should map to ALL 17 artifacts

**Action**: Migration 258 addresses items 4-7, 8-14. Items 1-3 should remain unmapped.

---

### 3. Table Name Mismatches (3 resources)

**Issue**: Resource enum names don't match actual table names

1. **`content` resource** → Table: `contents_resource` ✅ EXISTS
   - Enum: `content`
   - Table: `contents_resource`
   - **Action**: Migration 258 renames enum to `contents`

2. **`simulation_scenario_flags` resource** → Table: `scenario_flags_resource` ✅ EXISTS
   - Enum: `simulation_scenario_flags`
   - Table: `scenario_flags_resource`
   - **Action**: Update audit scripts to check `scenario_flags_resource` table

3. **`eval_rubric_grade_agents` resource** → Table: `eval_rubric_grade_agents_resource` ❌ MISSING
   - **Status**: Table does NOT exist
   - **Issue**: Tool exists but no resource table
   - **Action**: Either create `eval_rubric_grade_agents_resource` table OR remove `create_eval_rubric_grade_agents` tool

---

### 4. Output Schemas with Zero Fields (2 tools)

**Issue**: Tools have output schema templates but no schema fields

1. **`create_schema`** (`schemas` resource)
   - Has output template ✅
   - Has 0 schema fields ❌
   - **Action**: Add schema fields to output schema OR verify if this is intentional

2. **`create_eval_rubric_grade_agents`** (`eval_rubric_grade_agents` resource)
   - Has output template ✅
   - Has 0 schema fields ❌
   - **Action**: Add schema fields to output schema OR verify if this is intentional

---

### 5. Tables Without Active Tools (3 tables)

**Issue**: Resource tables exist but no active tools reference them

1. **`contents_resource`** - Has `content` resource tool ✅ (will be fixed by migration 258)
2. **`logins_resource`** - No tool found
   - **Action**: Verify if this table is still used or should be removed
3. **`roles_resource`** - No tool found
   - **Action**: Verify if this table is still used or should be removed

---

### 6. Document Resources Not Mapped (4 resources)

**Issue**: Document-related resources exist but not mapped to `document` artifact

1. `schema_fields` - Not mapped
2. `schema_field_items` - Not mapped
3. `template_array_items` - Not mapped
4. `template_values` - Not mapped

**Action**: Migration 258 adds these mappings (matches `tool` artifact pattern)

---

## 🔍 VERIFICATION NEEDED

1. **`scenario_flags_resource` table structure**
   - Verify if table has `name`, `description`, `icon_id` columns
   - If yes, update audit script to check correct table name
   - If no, remove these fields from `create_simulation_scenario_flags` output schema

2. **`eval_rubric_grade_agents_resource` table**
   - Verify if table exists
   - If yes, verify structure
   - If no, create table or remove tool

3. **`create_schema` and `create_eval_rubric_grade_agents` output schemas**
   - Verify if zero fields is intentional
   - If not, add appropriate schema fields

4. **`logins_resource` and `roles_resource` tables**
   - Verify if these tables are still used
   - If not, consider removing or documenting as legacy

---

## 📋 MIGRATION 258 COVERAGE

Migration 258 addresses:
- ✅ Removes `auth_type`, `slug`, `icon_url` from `create_auth` output schema
- ✅ Renames `content` enum to `contents`
- ✅ Adds `schema_fields`, `schema_field_items`, `template_array_items`, `template_values` to `document` artifact

Migration 258 does NOT address:
- ⚠️ `simulation_scenario_flags` table name mismatch (needs audit script update)
- ⚠️ `create_schema` and `create_eval_rubric_grade_agents` zero-field schemas
- ⚠️ `eval_rubric_grade_agents_resource` table verification
- ⚠️ `logins_resource` and `roles_resource` orphaned tables

---

## 🎯 RECOMMENDED ACTIONS

### Before Running Migration 258:
1. ✅ Verified `scenario_flags_resource` table has `name`, `description`, `icon_id` columns
2. ❌ **CRITICAL**: `eval_rubric_grade_agents_resource` table does NOT exist - tool exists but no table
3. ⚠️ Review `create_schema` and `create_eval_rubric_grade_agents` zero-field schemas

### After Running Migration 258:
1. Update audit scripts to handle `contents` enum name
2. Update audit scripts to check `scenario_flags_resource` table for `simulation_scenario_flags` resource
3. **CRITICAL**: Create `eval_rubric_grade_agents_resource` table OR remove `create_eval_rubric_grade_agents` tool
4. Add schema fields to `create_schema` and `create_eval_rubric_grade_agents` if needed
5. Document or remove `logins_resource` and `roles_resource` tables

---

## 📊 STATISTICS

- **Total Active Tools**: 79
- **Tools with Output Schemas**: 79 (100%)
- **Tools with Input Schemas**: 79 (100%)
- **Resources with Tools**: 79 (100%)
- **Resources Mapped to Artifacts**: 65 (82%)
- **Schema-Table Mismatches**: 7 fields
- **Output Schemas with Zero Fields**: 2 tools
- **Orphaned Tables**: 2 tables
