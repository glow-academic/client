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
  - `runs` and `groups` resources for `eval` artifact (analogous to how simulations have `scenarios`)
  - `run_positions` and `group_positions` resources for `eval` artifact (analogous to scenario having `scenario_positions`)
  - `runs_rubric_grade_agents` and `groups_rubric_grade_agents` resources (to replace `eval_rubric_grade_agents`)
  - `values` resource for `provider` artifact
  - `names` and `descriptions` resources for `tool` artifact
- **Issues to Fix**:
  - Remove `eval_rubric_grade_agents` resource (flawed logic - should use `runs_rubric_grade_agents` and `groups_rubric_grade_agents` instead)
  - Remove `tool_tools` junction table (not needed)
  - Add `type` field to `tool_templates` junction table (enum: 'argument' or 'output')
  - Rename `simulation_scenario_flags` resource to `scenario_flags`
  - Replace `field` → `conditional_parameters` with `field` → `parameters` (with type enum on junction table)
  - Add `reasoning_levels`, `temperature_levels`, `voices` resources to `agent` artifact
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

**Missing Resources** (analogous to how simulations have `scenarios`):
- `runs` ❌ - Should have `runs_resource` table and `eval_runs` junction table
- `groups` ❌ - Should have `groups_resource` table and `eval_groups` junction table
- `run_positions` ❌ - Should have `run_positions_resource` table and `eval_run_positions` junction table (analogous to `scenario_positions`)
- `group_positions` ❌ - Should have `group_positions_resource` table and `eval_group_positions` junction table

**Flawed Resource to Remove**:
- `eval_rubric_grade_agents` ❌ - Should be removed. Instead use:
  - `runs_rubric_grade_agents` resource (with `runs_rubric_grade_agents_resource` table and `eval_runs_rubric_grade_agents` junction table)
  - `groups_rubric_grade_agents` resource (with `groups_rubric_grade_agents_resource` table and `eval_groups_rubric_grade_agents` junction table)
  - Note: `eval_runs_rubric_grade_agents` and `eval_groups_rubric_grade_agents` tables already exist but reference `rubric_grade_agent_id` directly - need to check if they should reference resources instead

**Current Resources**: `eval` has 9 resources: agents, analyses, departments, descriptions, feedbacks, flags, names, times, eval_rubric_grade_agents

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

## Issues Requiring Fixes

### Issue 1: Eval Missing Runs and Groups Resources

**Problem**: `eval` artifact should have `runs` and `groups` resources (analogous to how `simulation` has `scenarios`).

**Current State**:
- `runs` table exists (not a resource table)
- `groups` table exists (not a resource table)
- `runs_resource` table does NOT exist ❌
- `groups_resource` table does NOT exist ❌
- `runs` is NOT in resources enum ❌
- `groups` is NOT in resources enum ❌
- `eval` → `runs` entry does NOT exist in `artifact_resources` ❌
- `eval` → `groups` entry does NOT exist in `artifact_resources` ❌
- `eval_runs` junction table does NOT exist ❌
- `eval_groups` junction table does NOT exist ❌

**Required Actions**:
1. Add `runs` and `groups` to `resources` enum
2. Create `runs_resource` table with required columns
3. Create `groups_resource` table with required columns
4. Add `eval` → `runs` and `eval` → `groups` entries to `artifact_resources`
5. Create `eval_runs` and `eval_groups` junction tables

### Issue 2: Eval Missing Position Resources

**Problem**: `eval` should have `run_positions` and `group_positions` resources (analogous to `scenario` having `scenario_positions`).

**Current State**:
- `run_positions` is NOT in resources enum ❌
- `group_positions` is NOT in resources enum ❌
- `run_positions_resource` table does NOT exist ❌
- `group_positions_resource` table does NOT exist ❌
- `eval` → `run_positions` entry does NOT exist in `artifact_resources` ❌
- `eval` → `group_positions` entry does NOT exist in `artifact_resources` ❌
- `eval_run_positions` junction table does NOT exist ❌
- `eval_group_positions` junction table does NOT exist ❌

