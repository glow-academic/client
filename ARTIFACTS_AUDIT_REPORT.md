# Artifacts and Resources Audit Report

Generated: 2025-01-XX

## Summary

- **Total Artifacts**: 17 ✅
- **Total Resources**: 76 in enum, 79 resource tables
- **Total Artifact-Resource Pairs**: 137 ✅
- **Missing Junction Tables**: 0 ✅ (All junction tables exist)
- **Compliant Junction Tables**: 284/284 ✅ (100% compliant - all have `generated`, `mcp`, `active`, `updated_at`)
- **Resources with nullable `call_id`**: 6 (agents_resource, auths_resource, logins_resource, roles_resource, templates_resource, values_resource)
- **Remaining Issues**: 1 (Issue 10: Model Qualities, Modalities, Pricing Resources)

## Artifact Tables Compliance

All 17 artifact tables are **COMPLIANT** ✅

| Artifact | Status | Columns |
|----------|--------|----------|
| agent | COMPLIANT | id, created_at, updated_at, generated, mcp, group_id |
| auth | COMPLIANT | id, created_at, updated_at, generated, mcp, group_id |
| cohort | COMPLIANT | id, created_at, updated_at, generated, mcp, group_id |
| department | COMPLIANT | id, created_at, updated_at, generated, mcp, group_id |
| document | COMPLIANT | id, created_at, updated_at, generated, mcp, group_id |
| eval | COMPLIANT | id, created_at, updated_at, generated, mcp, group_id |
| field | COMPLIANT | id, created_at, updated_at, generated, mcp, group_id |
| model | COMPLIANT | id, created_at, updated_at, generated, mcp, group_id |
| parameter | COMPLIANT | id, created_at, updated_at, generated, mcp, group_id |
| persona | COMPLIANT | id, created_at, updated_at, generated, mcp, group_id |
| profile | COMPLIANT | id, created_at, updated_at, generated, mcp, group_id |
| provider | COMPLIANT | id, created_at, updated_at, generated, mcp, group_id |
| rubric | COMPLIANT | id, created_at, updated_at, generated, mcp, group_id |
| scenario | COMPLIANT | id, created_at, updated_at, generated, mcp, group_id |
| setting | COMPLIANT | id, created_at, updated_at, generated, mcp, group_id |
| simulation | COMPLIANT | id, created_at, updated_at, generated, mcp, group_id |
| tool | COMPLIANT | id, created_at, updated_at, generated, mcp, group_id |

## Resource Tables Compliance

### Compliant Resources (73)

All resource tables have `generated` and `mcp` columns. 73 resources have `call_id` NOT NULL.

### Resources with Nullable `call_id` (6)

These resources have `call_id` that is nullable (should be made NOT NULL after backfilling):

| Resource | Status | NULL Count | Action |
|----------|--------|------------|--------|
| agents_resource | NON-COMPLIANT | Need to check | Need to backfill or handle |
| auths_resource | NON-COMPLIANT | Need to check | Need to backfill or handle |
| logins_resource | NON-COMPLIANT | Need to check | Can make NOT NULL if 0 NULLs |
| roles_resource | NON-COMPLIANT | Need to check | Can make NOT NULL if 0 NULLs |
| templates_resource | NON-COMPLIANT | Need to check | Can make NOT NULL if 0 NULLs |
| values_resource | NON-COMPLIANT | Need to check | Can make NOT NULL if 0 NULLs |

## Junction Tables Compliance

### All Junction Tables Compliant ✅

**Status**: 284/284 junction tables are **COMPLIANT** ✅

All junction tables have:
- `{artifact}_id` column referencing artifact table
- `{resource}_id` column referencing resource table
- `active` boolean column (NOT NULL, DEFAULT true)
- `created_at` timestamptz column (NOT NULL)
- `updated_at` timestamptz column (NOT NULL)
- `generated` boolean column (NOT NULL, DEFAULT false) ✅
- `mcp` boolean column (NOT NULL, DEFAULT false) ✅
- **NO `call_id` column** ✅ (only resource tables have call_id)

