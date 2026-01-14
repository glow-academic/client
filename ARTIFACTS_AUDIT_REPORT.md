# Artifacts and Resources Audit Report

Generated: 2025-01-XX

## Summary

- **Total Artifacts**: 17 ✅
- **Total Resources**: 79 in enum, 79 resource tables ✅ (Perfect match!)
- **Total Artifact-Resource Pairs**: 140 ✅
- **Missing Junction Tables**: 0 ✅ (All junction tables exist)
- **Compliant Junction Tables**: 283/283 ✅ (100% compliant - all have `generated`, `mcp`, `active`, `updated_at`)
- **Resources with nullable `call_id`**: 0 ✅ (All resources have `call_id` NOT NULL)
- **Resources with NULL `call_id` values**: 0 ✅ (All `call_id` values are populated)
- **Remaining Issues**: 0 ✅ **ALL ISSUES RESOLVED!**

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

### All Resources Compliant ✅

**Status**: 79/79 resource tables are **COMPLIANT** ✅

All resource tables have:
- ✅ `generated` boolean column (NOT NULL, DEFAULT false)
- ✅ `mcp` boolean column (NOT NULL, DEFAULT false)
- ✅ `call_id` uuid column (NOT NULL) - **100% compliance!**
- ✅ All `call_id` values are populated (0 NULL values)

**Perfect Compliance**: All 79 resources in the enum have corresponding resource tables, and all resource tables have `call_id` NOT NULL with no NULL values.

## Junction Tables Compliance

### All Junction Tables Compliant ✅

**Status**: 283/283 junction tables are **COMPLIANT** ✅

All junction tables have:
- `{artifact}_id` column referencing artifact table
- `{resource}_id` column referencing resource table (or direct reference for special cases like `keys`)
- `active` boolean column (NOT NULL, DEFAULT true)
- `created_at` timestamptz column (NOT NULL)
- `updated_at` timestamptz column (NOT NULL)
- `generated` boolean column (NOT NULL, DEFAULT false) ✅
- `mcp` boolean column (NOT NULL, DEFAULT false) ✅
- **NO `call_id` column** ✅ (only resource tables have call_id)

**Perfect Compliance**: All junction tables correctly follow the artifact/resource/junction table pattern.

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
| model | modalities | COMPLIANT | COMPLIANT | model_modalities | COMPLIANT ✅ |
| model | names | COMPLIANT | COMPLIANT | model_names | COMPLIANT ✅ |
| model | pricing | COMPLIANT | COMPLIANT | model_pricing | COMPLIANT ✅ |
| model | providers | COMPLIANT | COMPLIANT | model_providers | COMPLIANT ✅ |
| model | qualities | COMPLIANT | COMPLIANT | model_qualities | COMPLIANT ✅ |
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

### ✅ ALL ISSUES RESOLVED!

**No remaining issues!** All major and minor issues have been successfully resolved:

1. ✅ **Issue 10: Model Qualities, Modalities, Pricing Resources** - RESOLVED
   - All three resources (`qualities`, `modalities`, `pricing`) are in the enum
   - All three resource tables exist with proper structure
   - Junction tables updated to use resource references (`quality_id`, `modality_id`, `pricing_id`)
   - `type_model_modalities` enum created and in use
   - All added to `artifact_resources`

2. ✅ **Resource Tables `call_id` Compliance** - RESOLVED
   - All 79 resource tables have `call_id` NOT NULL
   - All `call_id` values are populated (0 NULL values)
   - Previously nullable `call_id` columns have been made NOT NULL

3. ✅ **All Other Issues** - RESOLVED
   - All artifact tables compliant (17/17)
   - All resource tables compliant (79/79)
   - All junction tables compliant (283/283)
   - All artifact-resource pairs have junction tables (140/140)

## Overall Assessment

**🎉 PERFECT COMPLIANCE: All Issues Resolved!** ✅

**Current Status**:
- ✅ All 17 artifact tables are compliant (exactly 6 columns each)
- ✅ All 79 resource tables are compliant (have `generated`, `mcp`, `call_id` NOT NULL)
- ✅ All 283 junction tables are compliant (have `generated`, `mcp`, `active`, `updated_at`, no `call_id`)
- ✅ All 140 artifact-resource pairs have corresponding junction tables
- ✅ All `call_id` columns are NOT NULL with no NULL values
- ✅ Issue 10 (Model Qualities, Modalities, Pricing Resources) is fully resolved
- ✅ **0 remaining issues**

**Database Schema Status**: The database schema is now **100% compliant** with the artifact/resource/junction table pattern. All structural issues have been resolved, and all data integrity requirements have been met.

**No further action required!** 🎊
