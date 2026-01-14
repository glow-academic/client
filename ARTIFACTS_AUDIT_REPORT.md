# Artifacts and Resources Audit Report

Generated: $(date)

## Summary

- **Total Artifacts**: 17
- **Total Resources**: 69
- **Total Artifact-Resource Pairs**: 122
- **Missing Junction Tables**: 0 ✅ (All junction tables exist)
- **Junction Tables with call_id**: 1 (non-standard table: `contents`)

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

### Compliant Resources (60)

| Resource | Status | call_id Status |
|----------|--------|----------------|
| analyses | COMPLIANT | NOT NULL ✓ |
| audios | COMPLIANT | NOT NULL ✓ |
| colors | COMPLIANT | NOT NULL ✓ |
| cohorts | COMPLIANT | NOT NULL ✓ |
| conditional_parameters | COMPLIANT | NOT NULL ✓ |
| conversations | COMPLIANT | NOT NULL ✓ |
| debug_info | COMPLIANT | NOT NULL ✓ |
| departments | COMPLIANT | NOT NULL ✓ |
| documents | COMPLIANT | NOT NULL ✓ |
| emails | COMPLIANT | NOT NULL ✓ |
| endpoints | COMPLIANT | NOT NULL ✓ |
| evals | COMPLIANT | NOT NULL ✓ |
| examples | COMPLIANT | NOT NULL ✓ |
| feedbacks | COMPLIANT | NOT NULL ✓ |
| fields | COMPLIANT | NOT NULL ✓ |
| flags | COMPLIANT | NOT NULL ✓ |
| hints | COMPLIANT | NOT NULL ✓ |
| html | COMPLIANT | NOT NULL ✓ |
| icons | COMPLIANT | NOT NULL ✓ |
| images | COMPLIANT | NOT NULL ✓ |
| improvements | COMPLIANT | NOT NULL ✓ |
| instructions | COMPLIANT | NOT NULL ✓ |
| items | COMPLIANT | NOT NULL ✓ |
| models | COMPLIANT | NOT NULL ✓ |
| objectives | COMPLIANT | NOT NULL ✓ |
| options | COMPLIANT | NOT NULL ✓ |
| parameters | COMPLIANT | NOT NULL ✓ |
| personas | COMPLIANT | NOT NULL ✓ |
| points | COMPLIANT | NOT NULL ✓ |
| problem_statements | COMPLIANT | NOT NULL ✓ |
| profiles | COMPLIANT | NOT NULL ✓ |
| prompts | COMPLIANT | NOT NULL ✓ |
| protocols | COMPLIANT | NOT NULL ✓ |
| providers | COMPLIANT | NOT NULL ✓ |
| questions | COMPLIANT | NOT NULL ✓ |
| reasoning_levels | COMPLIANT | NOT NULL ✓ |
| request_limits | COMPLIANT | NOT NULL ✓ |
| responses | COMPLIANT | NOT NULL ✓ |
| rubrics | COMPLIANT | NOT NULL ✓ |
| scenario_positions | COMPLIANT | NOT NULL ✓ |
| scenarios | COMPLIANT | NOT NULL ✓ |
| schema_field_items | COMPLIANT | NOT NULL ✓ |
| schema_fields | COMPLIANT | NOT NULL ✓ |
| schemas | COMPLIANT | NOT NULL ✓ |
| settings | COMPLIANT | NOT NULL ✓ |
| simulations | COMPLIANT | NOT NULL ✓ |
| slugs | COMPLIANT | NOT NULL ✓ |
| standard_groups | COMPLIANT | NOT NULL ✓ |
| strengths | COMPLIANT | NOT NULL ✓ |
| temperature_levels | COMPLIANT | NOT NULL ✓ |
| template_array_items | COMPLIANT | NOT NULL ✓ |
| template_values | COMPLIANT | NOT NULL ✓ |
| texts | COMPLIANT | NOT NULL ✓ |
| thresholds | COMPLIANT | NOT NULL ✓ |
| times | COMPLIANT | NOT NULL ✓ |
| tools | COMPLIANT | NOT NULL ✓ |
| videos | COMPLIANT | NOT NULL ✓ |
| voices | COMPLIANT | NOT NULL ✓ |

### Non-Compliant Resources (9)