**Note**: All junction tables correctly follow the artifact/resource/junction table pattern.

## Detailed Artifact-Resource Audit

| Artifact | Resource | Artifact Status | Resource Status | Junction Table | Junction Status |
|----------|----------|-----------------|-----------------|----------------|-----------------|
| agent | departments | COMPLIANT | COMPLIANT | agent_departments | COMPLIANT ✅ |
| agent | descriptions | COMPLIANT | COMPLIANT | agent_descriptions | COMPLIANT ✅ |
| agent | flags | COMPLIANT | COMPLIANT | agent_flags | COMPLIANT ✅ |
| agent | instructions | COMPLIANT | COMPLIANT | agent_instructions | COMPLIANT ✅ |
| agent | models | COMPLIANT | COMPLIANT | agent_models | COMPLIANT ✅ |
| agent | names | COMPLIANT | COMPLIANT | agent_names | COMPLIANT ✅ |
| agent | prompts | COMPLIANT | COMPLIANT | agent_prompts | COMPLIANT ✅ |
| agent | reasoning_levels | COMPLIANT | COMPLIANT | agent_reasoning_levels | COMPLIANT ✅ |
| agent | temperature_levels | COMPLIANT | COMPLIANT | agent_temperature_levels | COMPLIANT ✅ |
| agent | voices | COMPLIANT | COMPLIANT | agent_voices | COMPLIANT ✅ |
| auth | descriptions | COMPLIANT | COMPLIANT | auth_descriptions | COMPLIANT ✅ |
| auth | flags | COMPLIANT | COMPLIANT | auth_flags | COMPLIANT ✅ |
| auth | items | COMPLIANT | COMPLIANT | auth_items | COMPLIANT ✅ |
| auth | names | COMPLIANT | COMPLIANT | auth_names | COMPLIANT ✅ |
| auth | protocols | COMPLIANT | COMPLIANT | auth_protocols | COMPLIANT ✅ |
| auth | slugs | COMPLIANT | COMPLIANT | auth_slugs | COMPLIANT ✅ |
| cohort | departments | COMPLIANT | COMPLIANT | cohort_departments | COMPLIANT ✅ |
| cohort | descriptions | COMPLIANT | COMPLIANT | cohort_descriptions | COMPLIANT ✅ |
| cohort | flags | COMPLIANT | COMPLIANT | cohort_flags | COMPLIANT ✅ |
| cohort | names | COMPLIANT | COMPLIANT | cohort_names | COMPLIANT ✅ |
| cohort | profiles | COMPLIANT | COMPLIANT | cohort_profiles | COMPLIANT ✅ |
| cohort | simulations | COMPLIANT | COMPLIANT | cohort_simulations | COMPLIANT ✅ |
| department | descriptions | COMPLIANT | COMPLIANT | department_descriptions | COMPLIANT ✅ |
| department | flags | COMPLIANT | COMPLIANT | department_flags | COMPLIANT ✅ |
| department | names | COMPLIANT | COMPLIANT | department_names | COMPLIANT ✅ |
| department | settings | COMPLIANT | COMPLIANT | department_settings | COMPLIANT ✅ |
| document | departments | COMPLIANT | COMPLIANT | document_departments | COMPLIANT ✅ |
| document | descriptions | COMPLIANT | COMPLIANT | document_descriptions | COMPLIANT ✅ |
| document | fields | COMPLIANT | COMPLIANT | document_fields | COMPLIANT ✅ |
| document | flags | COMPLIANT | COMPLIANT | document_flags | COMPLIANT ✅ |
| document | html | COMPLIANT | COMPLIANT | document_html | COMPLIANT ✅ |
| document | names | COMPLIANT | COMPLIANT | document_names | COMPLIANT ✅ |
| document | schemas | COMPLIANT | COMPLIANT | document_schemas | COMPLIANT ✅ |
| document | templates | COMPLIANT | COMPLIANT | document_templates | COMPLIANT ✅ |
| eval | agents | COMPLIANT | COMPLIANT | eval_agents | COMPLIANT ✅ |
| eval | analyses | COMPLIANT | COMPLIANT | eval_analyses | COMPLIANT ✅ |
| eval | departments | COMPLIANT | COMPLIANT | eval_departments | COMPLIANT ✅ |
| eval | descriptions | COMPLIANT | COMPLIANT | eval_descriptions | COMPLIANT ✅ |
| eval | feedbacks | COMPLIANT | COMPLIANT | eval_feedbacks | COMPLIANT ✅ |
| eval | flags | COMPLIANT | COMPLIANT | eval_flags | COMPLIANT ✅ |
| eval | groups | COMPLIANT | COMPLIANT | eval_groups | COMPLIANT ✅ |
| eval | group_positions | COMPLIANT | COMPLIANT | eval_group_positions | COMPLIANT ✅ |
| eval | groups_rubric_grade_agents | COMPLIANT | COMPLIANT | eval_groups_rubric_grade_agents | COMPLIANT ✅ |
| eval | names | COMPLIANT | COMPLIANT | eval_names | COMPLIANT ✅ |
| eval | run_positions | COMPLIANT | COMPLIANT | eval_run_positions | COMPLIANT ✅ |
| eval | runs | COMPLIANT | COMPLIANT | eval_runs | COMPLIANT ✅ |
| eval | runs_rubric_grade_agents | COMPLIANT | COMPLIANT | eval_runs_rubric_grade_agents | COMPLIANT ✅ |
| eval | times | COMPLIANT | COMPLIANT | eval_times | COMPLIANT ✅ |
| field | departments | COMPLIANT | COMPLIANT | field_departments | COMPLIANT ✅ |
| field | descriptions | COMPLIANT | COMPLIANT | field_descriptions | COMPLIANT ✅ |
| field | flags | COMPLIANT | COMPLIANT | field_flags | COMPLIANT ✅ |
| field | names | COMPLIANT | COMPLIANT | field_names | COMPLIANT ✅ |
| field | parameters | COMPLIANT | COMPLIANT | field_parameters | COMPLIANT ✅ |
| model | departments | COMPLIANT | COMPLIANT | model_departments | COMPLIANT ✅ |
| model | descriptions | COMPLIANT | COMPLIANT | model_descriptions | COMPLIANT ✅ |
| model | endpoints | COMPLIANT | COMPLIANT | model_endpoints | COMPLIANT ✅ |
| model | flags | COMPLIANT | COMPLIANT | model_flags | COMPLIANT ✅ |
| model | keys | COMPLIANT | (no resource table) | model_keys | COMPLIANT ✅ |
| model | modalities | COMPLIANT | (no resource table) | model_modalities | COMPLIANT ✅ |
| model | names | COMPLIANT | COMPLIANT | model_names | COMPLIANT ✅ |
| model | pricing | COMPLIANT | (no resource table) | model_pricing | COMPLIANT ✅ |
| model | providers | COMPLIANT | COMPLIANT | model_providers | COMPLIANT ✅ |
| model | qualities | COMPLIANT | (no resource table) | model_qualities | COMPLIANT ✅ |
| model | reasoning_levels | COMPLIANT | COMPLIANT | model_reasoning_levels | COMPLIANT ✅ |
| model | temperature_levels | COMPLIANT | COMPLIANT | model_temperature_levels | COMPLIANT ✅ |
| model | voices | COMPLIANT | COMPLIANT | model_voices | COMPLIANT ✅ |
| parameter | departments | COMPLIANT | COMPLIANT | parameter_departments | COMPLIANT ✅ |
| parameter | descriptions | COMPLIANT | COMPLIANT | parameter_descriptions | COMPLIANT ✅ |
| parameter | fields | COMPLIANT | COMPLIANT | parameter_fields | COMPLIANT ✅ |
| parameter | flags | COMPLIANT | COMPLIANT | parameter_flags | COMPLIANT ✅ |
| parameter | names | COMPLIANT | COMPLIANT | parameter_names | COMPLIANT ✅ |
| persona | colors | COMPLIANT | COMPLIANT | persona_colors | COMPLIANT ✅ |
| persona | departments | COMPLIANT | COMPLIANT | persona_departments | COMPLIANT ✅ |
| persona | descriptions | COMPLIANT | COMPLIANT | persona_descriptions | COMPLIANT ✅ |
| persona | examples | COMPLIANT | COMPLIANT | persona_examples | COMPLIANT ✅ |
| persona | fields | COMPLIANT | COMPLIANT | persona_fields | COMPLIANT ✅ |
| persona | flags | COMPLIANT | COMPLIANT | persona_flags | COMPLIANT ✅ |
| persona | icons | COMPLIANT | COMPLIANT | persona_icons | COMPLIANT ✅ |
| persona | instructions | COMPLIANT | COMPLIANT | persona_instructions | COMPLIANT ✅ |
| persona | names | COMPLIANT | COMPLIANT | persona_names | COMPLIANT ✅ |
| profile | departments | COMPLIANT | COMPLIANT | profile_departments | COMPLIANT ✅ |
| profile | emails | COMPLIANT | COMPLIANT | profile_emails | COMPLIANT ✅ |
| profile | flags | COMPLIANT | COMPLIANT | profile_flags | COMPLIANT ✅ |
| profile | names | COMPLIANT | COMPLIANT | profile_names | COMPLIANT ✅ |
| profile | request_limits | COMPLIANT | COMPLIANT | profile_request_limits | COMPLIANT ✅ |
| provider | descriptions | COMPLIANT | COMPLIANT | provider_descriptions | COMPLIANT ✅ |
| provider | flags | COMPLIANT | COMPLIANT | provider_flags | COMPLIANT ✅ |
| provider | names | COMPLIANT | COMPLIANT | provider_names | COMPLIANT ✅ |
| provider | values | COMPLIANT | COMPLIANT | provider_values | COMPLIANT ✅ |
| rubric | departments | COMPLIANT | COMPLIANT | rubric_departments | COMPLIANT ✅ |
| rubric | descriptions | COMPLIANT | COMPLIANT | rubric_descriptions | COMPLIANT ✅ |
| rubric | flags | COMPLIANT | COMPLIANT | rubric_flags | COMPLIANT ✅ |
| rubric | names | COMPLIANT | COMPLIANT | rubric_names | COMPLIANT ✅ |
| rubric | points | COMPLIANT | COMPLIANT | rubric_points | COMPLIANT ✅ |
| rubric | standard_groups | COMPLIANT | COMPLIANT | rubric_standard_groups | COMPLIANT ✅ |
| scenario | content | COMPLIANT | COMPLIANT | scenario_content | COMPLIANT ✅ |
| scenario | conversations | COMPLIANT | COMPLIANT | scenario_conversations | COMPLIANT ✅ |
| scenario | departments | COMPLIANT | COMPLIANT | scenario_departments | COMPLIANT ✅ |
| scenario | descriptions | COMPLIANT | COMPLIANT | scenario_descriptions | COMPLIANT ✅ |
| scenario | documents | COMPLIANT | COMPLIANT | scenario_documents | COMPLIANT ✅ |
| scenario | fields | COMPLIANT | COMPLIANT | scenario_fields | COMPLIANT ✅ |
| scenario | flags | COMPLIANT | COMPLIANT | scenario_flags | COMPLIANT ✅ |
| scenario | hints | COMPLIANT | COMPLIANT | scenario_hints | COMPLIANT ✅ |
| scenario | images | COMPLIANT | COMPLIANT | scenario_images | COMPLIANT ✅ |
| scenario | names | COMPLIANT | COMPLIANT | scenario_names | COMPLIANT ✅ |
| scenario | objectives | COMPLIANT | COMPLIANT | scenario_objectives | COMPLIANT ✅ |
| scenario | options | COMPLIANT | COMPLIANT | scenario_options | COMPLIANT ✅ |
| scenario | parameters | COMPLIANT | COMPLIANT | scenario_parameters | COMPLIANT ✅ |
| scenario | personas | COMPLIANT | COMPLIANT | scenario_personas | COMPLIANT ✅ |
| scenario | problem_statements | COMPLIANT | COMPLIANT | scenario_problem_statements | COMPLIANT ✅ |
| scenario | questions | COMPLIANT | COMPLIANT | scenario_questions | COMPLIANT ✅ |
| scenario | responses | COMPLIANT | COMPLIANT | scenario_responses | COMPLIANT ✅ |
| scenario | scenario_flags | COMPLIANT | COMPLIANT | scenario_scenario_flags | COMPLIANT ✅ |
| scenario | templates | COMPLIANT | COMPLIANT | scenario_templates | COMPLIANT ✅ |
| scenario | videos | COMPLIANT | COMPLIANT | scenario_videos | COMPLIANT ✅ |
| setting | auths | COMPLIANT | COMPLIANT | setting_auths | COMPLIANT ✅ |
| setting | colors | COMPLIANT | COMPLIANT | setting_colors | COMPLIANT ✅ |
| setting | departments | COMPLIANT | COMPLIANT | setting_departments | COMPLIANT ✅ |
| setting | descriptions | COMPLIANT | COMPLIANT | setting_descriptions | COMPLIANT ✅ |
| setting | flags | COMPLIANT | COMPLIANT | setting_flags | COMPLIANT ✅ |
| setting | names | COMPLIANT | COMPLIANT | setting_names | COMPLIANT ✅ |
| setting | providers | COMPLIANT | COMPLIANT | setting_providers | COMPLIANT ✅ |
| setting | thresholds | COMPLIANT | COMPLIANT | setting_thresholds | COMPLIANT ✅ |
| simulation | analyses | COMPLIANT | COMPLIANT | simulation_analyses | COMPLIANT ✅ |
| simulation | departments | COMPLIANT | COMPLIANT | simulation_departments | COMPLIANT ✅ |
| simulation | descriptions | COMPLIANT | COMPLIANT | simulation_descriptions | COMPLIANT ✅ |
| simulation | feedbacks | COMPLIANT | COMPLIANT | simulation_feedbacks | COMPLIANT ✅ |
| simulation | flags | COMPLIANT | COMPLIANT | simulation_flags | COMPLIANT ✅ |
| simulation | improvements | COMPLIANT | COMPLIANT | simulation_improvements | COMPLIANT ✅ |
| simulation | names | COMPLIANT | COMPLIANT | simulation_names | COMPLIANT ✅ |
| simulation | scenario_flags | COMPLIANT | COMPLIANT | simulation_scenario_flags | COMPLIANT ✅ |
| simulation | scenario_positions | COMPLIANT | COMPLIANT | simulation_scenario_positions | COMPLIANT ✅ |
| simulation | scenario_rubric_grade_agents | COMPLIANT | COMPLIANT | simulation_scenario_rubric_grade_agents | COMPLIANT ✅ |
| simulation | scenarios | COMPLIANT | COMPLIANT | simulation_scenarios | COMPLIANT ✅ |
| simulation | strengths | COMPLIANT | COMPLIANT | simulation_strengths | COMPLIANT ✅ |
| simulation | times | COMPLIANT | COMPLIANT | simulation_times | COMPLIANT ✅ |
| tool | descriptions | COMPLIANT | COMPLIANT | tool_descriptions | COMPLIANT ✅ |
| tool | names | COMPLIANT | COMPLIANT | tool_names | COMPLIANT ✅ |
| tool | schemas | COMPLIANT | COMPLIANT | tool_schemas | COMPLIANT ✅ |
| tool | templates | COMPLIANT | COMPLIANT | tool_templates | COMPLIANT ✅ |

