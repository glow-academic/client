# Artifacts and Resources Audit Report

Generated: $(date)

## Summary

- **Total Artifacts**: 17
- **Total Resources**: 70 (up from 69 - `contents_resource` added)
- **Total Artifact-Resource Pairs**: 127 (up from 122)
- **Missing Junction Tables**: 0 ✅ (All junction tables exist)
- **Junction Tables with call_id**: 2 (non-standard tables: `contents`, `message_calls`)
- **Compliant Junction Tables**: 9 ✅ (up from 4)
- **Missing Resources**: 
  - 0 ✅ (All required resources now exist - `content` for scenario, `analyses`/`feedbacks`/`times` for eval)
- **Resource-Tool Mapping**: Each resource should have a corresponding tool in the `tool_artifact` table

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

### Compliant Resources (63)

| Resource | Status | call_id Status |
|----------|--------|----------------|
| analyses | COMPLIANT | NOT NULL ✓ |
| audios | COMPLIANT | NOT NULL ✓ |
| colors | COMPLIANT | NOT NULL ✓ |
| cohorts | COMPLIANT | NOT NULL ✓ |
| conditional_parameters | COMPLIANT | NOT NULL ✓ |
| contents | COMPLIANT | NOT NULL ✓ |
| conversations | COMPLIANT | NOT NULL ✓ |
| debug_info | COMPLIANT | NOT NULL ✓ |
| departments | COMPLIANT | NOT NULL ✓ |
| descriptions | COMPLIANT | NOT NULL ✓ |
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
| names | COMPLIANT | NOT NULL ✓ |
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
| scenario_rubric_grade_agents | COMPLIANT | NOT NULL ✓ |
| scenarios | COMPLIANT | NOT NULL ✓ |
| schema_field_items | COMPLIANT | NOT NULL ✓ |
| schema_fields | COMPLIANT | NOT NULL ✓ |
| schemas | COMPLIANT | NOT NULL ✓ |
| settings | COMPLIANT | NOT NULL ✓ |
| simulation_scenario_flags | COMPLIANT | NOT NULL ✓ |
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

### Non-Compliant Resources (7)

**Resources with nullable call_id (need to handle NULLs first) - 3 resources:**
| Resource | Status | NULL Count | Action |
|----------|--------|------------|--------|
| agents | NON-COMPLIANT | 1 NULL | Need to backfill or handle |
| auths | NON-COMPLIANT | 2 NULLs | Need to backfill or handle |
| eval_rubric_grade_agents | NON-COMPLIANT | 3 NULLs | Need to backfill or handle |

**Resources with nullable call_id but 0 NULLs (can be made NOT NULL immediately) - 4 resources:**
| Resource | Status | NULL Count | Action |
|----------|--------|------------|--------|
| logins | NON-COMPLIANT | 0 NULLs | Can make NOT NULL ✓ |
| roles | NON-COMPLIANT | 0 NULLs | Can make NOT NULL ✓ |
| templates | NON-COMPLIANT | 0 NULLs | Can make NOT NULL ✓ |
| values | NON-COMPLIANT | 0 NULLs | Can make NOT NULL ✓ |

## Junction Tables Compliance

### Compliant Junction Tables (9) ✅

| Artifact | Resource | Junction Table | Status |
|----------|----------|----------------|--------|
| department | settings | department_settings | COMPLIANT ✅ |
| document | html | document_html | COMPLIANT ✅ |
| eval | analyses | eval_analyses | COMPLIANT ✅ |
| eval | feedbacks | eval_feedbacks | COMPLIANT ✅ |
| eval | times | eval_times | COMPLIANT ✅ |
| model | providers | model_providers | COMPLIANT ✅ |
| scenario | content | scenario_content | COMPLIANT ✅ |
| simulation | eval_rubric_grade_agents | simulation_eval_rubric_grade_agents | COMPLIANT ✅ |
| tool | tools | tool_tools | COMPLIANT ✅ |

**Note**: These junction tables are compliant because they have all required columns (`{artifact}_id`, `{resource}_id`, `active`, `created_at`, `updated_at`, `generated`, `mcp`) and do NOT have `call_id`.

### Non-Compliant Junction Tables (118)