**Required Actions**:
1. Add `run_positions` and `group_positions` to `resources` enum
2. Create `run_positions_resource` and `group_positions_resource` tables
3. Add entries to `artifact_resources`
4. Create junction tables

### Issue 3: Remove eval_rubric_grade_agents (Flawed Logic)

**Problem**: `eval_rubric_grade_agents` resource is flawed. Should use `runs_rubric_grade_agents` and `groups_rubric_grade_agents` instead (analogous to how `scenario` has `scenario_rubric_grade_agents`).

**Current State**:
- `eval_rubric_grade_agents` resource exists in `artifact_resources` (used by `eval` and `simulation`) ❌
- `eval_rubric_grade_agents_resource` table exists ❌
- `eval_eval_rubric_grade_agents` junction table exists ❌
- `eval_runs_rubric_grade_agents` table exists (references `rubric_grade_agent_id` directly) ✅
- `eval_groups_rubric_grade_agents` table exists (references `rubric_grade_agent_id` directly) ✅
- `runs_rubric_grade_agents` is NOT in resources enum ❌
- `groups_rubric_grade_agents` is NOT in resources enum ❌
- `runs_rubric_grade_agents_resource` table does NOT exist ❌
- `groups_rubric_grade_agents_resource` table does NOT exist ❌

**Required Actions**:
1. Add `runs_rubric_grade_agents` and `groups_rubric_grade_agents` to `resources` enum
2. Create `runs_rubric_grade_agents_resource` and `groups_rubric_grade_agents_resource` tables (similar structure to `scenario_rubric_grade_agents_resource`)
3. Add `eval` → `runs_rubric_grade_agents` and `eval` → `groups_rubric_grade_agents` entries to `artifact_resources`
4. Update `eval_runs_rubric_grade_agents` and `eval_groups_rubric_grade_agents` tables to reference resources instead of direct `rubric_grade_agent_id`
5. Remove `eval_rubric_grade_agents` from `artifact_resources` (for both `eval` and `simulation`)
6. Drop `eval_rubric_grade_agents_resource` table
7. Drop `eval_eval_rubric_grade_agents` junction table

### Issue 4: Provider Missing Values Resource

**Problem**: `provider` artifact should have `values` resource.

**Current State**:
- `values_resource` table EXISTS ✅
- `values` is NOT in resources enum ❌
- `provider` → `values` entry does NOT exist in `artifact_resources` ❌
- `provider_values` junction table does NOT exist ❌

**Required Actions**:
1. Add `values` to `resources` enum
2. Add `provider` → `values` entry to `artifact_resources`
3. Create `provider_values` junction table

### Issue 5: Tool Missing Names and Descriptions Resources

**Problem**: `tool` artifact should have `names` and `descriptions` resources (like other artifacts).

**Current State**:
- `tool` has resources: schemas, templates, tools
- `tool` does NOT have `names` resource ❌
- `tool` does NOT have `descriptions` resource ❌
- `tool_names` junction table EXISTS (but not connected via artifact_resources) ✅
- `tool_descriptions` junction table EXISTS (but not connected via artifact_resources) ✅

**Required Actions**:
1. Add `tool` → `names` entry to `artifact_resources`
2. Add `tool` → `descriptions` entry to `artifact_resources`
3. Verify `tool_names` and `tool_descriptions` junction tables have required columns

### Issue 6: Remove tool_tools Junction Table

**Problem**: `tool_tools` junction table should not exist - tools shouldn't link to tools resource.

**Current State**:
- `tool_tools` junction table EXISTS ❌
- `tool` → `tools` entry exists in `artifact_resources` ❌

**Required Actions**:
1. Remove `tool` → `tools` entry from `artifact_resources`
2. Drop `tool_tools` junction table

### Issue 7: tool_templates Missing Type Field

**Problem**: `tool_templates` junction table should have a `type` enum field for 'argument' or 'output'.

**Current State**:
- `tool_templates` junction table EXISTS ✅
- `tool_templates` does NOT have `type` column ❌
- Current columns: tool_id, template_id, created_at, updated_at, generated, mcp, active