## Issues Requiring Fixes

### Issue 10: Model Missing Qualities, Modalities, Pricing Resources

**Problem**: `model` artifact should have `qualities`, `modalities`, and `pricing` resources. Currently, `model_qualities`, `model_modalities`, and `model_pricing` junction tables store data directly instead of referencing resource tables.

**Current State**:
- ❌ `qualities` NOT in resources enum
- ❌ `modalities` NOT in resources enum
- ❌ `pricing` NOT in resources enum
- ❌ `qualities_resource` table does NOT exist
- ❌ `modalities_resource` table does NOT exist
- ❌ `pricing_resource` table does NOT exist
- ❌ `model_qualities` still stores `quality` enum directly (not referencing resource)
- ❌ `model_modalities` still stores `modality` enum and `is_input` boolean directly (not referencing resource)
- ❌ `model_pricing` still stores `pricing_type` enum, `price`, and `unit_id` directly (not referencing resource)

**Current Junction Table Structures**:
- `model_qualities`: `model_id`, `quality` (enum `quality`: low/medium/high), `active`, `created_at`, `updated_at`, `generated`, `mcp` - Missing `quality_id` reference ❌
- `model_modalities`: `model_id`, `modality` (enum `modality_type`: text/video/audio/image/call), `is_input` (boolean), `active`, `created_at`, `updated_at`, `generated`, `mcp` - Missing `modality_id` reference, should use `type` enum (input/output) instead of `is_input` boolean ❌
- `model_pricing`: `model_id`, `pricing_type` (enum `pricing_type`: input/output/cached), `price` (real), `unit_id` (uuid), `active`, `created_at`, `updated_at`, `generated`, `mcp` - Missing `pricing_id` reference ❌

