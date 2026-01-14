# Artifacts and Resources Audit Report

Generated: $(date)

## Summary

- **Total Artifacts**: 17
- **Total Resources**: 69
- **Total Artifact-Resource Pairs**: 122

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

### Compliant Resources (40)

| Resource | Status | call_id Status |
|----------|--------|----------------|
| analyses | COMPLIANT | NOT NULL ✓ |
| audios | COMPLIANT | NOT NULL ✓ |
| colors | COMPLIANT | NOT NULL ✓ |
| conversations | COMPLIANT | NOT NULL ✓ |
| debug_info | COMPLIANT | NOT NULL ✓ |
| emails | COMPLIANT | NOT NULL ✓ |
| endpoints | COMPLIANT | NOT NULL ✓ |
| examples | COMPLIANT | NOT NULL ✓ |
| feedbacks | COMPLIANT | NOT NULL ✓ |
| flags | COMPLIANT | NOT NULL ✓ |
| hints | COMPLIANT | NOT NULL ✓ |
| html | COMPLIANT | NOT NULL ✓ |
| icons | COMPLIANT | NOT NULL ✓ |
| images | COMPLIANT | NOT NULL ✓ |
| improvements | COMPLIANT | NOT NULL ✓ |
| instructions | COMPLIANT | NOT NULL ✓ |
| items | COMPLIANT | NOT NULL ✓ |
| objectives | COMPLIANT | NOT NULL ✓ |
| options | COMPLIANT | NOT NULL ✓ |
| points | COMPLIANT | NOT NULL ✓ |
| problem_statements | COMPLIANT | NOT NULL ✓ |
| prompts | COMPLIANT | NOT NULL ✓ |
| protocols | COMPLIANT | NOT NULL ✓ |
| providers | COMPLIANT | NOT NULL ✓ |
| questions | COMPLIANT | NOT NULL ✓ |
| request_limits | COMPLIANT | NOT NULL ✓ |
| responses | COMPLIANT | NOT NULL ✓ |
| schema_field_items | COMPLIANT | NOT NULL ✓ |
| schema_fields | COMPLIANT | NOT NULL ✓ |
| schemas | COMPLIANT | NOT NULL ✓ |
| slugs | COMPLIANT | NOT NULL ✓ |
| standard_groups | COMPLIANT | NOT NULL ✓ |
| strengths | COMPLIANT | NOT NULL ✓ |
| template_array_items | COMPLIANT | NOT NULL ✓ |
| template_values | COMPLIANT | NOT NULL ✓ |
| texts | COMPLIANT | NOT NULL ✓ |
| thresholds | COMPLIANT | NOT NULL ✓ |
| times | COMPLIANT | NOT NULL ✓ |
| videos | COMPLIANT | NOT NULL ✓ |

### Non-Compliant Resources (29)

**Issue**: `call_id` column is nullable (should be NOT NULL)

**Resources with 0 NULLs (can be made NOT NULL immediately) - 21 resources:**
| Resource | Status | NULL Count | Action |
|----------|--------|------------|--------|
| cohorts | NON-COMPLIANT | 0 NULLs | Can make NOT NULL ✓ |
| conditional_parameters | NON-COMPLIANT | 0 NULLs | Can make NOT NULL ✓ |
| departments | NON-COMPLIANT | 0 NULLs | Can make NOT NULL ✓ |
| documents | NON-COMPLIANT | 0 NULLs | Can make NOT NULL ✓ |
| evals | NON-COMPLIANT | 0 NULLs | Can make NOT NULL ✓ |
| fields | NON-COMPLIANT | 0 NULLs | Can make NOT NULL ✓ |
| models | NON-COMPLIANT | 0 NULLs | Can make NOT NULL ✓ |
| parameters | NON-COMPLIANT | 0 NULLs | Can make NOT NULL ✓ |
| personas | NON-COMPLIANT | 0 NULLs | Can make NOT NULL ✓ |
| profiles | NON-COMPLIANT | 0 NULLs | Can make NOT NULL ✓ |
| reasoning_levels | NON-COMPLIANT | 0 NULLs | Can make NOT NULL ✓ |
| rubrics | NON-COMPLIANT | 0 NULLs | Can make NOT NULL ✓ |
| scenario_positions | NON-COMPLIANT | 0 NULLs | Can make NOT NULL ✓ |
| scenario_rubric_grade_agents | NON-COMPLIANT | 0 NULLs | Can make NOT NULL ✓ |
| scenarios | NON-COMPLIANT | 0 NULLs | Can make NOT NULL ✓ |
| settings | NON-COMPLIANT | 0 NULLs | Can make NOT NULL ✓ |
| simulation_scenario_flags | NON-COMPLIANT | 0 NULLs | Can make NOT NULL ✓ |
| simulations | NON-COMPLIANT | 0 NULLs | Can make NOT NULL ✓ |
| temperature_levels | NON-COMPLIANT | 0 NULLs | Can make NOT NULL ✓ |
| tools | NON-COMPLIANT | 0 NULLs | Can make NOT NULL ✓ |
| voices | NON-COMPLIANT | 0 NULLs | Can make NOT NULL ✓ |