**Resources with nullable call_id (need to handle NULLs first) - 8 resources:**
| Resource | Status | NULL Count | Action |
|----------|--------|------------|--------|
| agents | NON-COMPLIANT | 1 NULL | Need to backfill or handle |
| auths | NON-COMPLIANT | 2 NULLs | Need to backfill or handle |
| descriptions | NON-COMPLIANT | 0 NULLs | Can make NOT NULL ✓ |
| logins | NON-COMPLIANT | 292 NULLs | Need to backfill or handle |
| names | NON-COMPLIANT | 0 NULLs | Can make NOT NULL ✓ |
| roles | NON-COMPLIANT | 5 NULLs | Need to backfill or handle |
| templates | NON-COMPLIANT | 46,719 NULLs | Need to backfill or handle |
| values | NON-COMPLIANT | 25 NULLs | Need to backfill or handle |

**Resources missing columns - 3 resources:**
| Resource | Status | Missing Columns |
|----------|--------|-----------------|
| eval_rubric_grade_agents | NON-COMPLIANT | Missing mcp column |
| scenario_rubric_grade_agents | NON-COMPLIANT | Missing mcp column |
| simulation_scenario_flags | NON-COMPLIANT | Missing mcp column |

## Junction Tables Compliance

### Compliant Junction Tables (4) ✅

| Artifact | Resource | Junction Table | Status |
|----------|----------|----------------|--------|
| department | settings | department_settings | COMPLIANT ✅ |
| document | html | document_html | COMPLIANT ✅ |
| model | providers | model_providers | COMPLIANT ✅ |
| tool | tools | tool_tools | COMPLIANT ✅ |

**Note**: These junction tables are compliant because they have all required columns (`{artifact}_id`, `{resource}_id`, `active`, `created_at`, `updated_at`, `generated`, `mcp`) and do NOT have `call_id`.

### Non-Compliant Junction Tables (118)

All 118 non-compliant junction tables are missing `generated` and/or `mcp` columns.

**Common Issues**:
1. Missing `generated` column
2. Missing `mcp` column  
3. All junction tables correctly do NOT have `call_id` (except `contents` table which is not a standard artifact-resource junction)

### Missing Junction Tables (0) ✅

All artifact-resource pairs have corresponding junction tables.

## Detailed Artifact-Resource Audit