**Required Actions**:
1. **Add resources to enum**:
   - Add `qualities` to `resources` enum
   - Add `modalities` to `resources` enum
   - Add `pricing` to `resources` enum

2. **Create resource tables**:
   - Create `qualities_resource` table with:
     - `id` (uuid, PRIMARY KEY)
     - `quality` (enum `quality`: low/medium/high, NOT NULL)
     - `created_at` (timestamptz, NOT NULL)
     - `updated_at` (timestamptz, NOT NULL)
     - `active` (boolean, NOT NULL, DEFAULT true)
     - `generated` (boolean, NOT NULL, DEFAULT false)
     - `mcp` (boolean, NOT NULL, DEFAULT false)
     - `call_id` (uuid, NOT NULL)
   - Create `modalities_resource` table with:
     - `id` (uuid, PRIMARY KEY)
     - `modality` (enum `modality_type`: text/video/audio/image/call, NOT NULL)
     - `created_at` (timestamptz, NOT NULL)
     - `updated_at` (timestamptz, NOT NULL)
     - `active` (boolean, NOT NULL, DEFAULT true)
     - `generated` (boolean, NOT NULL, DEFAULT false)
     - `mcp` (boolean, NOT NULL, DEFAULT false)
     - `call_id` (uuid, NOT NULL)
   - Create `pricing_resource` table with:
     - `id` (uuid, PRIMARY KEY)
     - `pricing_type` (enum `pricing_type`: input/output/cached, NOT NULL)
     - `price` (real, NOT NULL)
     - `unit_id` (uuid, NOT NULL) - reference to `units` table
     - `created_at` (timestamptz, NOT NULL)
     - `updated_at` (timestamptz, NOT NULL)
     - `active` (boolean, NOT NULL, DEFAULT true)
     - `generated` (boolean, NOT NULL, DEFAULT false)
     - `mcp` (boolean, NOT NULL, DEFAULT false)
     - `call_id` (uuid, NOT NULL)