**Resources with NULLs (need to handle NULLs first) - 8 resources:**
| Resource | Status | NULL Count | Action |
|----------|--------|------------|--------|
| agents | NON-COMPLIANT | 1 NULL | Need to backfill or handle |
| auths | NON-COMPLIANT | 2 NULLs | Need to backfill or handle |
| descriptions | NON-COMPLIANT | 68 NULLs | Need to backfill or handle |
| eval_rubric_grade_agents | NON-COMPLIANT | 3 NULLs | Need to backfill or handle |
| logins | NON-COMPLIANT | 292 NULLs | Need to backfill or handle |
| names | NON-COMPLIANT | 68 NULLs | Need to backfill or handle |
| roles | NON-COMPLIANT | 5 NULLs | Need to backfill or handle |
| values | NON-COMPLIANT | 25 NULLs | Need to backfill or handle |

**Resources missing columns:**
| Resource | Status | Missing Columns |
|----------|--------|-----------------|
| templates | NON-COMPLIANT | Missing generated, mcp, call_id |

## Junction Tables Compliance

### Missing Junction Tables (11)

| Artifact | Resource | Junction Table | Status |
|----------|----------|-----------------|--------|
| scenario | conversations | MISSING | MISSING |
| scenario | hints | MISSING | MISSING |
| scenario | responses | MISSING | MISSING |
| simulation | analyses | MISSING | MISSING |
| simulation | feedbacks | MISSING | MISSING |
| simulation | improvements | MISSING | MISSING |
| simulation | scenario_positions | MISSING | MISSING |
| simulation | scenario_rubric_grade_agents | MISSING | MISSING |
| simulation | simulation_scenario_flags | MISSING | MISSING |
| simulation | strengths | MISSING | MISSING |
| simulation | times | MISSING | MISSING |
| tool | tools | MISSING | MISSING |
| eval | eval_rubric_grade_agents | MISSING | MISSING |

### Non-Compliant Junction Tables (111)

All existing junction tables are **NON-COMPLIANT** because they are missing required columns or have incorrect structure.

**Common Issues**:
1. Missing `generated` column
2. Missing `mcp` column  
3. Has `call_id` column (should NOT have call_id - only resource tables have call_id) - **126 junction tables have call_id that needs to be removed**
4. Missing `active` column (some tables)
5. Missing `updated_at` column (some tables)

**Example Non-Compliant Tables**:
- `agent_departments` - Has all columns but needs verification
- `agent_descriptions` - Missing `active` column
- `auth_descriptions` - Missing `generated`, `mcp`, `call_id` columns
- `auth_items` - Missing `generated`, `mcp`, `call_id` columns
- `auth_protocols` - Missing `generated`, `mcp`, `call_id` columns
- `auth_slugs` - Missing `generated`, `mcp`, `call_id` columns
- `department_descriptions` - Missing `generated`, `mcp` columns
- `department_names` - Missing `generated`, `mcp` columns
- `department_settings` - Missing `generated`, `mcp` columns
- `model_providers` - Missing `generated`, `mcp`, `call_id` columns

### Compliant Junction Tables (1)

| Artifact | Resource | Junction Table | Status |
|----------|----------|-----------------|--------|
| document | html | document_html | COMPLIANT ✅ |

**Note**: `document_html` is compliant because it has all required columns (`generated`, `mcp`) and does NOT have `call_id`.

## Detailed Artifact-Resource Audit

