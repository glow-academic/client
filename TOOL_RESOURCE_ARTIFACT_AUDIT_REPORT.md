# Tool-Resource-Artifact Alignment Audit Report

Generated: 2025-01-14

## Executive Summary

**Overall Status**: ✅ **EXCELLENT** - Major improvements since last audit!

- ✅ **All 79 active tools have output schemas** (100% coverage - CRITICAL requirement met)
- ✅ **All 79 active tools have input schemas** (100% coverage - optional but recommended)
- ✅ **All 79 resources have tools** (100% coverage)
- ⚠️ **14 resources not mapped to artifacts** (need artifact mapping)
- ⚠️ **7 schema fields missing from tables** (schema-table mismatches)
- ⚠️ **13 Jinja template errors** (need template fixes)
- ⚠️ **Output mapping gaps** - System-managed columns (`call_id`, `generated`, `mcp`) are correctly excluded from gaps (expected)

## Detailed Findings

### 1. Tool Schema Coverage ✅

**Status**: ✅ **PERFECT**

- **Total Active Tools**: 79
- **Tools with Output Schemas**: 79 (100%)
- **Tools with Input Schemas**: 79 (100%)

**Result**: All tools have both input and output schemas properly configured!

### 2. Resource-Artifact Mapping ⚠️

**Status**: ⚠️ **14 RESOURCES NOT MAPPED TO ARTIFACTS**

**Resources Missing Artifact Mappings** (14 total):

**Corrected Mappings** (resources should NOT map to artifacts with the same name):