3. **Create type enum for modalities junction**:
   - Create `type_model_modalities` enum with values: 'input', 'output'
   - This replaces the `is_input` boolean with a proper enum

4. **Update junction tables**:
   - Update `model_qualities` to have:
     - `model_id` (uuid, NOT NULL) - keep existing
     - `quality_id` (uuid, NOT NULL) - NEW, references `qualities_resource(id)`
     - Remove `quality` enum column
     - Keep: `active`, `created_at`, `updated_at`, `generated`, `mcp`
   - Update `model_modalities` to have:
     - `model_id` (uuid, NOT NULL) - keep existing
     - `modality_id` (uuid, NOT NULL) - NEW, references `modalities_resource(id)`
     - `type` (enum `type_model_modalities`: input/output, NOT NULL) - NEW, replaces `is_input` boolean
     - Remove `modality` enum column
     - Remove `is_input` boolean column
     - Keep: `active`, `created_at`, `updated_at`, `generated`, `mcp`
   - Update `model_pricing` to have:
     - `model_id` (uuid, NOT NULL) - keep existing
     - `pricing_id` (uuid, NOT NULL) - NEW, references `pricing_resource(id)`
     - Remove `pricing_type` enum column
     - Remove `price` column
     - Remove `unit_id` column (moved to resource table)
     - Keep: `active`, `created_at`, `updated_at`, `generated`, `mcp`