All 118 non-compliant junction tables are missing `generated` and/or `mcp` columns.

**Common Issues**:
1. Missing `generated` column
2. Missing `mcp` column  
3. All junction tables correctly do NOT have `call_id` (except `contents` and `message_calls` tables which are not standard artifact-resource junctions)

### Missing Junction Tables (0) ✅

All artifact-resource pairs have corresponding junction tables.

## Scenario Resources Status

**Current State**: `scenario` artifact has `content` resource ✅ (replaced `messages`)

**Resources with Direct Connections**:
- `content` ✅ - Has `scenario_content` junction table (COMPLIANT)
- `hints` ✅ - Has `scenario_hints` junction table
- `conversations` ✅ - Has `scenario_conversations` junction table
- `responses` ✅ - Has `scenario_responses` junction table

**All Resources**: `scenario` has 19 resources defined in `artifact_resources`: content, conversations, departments, descriptions, documents, fields, flags, hints, images, names, objectives, options, parameters, personas, problem_statements, questions, responses, templates, videos

## Eval Resources Status

**Current State**: `eval` artifact has resources for analyses, feedbacks, and times ✅

**Resources with Tools Connected**:
- `analyses` ✅ - Has `create_analysis` tool via `resource_tools`, has `eval_analyses` junction table (COMPLIANT)
- `feedbacks` ✅ - Has `create_feedback` tool via `resource_tools`, has `eval_feedbacks` junction table (COMPLIANT)
- `times` ✅ - Has `create_times` tool via `resource_tools`, has `eval_times` junction table (COMPLIANT)

**All Resources**: `eval` has 9 resources: agents, analyses, departments, descriptions, feedbacks, flags, names, times, eval_rubric_grade_agents

**Note**: `eval` correctly does NOT have `strengths` or `improvements` resources (unlike `simulation`).

## Simulation Resources Status

**Current State**: `simulation` artifact has resources for analysis, strengths, improvements, feedbacks, and times ✅

**Resources with Tools Connected**:
- `analyses` ✅ - Has `create_analysis` tool via `resource_tools`, has `simulation_analyses` junction table
- `strengths` ✅ - Has `create_strength` tool via `resource_tools`, has `simulation_strengths` junction table
- `improvements` ✅ - Has `create_improvement` tool via `resource_tools`, has `simulation_improvements` junction table
- `feedbacks` ✅ - Has `create_feedback` tool via `resource_tools`, has `simulation_feedbacks` junction table
- `times` ✅ - Has `create_times` tool via `resource_tools`, has `simulation_times` junction table

**Grade Tool Resources**:
- `scenario_rubric_grade_agents` ✅ - Has resource and junction table, has `create_scenario_rubric_grade_agents` tool via `resource_tools`
- `eval_rubric_grade_agents` ✅ - Has resource and `simulation_eval_rubric_grade_agents` junction table (COMPLIANT)

**Other Resources**:
- `departments` ✅ - Has resource and junction table
- `descriptions` ✅ - Has resource and junction table
- `flags` ✅ - Has resource and junction table
- `names` ✅ - Has resource and junction table
- `scenarios` ✅ - Has resource and junction table
- `scenario_positions` ✅ - Has resource and junction table
- `simulation_scenario_flags` ✅ - Has resource

**All Resources**: `simulation` has 14 resources: analyses, departments, descriptions, eval_rubric_grade_agents, feedbacks, flags, improvements, names, scenario_positions, scenario_rubric_grade_agents, scenarios, simulation_scenario_flags, strengths, times

## Resource-Tool Mapping

**Pattern**: Each resource should have a corresponding tool in the `tool_artifact` table.

**Current State**:
- Tools are stored in `tool_artifact` table
- Tools connect to resources via `resource_tools` table
- Tools have resources like `names`, `descriptions`, `schemas`, `templates` via junction tables
- Tools follow naming pattern: `create_{resource}` (e.g., `create_agents`, `create_analysis`, `create_audio`)

**Verification Needed**:
- Verify that all resources have corresponding tools
- Document which resources don't need tools (if any)
- Ensure tools can be properly connected to their resources via `resource_tools` table

## Detailed Artifact-Resource Audit