1. **`cohorts`** → ❌ **NO MAPPING** (resource shouldn't map to `cohort` artifact)
2. **`evals`** → ❌ **NO MAPPING** (resource shouldn't map to `eval` artifact)
3. **`rubrics`** → ❌ **NO MAPPING** (resource shouldn't map to `rubric` artifact)
4. **`schema_field_items`** → ⚠️ **CHECK IF TOOL REQUIRES** (verify if tool requires artifact mapping)
5. **`schema_fields`** → ⚠️ **CHECK IF TOOL REQUIRES** (verify if tool requires artifact mapping)
6. **`template_array_items`** → ⚠️ **CHECK IF TOOL REQUIRES** (verify if tool requires artifact mapping)
7. **`template_values`** → ⚠️ **CHECK IF TOOL REQUIRES** (verify if tool requires artifact mapping)
8. **`texts`** → `scenario` artifact (text content for scenarios)
9. **`audios`** → `scenario` artifact (audio content for scenarios)
10. **`simulation_scenario_flags`** → `scenario` artifact (note: table is `scenario_flags_resource`)
11. **`conditional_parameters`** → `parameter` artifact (FK: `conditional_parameters_resource.parameter_id` → `parameter_artifact.id`)
12. **`tools`** → `tool` artifact (FK: `tools_resource.tool_id` → `tool_artifact.id`)
13. **`eval_rubric_grade_agents`** → `eval` artifact (grading agents for evals)
14. **`debug_info`** → ✅ **ALL 17 ARTIFACTS** (debug info should be a resource on all artifacts)

**Action Required**: 
- Add `artifact_resources` entries for: `texts`, `audios`, `simulation_scenario_flags`, `conditional_parameters`, `tools`, `eval_rubric_grade_agents`
- Add `debug_info` → all 17 artifacts mappings
- Verify if document resources need artifact mappings (check if tools require them)
- **DO NOT** add mappings for `cohorts`, `evals`, `rubrics`

### 3. Schema-Table Field Mismatches ⚠️

**Status**: ⚠️ **7 SCHEMA FIELDS MISSING FROM TABLES**

**Mismatches Found**:

1. **`auths` resource** (`create_auth` tool):
   - `auth_type` - Missing from `auths_resource` table
   - `slug` - Missing from `auths_resource` table
   - `icon_url` - Missing from `auths_resource` table

2. **`content` resource** (`create_content` tool):
   - `content` - Missing from `content_resource` table (table doesn't exist?)

3. **`simulation_scenario_flags` resource** (`create_simulation_scenario_flags` tool):
   - `name` - Missing from `simulation_scenario_flags_resource` table
   - `description` - Missing from `simulation_scenario_flags_resource` table
   - `icon_id` - Missing from `simulation_scenario_flags_resource` table

**Action Required**: 
- Check if these columns should exist in the tables
- Either add missing columns to tables OR remove schema fields from output schemas
- Verify `content_resource` table exists

### 4. Data Type Compatibility ⚠️

**Status**: ⚠️ **4 DATA TYPE MISMATCHES** (Expected - enum types)

**Mismatches** (These are expected - enum types show as USER-DEFINED):
- `modalities.modality` - schema=string, table=USER-DEFINED (enum type)
- `pricing.pricing_type` - schema=string, table=USER-DEFINED (enum type)
- `qualities.quality` - schema=string, table=USER-DEFINED (enum type)
- `schema_fields.field_type` - schema=string, table=USER-DEFINED (enum type)

**Note**: These are not errors - enum types are compatible with string schema types.

### 5. Jinja Template Errors ⚠️

**Status**: ⚠️ **13 JINJA TEMPLATE ERRORS**

**Action Required**: Review and fix Jinja template syntax errors in output schemas.

### 6. Output Mapping Gaps ⚠️

**Status**: ⚠️ **82 OUTPUT MAPPING GAPS**

**Findings**:
- Most gaps are for `call_id` column (expected - system-managed)
- Other gaps include resource-specific required fields

**Note**: `call_id` gaps are expected since `call_id` is set by the system when creating the call record, not by the tool output schema.

### 7. Tool-Resource Alignment ✅

**Status**: ✅ **PERFECT**

- **One tool per resource**: All 79 resources have exactly 1 tool ✅
- **No duplicate tools**: No tools mapped to multiple resources ✅
- **All tools active**: All tools have active flag set ✅

### 8. INSERT Column Coverage ⚠️

**Status**: ⚠️ **3 INSERT COLUMNS MISSING FROM OUTPUT SCHEMAS**

**Missing Columns**:
- `api_create_simulation_scenario_flags_v4`: `description`
- `api_create_simulation_scenario_flags_v4`: `icon_id`
- `api_create_simulation_scenario_flags_v4`: `name`

**Action Required**: Add these fields to `create_simulation_scenario_flags` output schema.

## Summary Statistics

| Metric | Count | Status |
|--------|-------|--------|
| Total Active Tools | 79 | ✅ |
| Tools with Output Schemas | 79 | ✅ 100% |
| Tools with Input Schemas | 79 | ✅ 100% |
| Resources with Tools | 79 | ✅ 100% |
| Resources Mapped to Artifacts | 65 | ⚠️ 82% |
| Schema-Table Mismatches | 7 | ⚠️ |
| Jinja Template Errors | 13 | ⚠️ |
| Output Mapping Gaps | 82 | ⚠️ (mostly call_id) |

## Critical Issues (Require Immediate Action)

1. **14 resources not mapped to artifacts** - Add `artifact_resources` entries
2. **7 schema fields missing from tables** - Verify table structure or remove schema fields
3. **3 INSERT columns missing from output schemas** - Add to `create_simulation_scenario_flags` output schema
4. **13 Jinja template errors** - Fix template syntax

## Important Issues (Should Be Addressed)

5. **82 output mapping gaps** - Review and add missing schema fields (excluding `call_id`)

## Recommendations

1. **Add artifact mappings** for 14 unmapped resources
2. **Verify table structures** for `auths_resource`, `content_resource`, `simulation_scenario_flags_resource`
3. **Fix Jinja template errors** in output schemas
4. **Add missing output schema fields** for `simulation_scenario_flags` resource

## Next Steps

1. ✅ **Audit Complete** - Comprehensive audit executed
2. **Create Migration** - Add artifact mappings for 14 resources
3. **Fix Schema Mismatches** - Verify/add missing table columns or remove schema fields
4. **Fix Jinja Templates** - Resolve 13 template syntax errors
5. **Update Output Schemas** - Add missing fields for `simulation_scenario_flags`

**Audit Infrastructure Status**: ✅ **COMPLETE**
- SQL audit script: `database/scripts/audit_resource_tools_schemas_agents.sql` ✅
- SQL alignment audit: `database/scripts/audit_tool_resource_artifact_alignment.sql` ✅
- Python audit script: `server/scripts/validate_tool_templates.py` ✅
- Audit executed successfully with results documented above