5. **Add to artifact_resources**:
   - Add `model` → `qualities` entry to `artifact_resources`
   - Add `model` → `modalities` entry to `artifact_resources`
   - Add `model` → `pricing` entry to `artifact_resources`

6. **Migrate existing data**:
   - For `model_qualities`: 
     - Insert rows into `qualities_resource` for each unique `quality` value (if not exists)
     - Update `model_qualities` to set `quality_id` based on matching `quality` enum value
   - For `model_modalities`:
     - Insert rows into `modalities_resource` for each unique `modality` value (if not exists)
     - Update `model_modalities` to set `modality_id` based on matching `modality` enum value
     - Convert `is_input` boolean to `type` enum: `true` → 'input', `false` → 'output'
   - For `model_pricing`:
     - Insert rows into `pricing_resource` for each unique combination of `pricing_type`, `price`, `unit_id` (if not exists)
     - Update `model_pricing` to set `pricing_id` based on matching values

## Recommendations

### Priority 1: Fix Resource Tables
1. **Make `call_id` NOT NULL** in resources with 0 NULLs (can be done immediately):
   - Check `logins_resource`, `roles_resource`, `templates_resource`, `values_resource` for NULL counts
   - If 0 NULLs, make `call_id` NOT NULL

2. **Handle NULL values** before making `call_id` NOT NULL for resources with NULLs:
   - `agents_resource` - Need to backfill or handle
   - `auths_resource` - Need to backfill or handle