| Artifact | Resource | Artifact Status | Resource Status | Junction Table | Junction Status |
|----------|----------|-----------------|-----------------|----------------|-----------------|
| agent | departments | COMPLIANT | COMPLIANT | agent_departments | NON-COMPLIANT: Missing generated/mcp |
| agent | descriptions | COMPLIANT | NON-COMPLIANT: call_id nullable | agent_descriptions | NON-COMPLIANT: Missing generated/mcp |
| agent | flags | COMPLIANT | COMPLIANT | agent_flags | NON-COMPLIANT: Missing generated/mcp |
| agent | instructions | COMPLIANT | COMPLIANT | agent_instructions | NON-COMPLIANT: Missing generated/mcp |
| agent | models | COMPLIANT | COMPLIANT | agent_models | NON-COMPLIANT: Missing generated/mcp |
| agent | names | COMPLIANT | NON-COMPLIANT: call_id nullable | agent_names | NON-COMPLIANT: Missing generated/mcp |
| agent | prompts | COMPLIANT | COMPLIANT | agent_prompts | NON-COMPLIANT: Missing generated/mcp |
| auth | descriptions | COMPLIANT | NON-COMPLIANT: call_id nullable | auth_descriptions | NON-COMPLIANT: Missing generated/mcp |
| auth | flags | COMPLIANT | COMPLIANT | auth_flags | NON-COMPLIANT: Missing generated/mcp |
| auth | items | COMPLIANT | COMPLIANT | auth_items | NON-COMPLIANT: Missing generated/mcp |
| auth | names | COMPLIANT | NON-COMPLIANT: call_id nullable | auth_names | NON-COMPLIANT: Missing generated/mcp |
| auth | protocols | COMPLIANT | COMPLIANT | auth_protocols | NON-COMPLIANT: Missing generated/mcp |
| auth | slugs | COMPLIANT | COMPLIANT | auth_slugs | NON-COMPLIANT: Missing generated/mcp |
| cohort | departments | COMPLIANT | COMPLIANT | cohort_departments | NON-COMPLIANT: Missing generated/mcp |
| cohort | descriptions | COMPLIANT | NON-COMPLIANT: call_id nullable | cohort_descriptions | NON-COMPLIANT: Missing generated/mcp |
| cohort | flags | COMPLIANT | COMPLIANT | cohort_flags | NON-COMPLIANT: Missing generated/mcp |
| cohort | names | COMPLIANT | NON-COMPLIANT: call_id nullable | cohort_names | NON-COMPLIANT: Missing generated/mcp |
| cohort | profiles | COMPLIANT | COMPLIANT | cohort_profiles | NON-COMPLIANT: Missing generated/mcp |
| cohort | simulations | COMPLIANT | COMPLIANT | cohort_simulations | NON-COMPLIANT: Missing generated/mcp |
| department | descriptions | COMPLIANT | NON-COMPLIANT: call_id nullable | department_descriptions | NON-COMPLIANT: Missing generated/mcp |
| department | flags | COMPLIANT | COMPLIANT | department_flags | NON-COMPLIANT: Missing generated/mcp |
| department | names | COMPLIANT | NON-COMPLIANT: call_id nullable | department_names | NON-COMPLIANT: Missing generated/mcp |
| department | settings | COMPLIANT | COMPLIANT | department_settings | **COMPLIANT** ✅ |
| document | departments | COMPLIANT | COMPLIANT | document_departments | NON-COMPLIANT: Missing generated/mcp |
| document | descriptions | COMPLIANT | NON-COMPLIANT: call_id nullable | document_descriptions | NON-COMPLIANT: Missing generated/mcp |
| document | fields | COMPLIANT | COMPLIANT | document_fields | NON-COMPLIANT: Missing generated/mcp |
| document | flags | COMPLIANT | COMPLIANT | document_flags | NON-COMPLIANT: Missing generated/mcp |
| document | html | COMPLIANT | COMPLIANT | document_html | **COMPLIANT** ✅ |
| document | names | COMPLIANT | NON-COMPLIANT: call_id nullable | document_names | NON-COMPLIANT: Missing generated/mcp |
| document | schemas | COMPLIANT | COMPLIANT | document_schemas | NON-COMPLIANT: Missing generated/mcp |
| document | templates | COMPLIANT | NON-COMPLIANT: call_id nullable | document_templates | NON-COMPLIANT: Missing generated/mcp |
| eval | agents | COMPLIANT | COMPLIANT | eval_agents | NON-COMPLIANT: Missing generated/mcp |
| eval | departments | COMPLIANT | COMPLIANT | eval_departments | NON-COMPLIANT: Missing generated/mcp |
| eval | descriptions | COMPLIANT | NON-COMPLIANT: call_id nullable | eval_descriptions | NON-COMPLIANT: Missing generated/mcp |
| eval | eval_rubric_grade_agents | COMPLIANT | NON-COMPLIANT: Missing mcp | eval_eval_rubric_grade_agents | NON-COMPLIANT: Missing generated/mcp |
| eval | flags | COMPLIANT | COMPLIANT | eval_flags | NON-COMPLIANT: Missing generated/mcp |
| eval | names | COMPLIANT | NON-COMPLIANT: call_id nullable | eval_names | NON-COMPLIANT: Missing generated/mcp |
| field | conditional_parameters | COMPLIANT | COMPLIANT | field_conditional_parameters | NON-COMPLIANT: Missing generated/mcp |
| field | departments | COMPLIANT | COMPLIANT | field_departments | NON-COMPLIANT: Missing generated/mcp |
| field | descriptions | COMPLIANT | NON-COMPLIANT: call_id nullable | field_descriptions | NON-COMPLIANT: Missing generated/mcp |
| field | flags | COMPLIANT | COMPLIANT | field_flags | NON-COMPLIANT: Missing generated/mcp |
| field | names | COMPLIANT | NON-COMPLIANT: call_id nullable | field_names | NON-COMPLIANT: Missing generated/mcp |
| model | departments | COMPLIANT | COMPLIANT | model_departments | NON-COMPLIANT: Missing generated/mcp |
| model | descriptions | COMPLIANT | NON-COMPLIANT: call_id nullable | model_descriptions | NON-COMPLIANT: Missing generated/mcp |
| model | endpoints | COMPLIANT | COMPLIANT | model_endpoints | NON-COMPLIANT: Missing generated/mcp |
| model | flags | COMPLIANT | COMPLIANT | model_flags | NON-COMPLIANT: Missing generated/mcp |
| model | keys | COMPLIANT | (no resource table) | model_keys | NON-COMPLIANT: Missing generated/mcp |
| model | names | COMPLIANT | NON-COMPLIANT: call_id nullable | model_names | NON-COMPLIANT: Missing generated/mcp |
| model | providers | COMPLIANT | COMPLIANT | model_providers | **COMPLIANT** ✅ |
| model | reasoning_levels | COMPLIANT | COMPLIANT | model_reasoning_levels | NON-COMPLIANT: Missing generated/mcp |
| model | temperature_levels | COMPLIANT | COMPLIANT | model_temperature_levels | NON-COMPLIANT: Missing generated/mcp |
| model | voices | COMPLIANT | COMPLIANT | model_voices | NON-COMPLIANT: Missing generated/mcp |
| parameter | departments | COMPLIANT | COMPLIANT | parameter_departments | NON-COMPLIANT: Missing generated/mcp |
| parameter | descriptions | COMPLIANT | NON-COMPLIANT: call_id nullable | parameter_descriptions | NON-COMPLIANT: Missing generated/mcp |
| parameter | fields | COMPLIANT | COMPLIANT | parameter_fields | NON-COMPLIANT: Missing generated/mcp |
| parameter | flags | COMPLIANT | COMPLIANT | parameter_flags | NON-COMPLIANT: Missing generated/mcp |
| parameter | names | COMPLIANT | NON-COMPLIANT: call_id nullable | parameter_names | NON-COMPLIANT: Missing generated/mcp |
| persona | colors | COMPLIANT | COMPLIANT | persona_colors | NON-COMPLIANT: Missing generated/mcp |
| persona | departments | COMPLIANT | COMPLIANT | persona_departments | NON-COMPLIANT: Missing generated/mcp |
| persona | descriptions | COMPLIANT | NON-COMPLIANT: call_id nullable | persona_descriptions | NON-COMPLIANT: Missing generated/mcp |
| persona | examples | COMPLIANT | COMPLIANT | persona_examples | NON-COMPLIANT: Missing generated/mcp |
| persona | fields | COMPLIANT | COMPLIANT | persona_fields | NON-COMPLIANT: Missing generated/mcp |
| persona | flags | COMPLIANT | COMPLIANT | persona_flags | NON-COMPLIANT: Missing generated/mcp |
| persona | icons | COMPLIANT | COMPLIANT | persona_icons | NON-COMPLIANT: Missing generated/mcp |
| persona | instructions | COMPLIANT | COMPLIANT | persona_instructions | NON-COMPLIANT: Missing generated/mcp |
| persona | names | COMPLIANT | NON-COMPLIANT: call_id nullable | persona_names | NON-COMPLIANT: Missing generated/mcp |
| profile | departments | COMPLIANT | COMPLIANT | profile_departments | NON-COMPLIANT: Missing generated/mcp |
| profile | emails | COMPLIANT | COMPLIANT | profile_emails | NON-COMPLIANT: Missing generated/mcp |
| profile | flags | COMPLIANT | COMPLIANT | profile_flags | NON-COMPLIANT: Missing generated/mcp |
| profile | names | COMPLIANT | NON-COMPLIANT: call_id nullable | profile_names | NON-COMPLIANT: Missing generated/mcp |
| profile | request_limits | COMPLIANT | COMPLIANT | profile_request_limits | NON-COMPLIANT: Missing generated/mcp |
| provider | descriptions | COMPLIANT | NON-COMPLIANT: call_id nullable | provider_descriptions | NON-COMPLIANT: Missing generated/mcp |
| provider | flags | COMPLIANT | COMPLIANT | provider_flags | NON-COMPLIANT: Missing generated/mcp |
| provider | names | COMPLIANT | NON-COMPLIANT: call_id nullable | provider_names | NON-COMPLIANT: Missing generated/mcp |
| rubric | departments | COMPLIANT | COMPLIANT | rubric_departments | NON-COMPLIANT: Missing generated/mcp |
| rubric | descriptions | COMPLIANT | NON-COMPLIANT: call_id nullable | rubric_descriptions | NON-COMPLIANT: Missing generated/mcp |
| rubric | flags | COMPLIANT | COMPLIANT | rubric_flags | NON-COMPLIANT: Missing generated/mcp |
| rubric | names | COMPLIANT | NON-COMPLIANT: call_id nullable | rubric_names | NON-COMPLIANT: Missing generated/mcp |
| rubric | points | COMPLIANT | COMPLIANT | rubric_points | NON-COMPLIANT: Missing generated/mcp |
| rubric | standard_groups | COMPLIANT | COMPLIANT | rubric_standard_groups | NON-COMPLIANT: Missing generated/mcp |
| scenario | conversations | COMPLIANT | COMPLIANT | scenario_conversations | NON-COMPLIANT: Missing generated/mcp |
| scenario | departments | COMPLIANT | COMPLIANT | scenario_departments | NON-COMPLIANT: Missing generated/mcp |
| scenario | descriptions | COMPLIANT | NON-COMPLIANT: call_id nullable | scenario_descriptions | NON-COMPLIANT: Missing generated/mcp |
| scenario | documents | COMPLIANT | COMPLIANT | scenario_documents | NON-COMPLIANT: Missing generated/mcp |
| scenario | fields | COMPLIANT | COMPLIANT | scenario_fields | NON-COMPLIANT: Missing generated/mcp |
| scenario | flags | COMPLIANT | COMPLIANT | scenario_flags | NON-COMPLIANT: Missing generated/mcp |
| scenario | hints | COMPLIANT | COMPLIANT | scenario_hints | NON-COMPLIANT: Missing generated/mcp |
| scenario | images | COMPLIANT | COMPLIANT | scenario_images | NON-COMPLIANT: Missing generated/mcp |
| scenario | names | COMPLIANT | NON-COMPLIANT: call_id nullable | scenario_names | NON-COMPLIANT: Missing generated/mcp |
| scenario | objectives | COMPLIANT | COMPLIANT | scenario_objectives | NON-COMPLIANT: Missing generated/mcp |
| scenario | options | COMPLIANT | COMPLIANT | scenario_options | NON-COMPLIANT: Missing generated/mcp |
| scenario | parameters | COMPLIANT | COMPLIANT | scenario_parameters | NON-COMPLIANT: Missing generated/mcp |
| scenario | personas | COMPLIANT | COMPLIANT | scenario_personas | NON-COMPLIANT: Missing generated/mcp |
| scenario | problem_statements | COMPLIANT | COMPLIANT | scenario_problem_statements | NON-COMPLIANT: Missing generated/mcp |
| scenario | questions | COMPLIANT | COMPLIANT | scenario_questions | NON-COMPLIANT: Missing generated/mcp |
| scenario | responses | COMPLIANT | COMPLIANT | scenario_responses | NON-COMPLIANT: Missing generated/mcp |
| scenario | templates | COMPLIANT | NON-COMPLIANT: call_id nullable | scenario_templates | NON-COMPLIANT: Missing generated/mcp |
| scenario | videos | COMPLIANT | COMPLIANT | scenario_videos | NON-COMPLIANT: Missing generated/mcp |
| setting | auths | COMPLIANT | COMPLIANT | setting_auths | NON-COMPLIANT: Missing generated/mcp |
| setting | colors | COMPLIANT | COMPLIANT | setting_colors | NON-COMPLIANT: Missing generated/mcp |
| setting | departments | COMPLIANT | COMPLIANT | setting_departments | NON-COMPLIANT: Missing generated/mcp |
| setting | descriptions | COMPLIANT | NON-COMPLIANT: call_id nullable | setting_descriptions | NON-COMPLIANT: Missing generated/mcp |
| setting | flags | COMPLIANT | COMPLIANT | setting_flags | NON-COMPLIANT: Missing generated/mcp |
| setting | names | COMPLIANT | NON-COMPLIANT: call_id nullable | setting_names | NON-COMPLIANT: Missing generated/mcp |
| setting | providers | COMPLIANT | COMPLIANT | setting_providers | NON-COMPLIANT: Missing generated/mcp |
| setting | thresholds | COMPLIANT | COMPLIANT | setting_thresholds | NON-COMPLIANT: Missing generated/mcp |
| simulation | analyses | COMPLIANT | COMPLIANT | simulation_analyses | NON-COMPLIANT: Missing generated/mcp |
| simulation | departments | COMPLIANT | COMPLIANT | simulation_departments | NON-COMPLIANT: Missing generated/mcp |
| simulation | descriptions | COMPLIANT | NON-COMPLIANT: call_id nullable | simulation_descriptions | NON-COMPLIANT: Missing generated/mcp |
| simulation | feedbacks | COMPLIANT | COMPLIANT | simulation_feedbacks | NON-COMPLIANT: Missing generated/mcp |
| simulation | flags | COMPLIANT | COMPLIANT | simulation_flags | NON-COMPLIANT: Missing generated/mcp |
| simulation | improvements | COMPLIANT | COMPLIANT | simulation_improvements | NON-COMPLIANT: Missing generated/mcp |
| simulation | names | COMPLIANT | NON-COMPLIANT: call_id nullable | simulation_names | NON-COMPLIANT: Missing generated/mcp |
| simulation | scenario_positions | COMPLIANT | COMPLIANT | simulation_scenario_positions | NON-COMPLIANT: Missing generated/mcp |
| simulation | scenario_rubric_grade_agents | COMPLIANT | NON-COMPLIANT: Missing mcp | simulation_scenario_rubric_grade_agents | NON-COMPLIANT: Missing generated/mcp |
| simulation | scenarios | COMPLIANT | COMPLIANT | simulation_scenarios | NON-COMPLIANT: Missing generated/mcp |
| simulation | simulation_scenario_flags | COMPLIANT | NON-COMPLIANT: Missing mcp | simulation_simulation_scenario_flags | NON-COMPLIANT: Missing generated/mcp |
| simulation | strengths | COMPLIANT | COMPLIANT | simulation_strengths | NON-COMPLIANT: Missing generated/mcp |
| simulation | times | COMPLIANT | COMPLIANT | simulation_times | NON-COMPLIANT: Missing generated/mcp |
| tool | schemas | COMPLIANT | COMPLIANT | tool_schemas | NON-COMPLIANT: Missing generated/mcp |
| tool | templates | COMPLIANT | NON-COMPLIANT: call_id nullable | tool_templates | NON-COMPLIANT: Missing generated/mcp |
| tool | tools | COMPLIANT | COMPLIANT | tool_tools | **COMPLIANT** ✅ |