| Artifact | Resource | Artifact Status | Resource Status | Junction Table | Junction Status |
|----------|----------|-----------------|-----------------|----------------|-----------------|
| agent | departments | COMPLIANT | COMPLIANT | agent_departments | NON-COMPLIANT: Missing generated/mcp |
| agent | descriptions | COMPLIANT | COMPLIANT | agent_descriptions | NON-COMPLIANT: Missing generated/mcp |
| agent | flags | COMPLIANT | COMPLIANT | agent_flags | NON-COMPLIANT: Missing generated/mcp |
| agent | instructions | COMPLIANT | COMPLIANT | agent_instructions | NON-COMPLIANT: Missing generated/mcp |
| agent | models | COMPLIANT | COMPLIANT | agent_models | NON-COMPLIANT: Missing generated/mcp |
| agent | names | COMPLIANT | COMPLIANT | agent_names | NON-COMPLIANT: Missing generated/mcp |
| agent | prompts | COMPLIANT | COMPLIANT | agent_prompts | NON-COMPLIANT: Missing generated/mcp |
| auth | descriptions | COMPLIANT | COMPLIANT | auth_descriptions | NON-COMPLIANT: Missing generated/mcp |
| auth | flags | COMPLIANT | COMPLIANT | auth_flags | NON-COMPLIANT: Missing generated/mcp |
| auth | items | COMPLIANT | COMPLIANT | auth_items | NON-COMPLIANT: Missing generated/mcp |
| auth | names | COMPLIANT | COMPLIANT | auth_names | NON-COMPLIANT: Missing generated/mcp |
| auth | protocols | COMPLIANT | COMPLIANT | auth_protocols | NON-COMPLIANT: Missing generated/mcp |
| auth | slugs | COMPLIANT | COMPLIANT | auth_slugs | NON-COMPLIANT: Missing generated/mcp |
| cohort | departments | COMPLIANT | COMPLIANT | cohort_departments | NON-COMPLIANT: Missing generated/mcp |
| cohort | descriptions | COMPLIANT | COMPLIANT | cohort_descriptions | NON-COMPLIANT: Missing generated/mcp |
| cohort | flags | COMPLIANT | COMPLIANT | cohort_flags | NON-COMPLIANT: Missing generated/mcp |
| cohort | names | COMPLIANT | COMPLIANT | cohort_names | NON-COMPLIANT: Missing generated/mcp |
| cohort | profiles | COMPLIANT | COMPLIANT | cohort_profiles | NON-COMPLIANT: Missing generated/mcp |
| cohort | simulations | COMPLIANT | COMPLIANT | cohort_simulations | NON-COMPLIANT: Missing generated/mcp |
| department | descriptions | COMPLIANT | COMPLIANT | department_descriptions | NON-COMPLIANT: Missing generated/mcp |
| department | flags | COMPLIANT | COMPLIANT | department_flags | NON-COMPLIANT: Missing generated/mcp |
| department | names | COMPLIANT | COMPLIANT | department_names | NON-COMPLIANT: Missing generated/mcp |
| department | settings | COMPLIANT | COMPLIANT | department_settings | **COMPLIANT** ✅ |
| document | departments | COMPLIANT | COMPLIANT | document_departments | NON-COMPLIANT: Missing generated/mcp |
| document | descriptions | COMPLIANT | COMPLIANT | document_descriptions | NON-COMPLIANT: Missing generated/mcp |
| document | fields | COMPLIANT | COMPLIANT | document_fields | NON-COMPLIANT: Missing generated/mcp |
| document | flags | COMPLIANT | COMPLIANT | document_flags | NON-COMPLIANT: Missing generated/mcp |
| document | html | COMPLIANT | COMPLIANT | document_html | **COMPLIANT** ✅ |
| document | names | COMPLIANT | COMPLIANT | document_names | NON-COMPLIANT: Missing generated/mcp |
| document | schemas | COMPLIANT | COMPLIANT | document_schemas | NON-COMPLIANT: Missing generated/mcp |
| document | templates | COMPLIANT | NON-COMPLIANT: call_id nullable | document_templates | NON-COMPLIANT: Missing generated/mcp |
| eval | agents | COMPLIANT | COMPLIANT | eval_agents | NON-COMPLIANT: Missing generated/mcp |
| eval | analyses | COMPLIANT | COMPLIANT | eval_analyses | **COMPLIANT** ✅ |
| eval | departments | COMPLIANT | COMPLIANT | eval_departments | NON-COMPLIANT: Missing generated/mcp |
| eval | descriptions | COMPLIANT | COMPLIANT | eval_descriptions | NON-COMPLIANT: Missing generated/mcp |
| eval | eval_rubric_grade_agents | COMPLIANT | NON-COMPLIANT: call_id nullable | eval_eval_rubric_grade_agents | NON-COMPLIANT: Missing generated/mcp |
| eval | feedbacks | COMPLIANT | COMPLIANT | eval_feedbacks | **COMPLIANT** ✅ |
| eval | flags | COMPLIANT | COMPLIANT | eval_flags | NON-COMPLIANT: Missing generated/mcp |
| eval | names | COMPLIANT | COMPLIANT | eval_names | NON-COMPLIANT: Missing generated/mcp |
| eval | times | COMPLIANT | COMPLIANT | eval_times | **COMPLIANT** ✅ |
| field | conditional_parameters | COMPLIANT | COMPLIANT | field_conditional_parameters | NON-COMPLIANT: Missing generated/mcp |
| field | departments | COMPLIANT | COMPLIANT | field_departments | NON-COMPLIANT: Missing generated/mcp |
| field | descriptions | COMPLIANT | COMPLIANT | field_descriptions | NON-COMPLIANT: Missing generated/mcp |
| field | flags | COMPLIANT | COMPLIANT | field_flags | NON-COMPLIANT: Missing generated/mcp |
| field | names | COMPLIANT | COMPLIANT | field_names | NON-COMPLIANT: Missing generated/mcp |
| model | departments | COMPLIANT | COMPLIANT | model_departments | NON-COMPLIANT: Missing generated/mcp |
| model | descriptions | COMPLIANT | COMPLIANT | model_descriptions | NON-COMPLIANT: Missing generated/mcp |
| model | endpoints | COMPLIANT | COMPLIANT | model_endpoints | NON-COMPLIANT: Missing generated/mcp |
| model | flags | COMPLIANT | COMPLIANT | model_flags | NON-COMPLIANT: Missing generated/mcp |
| model | keys | COMPLIANT | (no resource table) | model_keys | NON-COMPLIANT: Missing generated/mcp |
| model | names | COMPLIANT | COMPLIANT | model_names | NON-COMPLIANT: Missing generated/mcp |
| model | providers | COMPLIANT | COMPLIANT | model_providers | **COMPLIANT** ✅ |
| model | reasoning_levels | COMPLIANT | COMPLIANT | model_reasoning_levels | NON-COMPLIANT: Missing generated/mcp |
| model | temperature_levels | COMPLIANT | COMPLIANT | model_temperature_levels | NON-COMPLIANT: Missing generated/mcp |
| model | voices | COMPLIANT | COMPLIANT | model_voices | NON-COMPLIANT: Missing generated/mcp |
| parameter | departments | COMPLIANT | COMPLIANT | parameter_departments | NON-COMPLIANT: Missing generated/mcp |
| parameter | descriptions | COMPLIANT | COMPLIANT | parameter_descriptions | NON-COMPLIANT: Missing generated/mcp |
| parameter | fields | COMPLIANT | COMPLIANT | parameter_fields | NON-COMPLIANT: Missing generated/mcp |
| parameter | flags | COMPLIANT | COMPLIANT | parameter_flags | NON-COMPLIANT: Missing generated/mcp |
| parameter | names | COMPLIANT | COMPLIANT | parameter_names | NON-COMPLIANT: Missing generated/mcp |
| persona | colors | COMPLIANT | COMPLIANT | persona_colors | NON-COMPLIANT: Missing generated/mcp |
| persona | departments | COMPLIANT | COMPLIANT | persona_departments | NON-COMPLIANT: Missing generated/mcp |
| persona | descriptions | COMPLIANT | COMPLIANT | persona_descriptions | NON-COMPLIANT: Missing generated/mcp |
| persona | examples | COMPLIANT | COMPLIANT | persona_examples | NON-COMPLIANT: Missing generated/mcp |
| persona | fields | COMPLIANT | COMPLIANT | persona_fields | NON-COMPLIANT: Missing generated/mcp |
| persona | flags | COMPLIANT | COMPLIANT | persona_flags | NON-COMPLIANT: Missing generated/mcp |
| persona | icons | COMPLIANT | COMPLIANT | persona_icons | NON-COMPLIANT: Missing generated/mcp |
| persona | instructions | COMPLIANT | COMPLIANT | persona_instructions | NON-COMPLIANT: Missing generated/mcp |
| persona | names | COMPLIANT | COMPLIANT | persona_names | NON-COMPLIANT: Missing generated/mcp |
| profile | departments | COMPLIANT | COMPLIANT | profile_departments | NON-COMPLIANT: Missing generated/mcp |
| profile | emails | COMPLIANT | COMPLIANT | profile_emails | NON-COMPLIANT: Missing generated/mcp |
| profile | flags | COMPLIANT | COMPLIANT | profile_flags | NON-COMPLIANT: Missing generated/mcp |
| profile | names | COMPLIANT | COMPLIANT | profile_names | NON-COMPLIANT: Missing generated/mcp |
| profile | request_limits | COMPLIANT | COMPLIANT | profile_request_limits | NON-COMPLIANT: Missing generated/mcp |
| provider | descriptions | COMPLIANT | COMPLIANT | provider_descriptions | NON-COMPLIANT: Missing generated/mcp |
| provider | flags | COMPLIANT | COMPLIANT | provider_flags | NON-COMPLIANT: Missing generated/mcp |
| provider | names | COMPLIANT | COMPLIANT | provider_names | NON-COMPLIANT: Missing generated/mcp |
| rubric | departments | COMPLIANT | COMPLIANT | rubric_departments | NON-COMPLIANT: Missing generated/mcp |
| rubric | descriptions | COMPLIANT | COMPLIANT | rubric_descriptions | NON-COMPLIANT: Missing generated/mcp |
| rubric | flags | COMPLIANT | COMPLIANT | rubric_flags | NON-COMPLIANT: Missing generated/mcp |
| rubric | names | COMPLIANT | COMPLIANT | rubric_names | NON-COMPLIANT: Missing generated/mcp |
| rubric | points | COMPLIANT | COMPLIANT | rubric_points | NON-COMPLIANT: Missing generated/mcp |
| rubric | standard_groups | COMPLIANT | COMPLIANT | rubric_standard_groups | NON-COMPLIANT: Missing generated/mcp |
| scenario | content | COMPLIANT | COMPLIANT | scenario_content | **COMPLIANT** ✅ |
| scenario | conversations | COMPLIANT | COMPLIANT | scenario_conversations | NON-COMPLIANT: Missing generated/mcp |
| scenario | departments | COMPLIANT | COMPLIANT | scenario_departments | NON-COMPLIANT: Missing generated/mcp |
| scenario | descriptions | COMPLIANT | COMPLIANT | scenario_descriptions | NON-COMPLIANT: Missing generated/mcp |
| scenario | documents | COMPLIANT | COMPLIANT | scenario_documents | NON-COMPLIANT: Missing generated/mcp |
| scenario | fields | COMPLIANT | COMPLIANT | scenario_fields | NON-COMPLIANT: Missing generated/mcp |
| scenario | flags | COMPLIANT | COMPLIANT | scenario_flags | NON-COMPLIANT: Missing generated/mcp |
| scenario | hints | COMPLIANT | COMPLIANT | scenario_hints | NON-COMPLIANT: Missing generated/mcp |
| scenario | images | COMPLIANT | COMPLIANT | scenario_images | NON-COMPLIANT: Missing generated/mcp |
| scenario | names | COMPLIANT | COMPLIANT | scenario_names | NON-COMPLIANT: Missing generated/mcp |
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
| setting | descriptions | COMPLIANT | COMPLIANT | setting_descriptions | NON-COMPLIANT: Missing generated/mcp |
| setting | flags | COMPLIANT | COMPLIANT | setting_flags | NON-COMPLIANT: Missing generated/mcp |
| setting | names | COMPLIANT | COMPLIANT | setting_names | NON-COMPLIANT: Missing generated/mcp |
| setting | providers | COMPLIANT | COMPLIANT | setting_providers | NON-COMPLIANT: Missing generated/mcp |
| setting | thresholds | COMPLIANT | COMPLIANT | setting_thresholds | NON-COMPLIANT: Missing generated/mcp |
| simulation | analyses | COMPLIANT | COMPLIANT | simulation_analyses | NON-COMPLIANT: Missing generated/mcp |
| simulation | departments | COMPLIANT | COMPLIANT | simulation_departments | NON-COMPLIANT: Missing generated/mcp |
| simulation | descriptions | COMPLIANT | COMPLIANT | simulation_descriptions | NON-COMPLIANT: Missing generated/mcp |
| simulation | eval_rubric_grade_agents | COMPLIANT | NON-COMPLIANT: call_id nullable | simulation_eval_rubric_grade_agents | **COMPLIANT** ✅ |
| simulation | feedbacks | COMPLIANT | COMPLIANT | simulation_feedbacks | NON-COMPLIANT: Missing generated/mcp |
| simulation | flags | COMPLIANT | COMPLIANT | simulation_flags | NON-COMPLIANT: Missing generated/mcp |
| simulation | improvements | COMPLIANT | COMPLIANT | simulation_improvements | NON-COMPLIANT: Missing generated/mcp |
| simulation | names | COMPLIANT | COMPLIANT | simulation_names | NON-COMPLIANT: Missing generated/mcp |
| simulation | scenario_positions | COMPLIANT | COMPLIANT | simulation_scenario_positions | NON-COMPLIANT: Missing generated/mcp |
| simulation | scenario_rubric_grade_agents | COMPLIANT | COMPLIANT | simulation_scenario_rubric_grade_agents | NON-COMPLIANT: Missing generated/mcp |
| simulation | scenarios | COMPLIANT | COMPLIANT | simulation_scenarios | NON-COMPLIANT: Missing generated/mcp |
| simulation | simulation_scenario_flags | COMPLIANT | COMPLIANT | simulation_simulation_scenario_flags | NON-COMPLIANT: Missing generated/mcp |
| simulation | strengths | COMPLIANT | COMPLIANT | simulation_strengths | NON-COMPLIANT: Missing generated/mcp |
| simulation | times | COMPLIANT | COMPLIANT | simulation_times | NON-COMPLIANT: Missing generated/mcp |
| tool | schemas | COMPLIANT | COMPLIANT | tool_schemas | NON-COMPLIANT: Missing generated/mcp |
| tool | templates | COMPLIANT | NON-COMPLIANT: call_id nullable | tool_templates | NON-COMPLIANT: Missing generated/mcp |
| tool | tools | COMPLIANT | COMPLIANT | tool_tools | **COMPLIANT** ✅ |