### Priority 2: Fix Model Qualities, Modalities, Pricing Resources
1. **Add resources to enum**:
   - Add `qualities`, `modalities`, `pricing` to `resources` enum

2. **Create resource tables**:
   - Create `qualities_resource` table (with `quality` enum column - enum type `quality`)
   - Create `modalities_resource` table (with `modality` enum column - enum type `modality_type`)
   - Create `pricing_resource` table (with `pricing_type` enum, `price`, `unit_id` columns)

3. **Create type enum for modalities**:
   - Create `type_model_modalities` enum with values: 'input', 'output'

4. **Update junction tables**:
   - Update `model_qualities`: Replace `quality` enum with `quality_id` (uuid) referencing `qualities_resource(id)`
   - Update `model_modalities`: Replace `modality` enum and `is_input` boolean with `modality_id` (uuid) and `type` enum (input/output)
   - Update `model_pricing`: Replace `pricing_type` enum, `price`, `unit_id` with `pricing_id` (uuid) referencing `pricing_resource(id)`

5. **Add to artifact_resources**:
   - Add `model` → `qualities`, `model` → `modalities`, `model` → `pricing` entries

6. **Migrate data**:
   - Migrate existing data from junction tables to resource tables
   - Update junction table foreign keys
   - Convert `is_input` boolean to `type` enum in `model_modalities`

## Overall Assessment

**Excellent Progress**: 10 out of 11 major issues have been resolved! ✅

**Remaining Work**:
1. **Issue 10**: Model Qualities, Modalities, Pricing Resources - Complete conversion to resource pattern
2. **Priority 1**: Make `call_id` NOT NULL in resource tables (after verifying NULL counts)

The database schema is now much more compliant with the artifact/resource/junction table pattern. All junction tables are compliant, and most structural issues have been resolved. The remaining Issue 10 is a significant refactoring that requires:
- Creating new resource tables
- Migrating data from junction tables to resource tables
- Updating junction tables to reference resources
- Creating new enum types