## Recommendations

### Priority 1: Fix Resource Tables
1. **Make `call_id` NOT NULL** in resources with 0 NULLs (can be done immediately):
   - `descriptions_resource` (0 NULLs)
   - `names_resource` (0 NULLs)

2. **Handle NULL values** before making `call_id` NOT NULL for resources with NULLs:
   - `agents_resource` (1 NULL) - Need to backfill or handle
   - `auths_resource` (2 NULLs) - Need to backfill or handle
   - `logins_resource` (292 NULLs) - Need to backfill or handle
   - `roles_resource` (5 NULLs) - Need to backfill or handle
   - `templates_resource` (46,719 NULLs) - Need to backfill or handle
   - `values_resource` (25 NULLs) - Need to backfill or handle

3. **Add missing `mcp` column** to:
   - `eval_rubric_grade_agents_resource`
   - `scenario_rubric_grade_agents_resource`
   - `simulation_scenario_flags_resource`

### Priority 2: Fix Junction Tables
1. **Add missing columns** to all 118 non-compliant junction tables:
   - `generated` (boolean, NOT NULL, DEFAULT false)
   - `mcp` (boolean, NOT NULL, DEFAULT false)
   - `active` (boolean, NOT NULL, DEFAULT true) - if missing
   - `updated_at` (timestamptz, NOT NULL) - if missing

2. **Remove `call_id` column** from `contents` table if it's not needed (this appears to be a non-standard table)

### Priority 3: Verify Compliance
- All 4 compliant junction tables serve as examples of the correct structure
- Once all junction tables have `generated` and `mcp` columns added, compliance should be achieved