**Required Actions**:
1. Create `type_tool_templates` enum type with values 'argument', 'output'
2. Add `type` column to `tool_templates` table (enum type, NOT NULL)

### Issue 8: Field Should Link to Parameters (Not conditional_parameters)

**Problem**: `field` artifact should NOT have a separate `conditional_parameters` resource. Instead, it should link to `parameters` resource with a `type` enum field on the junction table (value: 'conditional').

**Current State**:
- `field` has `conditional_parameters` resource in `artifact_resources` ❌
- `conditional_parameters_resource` table exists ❌
- `field_conditional_parameters` junction table exists ❌
- `field` does NOT have `parameters` resource ❌
- `field_parameters` junction table does NOT exist ❌

**Required Actions**:
1. Add `field` → `parameters` entry to `artifact_resources`
2. Create `field_parameters` junction table with:
   - `field_id` (uuid, NOT NULL)
   - `parameter_id` (uuid, NOT NULL)
   - `type` enum (NOT NULL) - with value 'conditional' (and potentially other types in future)
   - `active` (boolean, NOT NULL, DEFAULT true)
   - `created_at` (timestamptz, NOT NULL)
   - `updated_at` (timestamptz, NOT NULL)
   - `generated` (boolean, NOT NULL, DEFAULT false)
   - `mcp` (boolean, NOT NULL, DEFAULT false)
3. Migrate data from `field_conditional_parameters` to `field_parameters` (with type = 'conditional')
4. Remove `field` → `conditional_parameters` entry from `artifact_resources`
5. Drop `field_conditional_parameters` junction table
6. Consider dropping `conditional_parameters_resource` table if no longer needed (check if used elsewhere)

### Issue 9: Agent Missing reasoning_levels, temperature_levels, voices Resources

**Problem**: `agent` artifact should have `reasoning_levels`, `temperature_levels`, and `voices` resources (like `model` artifact has).

**Current State**:
- `agent` does NOT have `reasoning_levels` resource ❌
- `agent` does NOT have `temperature_levels` resource ❌
- `agent` does NOT have `voices` resource ❌
- `agent_reasoning_levels` junction table EXISTS ✅ (COMPLIANT - has all required columns, no call_id)
- `agent_temperature_levels` junction table EXISTS ✅ (COMPLIANT - has all required columns, no call_id)
- `agent_voices` junction table EXISTS ✅ (COMPLIANT - has all required columns, no call_id)
- Junction tables are already compliant but not connected via `artifact_resources`

**Required Actions**:
1. Add `agent` → `reasoning_levels` entry to `artifact_resources`
2. Add `agent` → `temperature_levels` entry to `artifact_resources`
3. Add `agent` → `voices` entry to `artifact_resources`
4. Junction tables are already compliant ✅ - no changes needed to table structure

### Issue 10: Rename simulation_scenario_flags to scenario_flags

**Problem**: `simulation_scenario_flags` resource should be called `scenario_flags`.

**Current State**:
- `simulation_scenario_flags` resource exists in `artifact_resources` (used by `simulation`) ❌
- `simulation_scenario_flags_resource` table exists ❌
- `simulation_simulation_scenario_flags` junction table exists ❌
- `scenario_flags` junction table exists (for `scenario` → `flags`) ✅

**Required Actions**:
1. Add `scenario_flags` to `resources` enum (if not already exists)
2. Create `scenario_flags_resource` table (or rename `simulation_scenario_flags_resource`)
3. Add `scenario` → `scenario_flags` entry to `artifact_resources` (if needed)
4. Create `scenario_scenario_flags` junction table (if needed)
5. Update `simulation` → `simulation_scenario_flags` to `simulation` → `scenario_flags` in `artifact_resources`
6. Rename `simulation_simulation_scenario_flags` to `simulation_scenario_flags` junction table
7. Drop `simulation_scenario_flags_resource` table (or rename to `scenario_flags_resource`)

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