## Recommendations

### Priority 1: Fix Resource Tables
1. **Make `call_id` NOT NULL** in resources with 0 NULLs (can be done immediately):
   - `logins_resource` (0 NULLs)
   - `roles_resource` (0 NULLs)
   - `templates_resource` (0 NULLs)
   - `values_resource` (0 NULLs)

2. **Handle NULL values** before making `call_id` NOT NULL for resources with NULLs:
   - `agents_resource` (1 NULL) - Need to backfill or handle
   - `auths_resource` (2 NULLs) - Need to backfill or handle
   - `eval_rubric_grade_agents_resource` (3 NULLs) - Need to backfill or handle

### Priority 2: Fix Junction Tables
1. **Add missing columns** to all 118 non-compliant junction tables:
   - `generated` (boolean, NOT NULL, DEFAULT false)
   - `mcp` (boolean, NOT NULL, DEFAULT false)
   - `active` (boolean, NOT NULL, DEFAULT true) - if missing
   - `updated_at` (timestamptz, NOT NULL) - if missing

2. **Remove `call_id` column** from `contents` and `message_calls` tables if they're not needed (these appear to be non-standard tables)

### Priority 3: Verify Compliance
- All 9 compliant junction tables serve as examples of the correct structure
- Once all junction tables have `generated` and `mcp` columns added, compliance should be achieved