| Artifact | Resource | Artifact Status | Resource Status | Junction Table | Junction Status |
|----------|----------|-----------------|-----------------|----------------|-----------------|
| agent | departments | COMPLIANT | NON-COMPLIANT: call_id nullable | agent_departments | NON-COMPLIANT |
| agent | descriptions | COMPLIANT | NON-COMPLIANT: call_id nullable | agent_descriptions | NON-COMPLIANT |
| agent | flags | COMPLIANT | COMPLIANT | agent_flags | NON-COMPLIANT |
| agent | instructions | COMPLIANT | COMPLIANT | agent_instructions | NON-COMPLIANT |
| agent | models | COMPLIANT | NON-COMPLIANT: call_id nullable | agent_models | NON-COMPLIANT |
| agent | names | COMPLIANT | NON-COMPLIANT: call_id nullable | agent_names | NON-COMPLIANT |
| agent | prompts | COMPLIANT | COMPLIANT | agent_prompts | NON-COMPLIANT |
| auth | descriptions | COMPLIANT | NON-COMPLIANT: call_id nullable | auth_descriptions | NON-COMPLIANT |
| auth | flags | COMPLIANT | COMPLIANT | auth_flags | NON-COMPLIANT |
| auth | items | COMPLIANT | COMPLIANT | auth_items | NON-COMPLIANT |
| auth | names | COMPLIANT | NON-COMPLIANT: call_id nullable | auth_names | NON-COMPLIANT |
| auth | protocols | COMPLIANT | COMPLIANT | auth_protocols | NON-COMPLIANT |
| auth | slugs | COMPLIANT | COMPLIANT | auth_slugs | NON-COMPLIANT |
| cohort | departments | COMPLIANT | NON-COMPLIANT: call_id nullable | cohort_departments | NON-COMPLIANT |
| cohort | descriptions | COMPLIANT | NON-COMPLIANT: call_id nullable | cohort_descriptions | NON-COMPLIANT |
| cohort | flags | COMPLIANT | COMPLIANT | cohort_flags | NON-COMPLIANT |
| cohort | names | COMPLIANT | NON-COMPLIANT: call_id nullable | cohort_names | NON-COMPLIANT |
| cohort | profiles | COMPLIANT | NON-COMPLIANT: call_id nullable | cohort_profiles | NON-COMPLIANT |
| cohort | simulations | COMPLIANT | NON-COMPLIANT: call_id nullable | cohort_simulations | NON-COMPLIANT |
| department | descriptions | COMPLIANT | NON-COMPLIANT: call_id nullable | department_descriptions | NON-COMPLIANT |
| department | flags | COMPLIANT | COMPLIANT | department_flags | NON-COMPLIANT |
| department | names | COMPLIANT | NON-COMPLIANT: call_id nullable | department_names | NON-COMPLIANT |
| department | settings | COMPLIANT | NON-COMPLIANT: call_id nullable | department_settings | NON-COMPLIANT |
| document | departments | COMPLIANT | NON-COMPLIANT: call_id nullable | document_departments | NON-COMPLIANT |
| document | descriptions | COMPLIANT | NON-COMPLIANT: call_id nullable | document_descriptions | NON-COMPLIANT |
| document | fields | COMPLIANT | NON-COMPLIANT: call_id nullable | document_fields | NON-COMPLIANT |
| document | flags | COMPLIANT | COMPLIANT | document_flags | NON-COMPLIANT |
| document | html | COMPLIANT | COMPLIANT | document_html | **COMPLIANT** ✅ |
| document | names | COMPLIANT | NON-COMPLIANT: call_id nullable | document_names | NON-COMPLIANT |
| document | schemas | COMPLIANT | COMPLIANT | document_schemas | NON-COMPLIANT |
| document | templates | COMPLIANT | NON-COMPLIANT: Missing columns | document_templates | NON-COMPLIANT |
| eval | agents | COMPLIANT | NON-COMPLIANT: call_id nullable | eval_agents | NON-COMPLIANT |
| eval | departments | COMPLIANT | NON-COMPLIANT: call_id nullable | eval_departments | NON-COMPLIANT |
| eval | descriptions | COMPLIANT | NON-COMPLIANT: call_id nullable | eval_descriptions | NON-COMPLIANT |
| eval | eval_rubric_grade_agents | COMPLIANT | NON-COMPLIANT: Missing columns | MISSING | MISSING |
| eval | flags | COMPLIANT | COMPLIANT | eval_flags | NON-COMPLIANT |
| eval | names | COMPLIANT | NON-COMPLIANT: call_id nullable | eval_names | NON-COMPLIANT |
| field | conditional_parameters | COMPLIANT | NON-COMPLIANT: call_id nullable | field_conditional_parameters | NON-COMPLIANT |
| field | departments | COMPLIANT | NON-COMPLIANT: call_id nullable | field_departments | NON-COMPLIANT |
| field | descriptions | COMPLIANT | NON-COMPLIANT: call_id nullable | field_descriptions | NON-COMPLIANT |
| field | flags | COMPLIANT | COMPLIANT | field_flags | NON-COMPLIANT |
| field | names | COMPLIANT | NON-COMPLIANT: call_id nullable | field_names | NON-COMPLIANT |
| model | departments | COMPLIANT | NON-COMPLIANT: call_id nullable | model_departments | NON-COMPLIANT |
| model | descriptions | COMPLIANT | NON-COMPLIANT: call_id nullable | model_descriptions | NON-COMPLIANT |
| model | endpoints | COMPLIANT | COMPLIANT | model_endpoints | NON-COMPLIANT |
| model | flags | COMPLIANT | COMPLIANT | model_flags | NON-COMPLIANT |
| model | keys | COMPLIANT | (no resource table) | model_keys | NON-COMPLIANT |
| model | names | COMPLIANT | NON-COMPLIANT: call_id nullable | model_names | NON-COMPLIANT |
| model | providers | COMPLIANT | COMPLIANT | model_providers | NON-COMPLIANT |
| model | reasoning_levels | COMPLIANT | NON-COMPLIANT: call_id nullable | model_reasoning_levels | NON-COMPLIANT |
| model | temperature_levels | COMPLIANT | NON-COMPLIANT: call_id nullable | model_temperature_levels | NON-COMPLIANT |
| model | voices | COMPLIANT | NON-COMPLIANT: call_id nullable | model_voices | NON-COMPLIANT |
| parameter | departments | COMPLIANT | NON-COMPLIANT: call_id nullable | parameter_departments | NON-COMPLIANT |
| parameter | descriptions | COMPLIANT | NON-COMPLIANT: call_id nullable | parameter_descriptions | NON-COMPLIANT |
| parameter | fields | COMPLIANT | NON-COMPLIANT: call_id nullable | parameter_fields | NON-COMPLIANT |
| parameter | flags | COMPLIANT | COMPLIANT | parameter_flags | NON-COMPLIANT |
| parameter | names | COMPLIANT | NON-COMPLIANT: call_id nullable | parameter_names | NON-COMPLIANT |
| persona | colors | COMPLIANT | COMPLIANT | persona_colors | NON-COMPLIANT |
| persona | departments | COMPLIANT | NON-COMPLIANT: call_id nullable | persona_departments | NON-COMPLIANT |
| persona | descriptions | COMPLIANT | NON-COMPLIANT: call_id nullable | persona_descriptions | NON-COMPLIANT |
| persona | examples | COMPLIANT | COMPLIANT | persona_examples | NON-COMPLIANT |
| persona | fields | COMPLIANT | NON-COMPLIANT: call_id nullable | persona_fields | NON-COMPLIANT |
| persona | flags | COMPLIANT | COMPLIANT | persona_flags | NON-COMPLIANT |
| persona | icons | COMPLIANT | COMPLIANT | persona_icons | NON-COMPLIANT |
| persona | instructions | COMPLIANT | COMPLIANT | persona_instructions | NON-COMPLIANT |
| persona | names | COMPLIANT | NON-COMPLIANT: call_id nullable | persona_names | NON-COMPLIANT |
| profile | departments | COMPLIANT | NON-COMPLIANT: call_id nullable | profile_departments | NON-COMPLIANT |
| profile | emails | COMPLIANT | COMPLIANT | profile_emails | NON-COMPLIANT |
| profile | flags | COMPLIANT | COMPLIANT | profile_flags | NON-COMPLIANT |
| profile | names | COMPLIANT | NON-COMPLIANT: call_id nullable | profile_names | NON-COMPLIANT |
| profile | request_limits | COMPLIANT | COMPLIANT | profile_request_limits | NON-COMPLIANT |
| provider | descriptions | COMPLIANT | NON-COMPLIANT: call_id nullable | provider_descriptions | NON-COMPLIANT |
| provider | flags | COMPLIANT | COMPLIANT | provider_flags | NON-COMPLIANT |
| provider | names | COMPLIANT | NON-COMPLIANT: call_id nullable | provider_names | NON-COMPLIANT |
| rubric | departments | COMPLIANT | NON-COMPLIANT: call_id nullable | rubric_departments | NON-COMPLIANT |
| rubric | descriptions | COMPLIANT | NON-COMPLIANT: call_id nullable | rubric_descriptions | NON-COMPLIANT |
| rubric | flags | COMPLIANT | COMPLIANT | rubric_flags | NON-COMPLIANT |
| rubric | names | COMPLIANT | NON-COMPLIANT: call_id nullable | rubric_names | NON-COMPLIANT |
| rubric | points | COMPLIANT | COMPLIANT | rubric_points | NON-COMPLIANT |
| rubric | standard_groups | COMPLIANT | COMPLIANT | rubric_standard_groups | NON-COMPLIANT |
| scenario | conversations | COMPLIANT | COMPLIANT | **MISSING** | MISSING |
| scenario | departments | COMPLIANT | NON-COMPLIANT: call_id nullable | scenario_departments | NON-COMPLIANT |
| scenario | descriptions | COMPLIANT | NON-COMPLIANT: call_id nullable | scenario_descriptions | NON-COMPLIANT |
| scenario | documents | COMPLIANT | NON-COMPLIANT: call_id nullable | scenario_documents | NON-COMPLIANT |
| scenario | fields | COMPLIANT | NON-COMPLIANT: call_id nullable | scenario_fields | NON-COMPLIANT |
| scenario | flags | COMPLIANT | COMPLIANT | scenario_flags | NON-COMPLIANT |
| scenario | hints | COMPLIANT | COMPLIANT | **MISSING** | MISSING |
| scenario | images | COMPLIANT | COMPLIANT | scenario_images | NON-COMPLIANT |
| scenario | names | COMPLIANT | NON-COMPLIANT: call_id nullable | scenario_names | NON-COMPLIANT |
| scenario | objectives | COMPLIANT | COMPLIANT | scenario_objectives | NON-COMPLIANT |
| scenario | options | COMPLIANT | COMPLIANT | scenario_options | NON-COMPLIANT |
| scenario | parameters | COMPLIANT | NON-COMPLIANT: call_id nullable | scenario_parameters | NON-COMPLIANT |
| scenario | personas | COMPLIANT | NON-COMPLIANT: call_id nullable | scenario_personas | NON-COMPLIANT |
| scenario | problem_statements | COMPLIANT | COMPLIANT | scenario_problem_statements | NON-COMPLIANT |
| scenario | questions | COMPLIANT | COMPLIANT | scenario_questions | NON-COMPLIANT |
| scenario | responses | COMPLIANT | COMPLIANT | **MISSING** | MISSING |
| scenario | templates | COMPLIANT | NON-COMPLIANT: Missing columns | scenario_templates | NON-COMPLIANT |
| scenario | videos | COMPLIANT | COMPLIANT | scenario_videos | NON-COMPLIANT |
| setting | auths | COMPLIANT | NON-COMPLIANT: call_id nullable | setting_auths | NON-COMPLIANT |
| setting | colors | COMPLIANT | COMPLIANT | setting_colors | NON-COMPLIANT |
| setting | departments | COMPLIANT | NON-COMPLIANT: call_id nullable | setting_departments | NON-COMPLIANT |
| setting | descriptions | COMPLIANT | NON-COMPLIANT: call_id nullable | setting_descriptions | NON-COMPLIANT |
| setting | flags | COMPLIANT | COMPLIANT | setting_flags | NON-COMPLIANT |
| setting | names | COMPLIANT | NON-COMPLIANT: call_id nullable | setting_names | NON-COMPLIANT |
| setting | providers | COMPLIANT | COMPLIANT | setting_providers | NON-COMPLIANT |
| setting | thresholds | COMPLIANT | COMPLIANT | setting_thresholds | NON-COMPLIANT |
| simulation | analyses | COMPLIANT | COMPLIANT | **MISSING** | MISSING |
| simulation | departments | COMPLIANT | NON-COMPLIANT: call_id nullable | simulation_departments | NON-COMPLIANT |
| simulation | descriptions | COMPLIANT | NON-COMPLIANT: call_id nullable | simulation_descriptions | NON-COMPLIANT |
| simulation | feedbacks | COMPLIANT | COMPLIANT | **MISSING** | MISSING |
| simulation | flags | COMPLIANT | COMPLIANT | simulation_flags | NON-COMPLIANT |
| simulation | improvements | COMPLIANT | COMPLIANT | **MISSING** | MISSING |
| simulation | names | COMPLIANT | NON-COMPLIANT: call_id nullable | simulation_names | NON-COMPLIANT |
| simulation | scenario_positions | COMPLIANT | NON-COMPLIANT: call_id nullable | **MISSING** | MISSING |
| simulation | scenario_rubric_grade_agents | COMPLIANT | NON-COMPLIANT: Missing columns | **MISSING** | MISSING |
| simulation | scenarios | COMPLIANT | NON-COMPLIANT: call_id nullable | simulation_scenarios | NON-COMPLIANT |
| simulation | simulation_scenario_flags | COMPLIANT | NON-COMPLIANT: Missing columns | **MISSING** | MISSING |
| simulation | strengths | COMPLIANT | COMPLIANT | **MISSING** | MISSING |
| simulation | times | COMPLIANT | COMPLIANT | **MISSING** | MISSING |
| tool | schemas | COMPLIANT | COMPLIANT | tool_schemas | NON-COMPLIANT |
| tool | templates | COMPLIANT | NON-COMPLIANT: Missing columns | tool_templates | NON-COMPLIANT |
| tool | tools | COMPLIANT | NON-COMPLIANT: call_id nullable | **MISSING** | MISSING |