### Priority 3: Fix Eval Resources
1. **Add `runs` and `groups` resources** for `eval`:
   - Add `runs` and `groups` to `resources` enum
   - Create `runs_resource` and `groups_resource` tables
   - Add `eval` → `runs` and `eval` → `groups` to `artifact_resources`
   - Create `eval_runs` and `eval_groups` junction tables

2. **Add `run_positions` and `group_positions` resources** for `eval`:
   - Add `run_positions` and `group_positions` to `resources` enum
   - Create `run_positions_resource` and `group_positions_resource` tables
   - Add entries to `artifact_resources`
   - Create `eval_run_positions` and `eval_group_positions` junction tables

3. **Replace `eval_rubric_grade_agents` with `runs_rubric_grade_agents` and `groups_rubric_grade_agents`**:
   - Add `runs_rubric_grade_agents` and `groups_rubric_grade_agents` to `resources` enum
   - Create resource tables (similar to `scenario_rubric_grade_agents_resource`)
   - Add entries to `artifact_resources` for `eval`
   - Update existing `eval_runs_rubric_grade_agents` and `eval_groups_rubric_grade_agents` tables to reference resources
   - Remove `eval_rubric_grade_agents` from `artifact_resources` (for both `eval` and `simulation`)
   - Drop `eval_rubric_grade_agents_resource` table and `eval_eval_rubric_grade_agents` junction table

### Priority 4: Fix Provider and Tool Resources
1. **Add `values` resource to `provider`**:
   - Add `values` to `resources` enum
   - Add `provider` → `values` entry to `artifact_resources`
   - Create `provider_values` junction table

2. **Add `names` and `descriptions` resources to `tool`**:
   - Add `tool` → `names` entry to `artifact_resources`
   - Add `tool` → `descriptions` entry to `artifact_resources`
   - Verify `tool_names` and `tool_descriptions` junction tables have required columns

3. **Remove `tool_tools`**:
   - Remove `tool` → `tools` entry from `artifact_resources`
   - Drop `tool_tools` junction table

4. **Add `type` field to `tool_templates`**:
   - Create `type_tool_templates` enum type ('argument', 'output')
   - Add `type` column to `tool_templates` table

### Priority 5: Fix Field conditional_parameters Issue
1. **Replace `conditional_parameters` with `parameters` for field**:
   - Add `field` → `parameters` entry to `artifact_resources`
   - Create `type_field_parameters` enum type with value 'conditional' (and potentially others)
   - Create `field_parameters` junction table with `type` enum column
   - Migrate data from `field_conditional_parameters` to `field_parameters` (with type = 'conditional')
   - Remove `field` → `conditional_parameters` entry from `artifact_resources`
   - Drop `field_conditional_parameters` junction table
   - Consider dropping `conditional_parameters_resource` table if no longer needed

### Priority 6: Fix Agent Missing Resources
1. **Add resources to `agent` artifact**:
   - Add `agent` → `reasoning_levels` entry to `artifact_resources`
   - Add `agent` → `temperature_levels` entry to `artifact_resources`
   - Add `agent` → `voices` entry to `artifact_resources`
   - Verify `agent_reasoning_levels`, `agent_temperature_levels`, and `agent_voices` junction tables have all required columns (they already exist and appear compliant)

### Priority 7: Fix simulation_scenario_flags Naming
1. **Rename `simulation_scenario_flags` to `scenario_flags`**:
   - Add `scenario_flags` to `resources` enum (if not exists)
   - Rename `simulation_scenario_flags_resource` to `scenario_flags_resource` (or create new)
   - Update `simulation` → `simulation_scenario_flags` to `simulation` → `scenario_flags` in `artifact_resources`
   - Rename `simulation_simulation_scenario_flags` to `simulation_scenario_flags` junction table
   - Add `scenario` → `scenario_flags` entry to `artifact_resources` if needed
   - Create `scenario_scenario_flags` junction table if needed

### Priority 8: Verify Compliance
- All 9 compliant junction tables serve as examples of the correct structure
- Once all junction tables have `generated` and `mcp` columns added, compliance should be achieved