## Recommendations

### Priority 1: Fix Resource Tables
1. Make `call_id` NOT NULL in resource tables where it's currently nullable AND has no NULL values (21 resources):
   - `cohorts_resource` (0 NULLs)
   - `conditional_parameters_resource` (0 NULLs)
   - `departments_resource` (0 NULLs)
   - `documents_resource` (0 NULLs)
   - `evals_resource` (0 NULLs)
   - `fields_resource` (0 NULLs)
   - `models_resource` (0 NULLs)
   - `parameters_resource` (0 NULLs)
   - `personas_resource` (0 NULLs)
   - `profiles_resource` (0 NULLs)
   - `reasoning_levels_resource` (0 NULLs)
   - `rubrics_resource` (0 NULLs)
   - `scenario_positions_resource` (0 NULLs)
   - `scenario_rubric_grade_agents_resource` (0 NULLs)
   - `scenarios_resource` (0 NULLs)
   - `settings_resource` (0 NULLs)
   - `simulation_scenario_flags_resource` (0 NULLs)
   - `simulations_resource` (0 NULLs)
   - `temperature_levels_resource` (0 NULLs)
   - `tools_resource` (0 NULLs)
   - `voices_resource` (0 NULLs)

2. Handle NULL values before making `call_id` NOT NULL for resources with NULLs (8 resources):
   - `agents_resource` (1 NULL) - Need to backfill or handle
   - `auths_resource` (2 NULLs) - Need to backfill or handle
   - `descriptions_resource` (68 NULLs) - Need to backfill or handle
   - `eval_rubric_grade_agents_resource` (3 NULLs) - Need to backfill or handle
   - `logins_resource` (292 NULLs) - Need to backfill or handle
   - `names_resource` (68 NULLs) - Need to backfill or handle
   - `roles_resource` (5 NULLs) - Need to backfill or handle
   - `values_resource` (25 NULLs) - Need to backfill or handle

3. Add missing `generated`, `mcp`, `call_id` columns to:
   - `templates_resource` (missing all three columns)

### Priority 2: Fix Junction Tables
1. **Remove `call_id` column** from all 126 junction tables that currently have it (junction tables should NOT have call_id - only resource tables have call_id)
2. Add missing columns to all non-compliant junction tables:
   - `generated` (boolean, NOT NULL, DEFAULT false)
   - `mcp` (boolean, NOT NULL, DEFAULT false)
   - `active` (boolean, NOT NULL, DEFAULT true) - if missing
   - `updated_at` (timestamptz, NOT NULL) - if missing

### Priority 3: Create Missing Junction Tables
Create junction tables for:
- `scenario_conversations`
- `scenario_hints`
- `scenario_responses`
- `simulation_analyses`
- `simulation_feedbacks`
- `simulation_improvements`
- `simulation_scenario_positions`
- `simulation_scenario_rubric_grade_agents`
- `simulation_simulation_scenario_flags`
- `simulation_strengths`
- `simulation_times`
- `tool_tools`
- `eval_eval_rubric_grade_agents`
