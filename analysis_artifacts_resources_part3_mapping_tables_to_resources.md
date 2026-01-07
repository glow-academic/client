# Artifacts/Resources Analysis - Part 3: Mapping Tables to Resources

## Overview

Mapping all tables related to the 17 core graph components to resources. Each table that belongs to an artifact becomes a resource.

## Mapping Strategy

**Key Concept**: 
- **Artifacts** = Singular form of strong entity table names (`scenario`, `persona`, `department`, `profile`)
- **Resources** = Plural form of table names (`personas`, `departments`, `emails`, `names`)
- **Junction tables** = `{artifact}_{resource}` pattern where artifact is singular and resource is plural (e.g., `scenario_personas`, `profile_departments`)
- **Shared Resources** = Resources that represent reusable UI components, shared across multiple artifacts (e.g., `colors`, `flags`, `icons`, `content`)

1. **Junction tables** → Resources are the referenced table names in plural form (e.g., `cohort_departments` junction table → resource is `departments`, from `departments` table)
2. **Attribute tables** → Resources are the attribute table names in plural form (e.g., `names` table → resource is `names`)
3. **Related entity tables** → Resources are the table names in plural form (e.g., `objectives` table → resource is `objectives`)
4. **Sub-entity tables** → Resources are the table names in plural form (e.g., `auth_items` table → resource is `auth_items`)
5. **Artifacts as resources**: When an artifact table is referenced by another artifact, the table name (plural) becomes the resource (e.g., `documents` table (artifact `document`) → resource is `documents` when referenced by `scenario`)
6. **Shared resources**: Resources that can be reused across artifacts (see `analysis_shared_resources_strategy.md` for details):
   - `colors` - shared by `settings` and `personas`
   - `flags` - unified boolean flags used by all artifacts
   - `icons` - shared by `personas` and `flags`
   - `content` - shared by `documents` and `messages` (merged with existing `content` table)

## Important: Artifacts Can Be Resources

**Key Concept**: An entity can be both an artifact (top-level strong entity table, singular name) AND a resource (when its table is referenced by another artifact, plural name).

**Examples**:
- `personas` table → artifact: `persona` (singular)
- `personas` table → resource: `personas` (plural, when referenced by `scenario` via `scenario_personas` junction table)
- `documents` table → artifact: `document` (singular)
- `documents` table → resource: `documents` (plural, when referenced by `scenario` via `scenario_documents` junction table)
- `fields` table → artifact: `field` (singular)
- `fields` table → resource: `fields` (plural, when referenced by `document` via `document_fields` junction table)

**Pattern**: 
- Artifacts = Singular form of strong entity table names (`scenario`, `persona`, `document`, `field`, `profile`)
- Resources = Plural form of table names (`personas`, `departments`, `emails`, `names`, `fields`)
- Junction tables = `{artifact_singular}_{resource_plural}` (e.g., `scenario_personas` links `scenario` artifact to `personas` resource)

## Resource Naming Convention

- **Plural form**: Resources are always plural, matching the actual table names (e.g., `departments` table → `departments` resource)
- **Table-based**: Resources come from actual table names (e.g., `departments` table → `departments` resource)
- **Artifact tables as resources**: When an artifact table is referenced, use its table name (plural) as the resource (e.g., `personas` table (artifact `persona`) → `personas` resource)
- **Junction table pattern**: Junction tables follow `{artifact_singular}_{resource_plural}` pattern (e.g., `scenario_personas` links `scenario` artifact to `personas` resource)

## Mapping by Artifact

### 1. Cohort Artifact

**Artifact**: `cohort` (from `cohorts` table)

**Tables to map**:
- `cohorts` (main table - artifact itself)
- `cohort_departments` → Resource: `departments` (from `departments` table)
- `cohort_profiles` → Resource: `profiles` (from `profiles` table, artifact `profile`)
- `cohort_simulations` → Resource: `simulations` (from `simulations` table, artifact `simulation`)
- `cohort_names` (from denormalization) → Resource: `names` (from `names` table)
- `cohort_descriptions` (from denormalization) → Resource: `descriptions` (from `descriptions` table)
- `cohort_active_flags` (from denormalization) → Resource: `active_flags` (from `active_flags` table)

**Proposed Resources**:
- `departments` (from `departments` table)
- `profiles` (from `profiles` table, also an artifact `profile`)
- `simulations` (from `simulations` table, also an artifact `simulation`)
- `names` (from `names` table)
- `descriptions` (from `descriptions` table)
- `active_flags` (from `active_flags` table)

### 2. Simulation Artifact

**Artifact**: `simulation` (from `simulations` table)

**Tables to map**:
- `simulations` (main table - artifact itself)
- `simulation_departments` → Resource: `departments` (from `departments` table)
- `simulation_scenarios` → Resource: `scenarios` (from `scenarios` table, artifact `scenario`)
- `simulation_scenarios_rubric_grade_agents` → Resource: `rubric_grade_agents` (from `rubric_grade_agents` table)
- `simulation_attempts` → Resource: `simulation_attempts` (from `simulation_attempts` table)
- `simulation_names` (from denormalization) → Resource: `names` (from `names` table)
- `simulation_descriptions` (from denormalization) → Resource: `descriptions` (from `descriptions` table)
- `simulation_flags` → Resource: `flags` (from `flags` table, shared resource, consolidated junction table with `type_simulation_flags` enum: 'active', 'practice')
- `simulation_domains` → Resource: `domains` (from `domains` table, consolidated junction table with `type_simulation_domains` enum: 'text', 'voice')

**Proposed Resources**:
- `departments` (from `departments` table)
- `scenarios` (from `scenarios` table, also an artifact `scenario`)
- `rubric_grade_agents` (from `rubric_grade_agents` table)
- `simulation_attempts` (from `simulation_attempts` table)
- `names` (from `names` table)
- `descriptions` (from `descriptions` table)
- `flags` (from `flags` table, shared resource - via `simulation_flags` junction table with `type_simulation_flags` enum)
- `domains` (from `domains` table - via `simulation_domains` junction table with `type_simulation_domains` enum)

### 3. Scenario Artifact (Already Exists)

**Artifact**: `scenario` (from `scenarios` table)

**Tables to map**:
- `scenarios` (main table - artifact itself)
- `scenario_departments` → Resource: `departments` (from `departments` table)
- `scenario_documents` → Resource: `documents` (from `documents` table, artifact `document`)
- `scenario_document_ranges` → Resource: `scenario_document_ranges` (from `scenario_document_ranges` table)
- `scenario_personas` → Resource: `personas` (from `personas` table, artifact `persona`)
- `scenario_persona_ranges` → Resource: `scenario_persona_ranges` (from `scenario_persona_ranges` table)
- `scenario_parameters` → Resource: `parameters` (from `parameters` table, artifact `parameter`)
- `scenario_parameter_ranges` → Resource: `scenario_parameter_ranges` (from `scenario_parameter_ranges` table)
- `scenario_fields` → Resource: `fields` (from `fields` table, artifact `field`)
- `scenario_field_ranges` → Resource: `scenario_field_ranges` (from `scenario_field_ranges` table)
- `scenario_objectives` → Resource: `objectives` (from `objectives` table)
- `scenario_problem_statements` → Resource: `problem_statements` (from `problem_statements` table)
- `scenario_questions` → Resource: `questions` (from `questions` table)
- `scenario_images` → Resource: `images` (from `images` table)
- `scenario_videos` → Resource: `videos` (from `videos` table)
- `scenario_templates` → Resource: `templates` (from `templates` table)
- `scenario_groups` → Resource: `groups` (from `groups` table)
- `scenario_time_limits` → Resource: `scenario_time_limits` (from `scenario_time_limits` table)
- `scenario_tree` → Resource: `scenario_tree` (from `scenario_tree` table)
- `scenario_video_images` → Resource: `scenario_video_images` (from `scenario_video_images` table)
- `scenario_options` → Resource: `options` (from `options` table)
- `scenario_names` (from denormalization) → Resource: `names` (from `names` table)
- `scenario_descriptions` (from denormalization) → Resource: `descriptions` (from `descriptions` table)
- `scenario_flags` → Resource: `flags` (from `flags` table, shared resource, consolidated junction table with `type_scenario_flags` enum: 'active', 'objectives_enabled', 'images_enabled', 'video_enabled', 'questions_enabled', 'problem_statement_enabled')
- ❌ `scenario_generated_flags` → REMOVED (pruned)
- `scenario_domains` → Resource: `domains` (from `domains` table, consolidated junction table with `type_scenario_domains` enum: 'default', 'video', 'image')

**Proposed Resources**:
- `departments` (from `departments` table)
- `documents` (from `documents` table, also an artifact `document`)
- `scenario_document_ranges`, `scenario_persona_ranges`, `scenario_parameter_ranges`, `scenario_field_ranges` (from range tables)
- `personas` (from `personas` table, also an artifact `persona`)
- `parameters` (from `parameters` table, also an artifact `parameter`)
- `fields` (from `fields` table, also an artifact `field`)
- `objectives`, `problem_statements`, `questions`, `images`, `videos`, `templates`, `options` (from respective tables)
- `groups` (from `groups` table)
- `scenario_time_limits`, `scenario_tree`, `scenario_video_images` (from scenario-specific tables)
- `names`, `descriptions` (from attribute tables)
- `flags` (from `flags` table, shared resource - via `scenario_flags` junction table with `type_scenario_flags` enum)
- `domains` (from `domains` table - via `scenario_domains` junction table with `type_scenario_domains` enum)

### 4. Persona Artifact

**Artifact**: `persona` (from `personas` table)

**Tables to map**:
- `personas` (main table - artifact itself)
- `persona_departments` → Resource: `departments` (from `departments` table)
- `persona_examples` → Resource: `examples` (from `examples` table)
- `persona_fields` → Resource: `fields` (from `fields` table, artifact `field`)
- `persona_names` (from denormalization) → Resource: `names` (from `names` table)
- `persona_descriptions` (from denormalization) → Resource: `descriptions` (from `descriptions` table)
- `persona_colors` (from denormalization) → Resource: `colors` (from `colors` table, shared resource)
- `persona_icons` (from denormalization) → Resource: `icons` (from `icons` table, shared resource)
- `persona_instructions` (from denormalization) → Resource: `instructions` (from `instructions` table)
- `persona_active_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="active")

**Proposed Resources**:
- `departments` (from `departments` table)
- `examples` (from `examples` table)
- `fields` (from `fields` table, also an artifact `field`)
- `names` (from `names` table)
- `descriptions` (from `descriptions` table)
- `colors` (from `colors` table, shared resource - used by settings and personas)
- `icons` (from `icons` table, shared resource - used by personas and flags)
- `instructions` (from `instructions` table)
- `flags` (from `flags` table, shared resource - unified boolean flags)

### 5. Document Artifact (Already Exists)

**Artifact**: `document` (from `documents` table)

**Tables to map**:
- `documents` (main table - artifact itself)
- `document_departments` → Resource: `departments` (from `departments` table)
- `document_fields` → Resource: `fields` (from `fields` table, artifact `field`)
- `document_groups` → Resource: `groups` (from `groups` table)
- `document_html` → Resource: `html` (from `html` table - note: `html` is singular table name)
- `document_schemas` → Resource: `schemas` (from `schemas` table)
- `document_templates` → Resource: `templates` (from `templates` table)
- `document_tree` → Resource: `document_tree` (from `document_tree` table)
- `document_uploads` → Resource: `uploads` (from `uploads` table)
- `document_names` (from denormalization) → Resource: `names` (from `names` table)
- `document_descriptions` (from denormalization) → Resource: `descriptions` (from `descriptions` table)
- `document_document_contents` (from denormalization) → Resource: `content` (from `content` table, shared resource - merged with existing `content` table)
- `document_active_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="active")
- `document_template_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="template")
- `document_domains` → Resource: `domains` (from `domains` table)

**Proposed Resources**:
- `departments` (from `departments` table)
- `fields` (from `fields` table, also an artifact `field`)
- `groups` (from `groups` table)
- `html` (from `html` table - singular table name)
- `schemas` (from `schemas` table)
- `templates` (from `templates` table)
- `document_tree` (from `document_tree` table)
- `uploads` (from `uploads` table)
- `names` (from `names` table)
- `descriptions` (from `descriptions` table)
- `content` (from `content` table, shared resource - merged with existing `content` table, used by documents and messages)
- `flags` (from `flags` table, shared resource - unified boolean flags)
- `domains` (from `domains` table)

### 6. Parameter Artifact

**Artifact**: `parameter` (from `parameters` table)

**Tables to map**:
- `parameters` (main table - artifact itself)
- `parameter_departments` → Resource: `departments` (from `departments` table)
- `parameter_names` (from denormalization) → Resource: `names` (from `names` table)
- `parameter_descriptions` (from denormalization) → Resource: `descriptions` (from `descriptions` table)
- `parameter_active_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="active")
- `parameter_document_parameter_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="document_parameter")
- `parameter_persona_parameter_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="persona_parameter")
- `parameter_scenario_parameter_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="scenario_parameter")
- `parameter_video_parameter_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="video_parameter")
- `parameter_simulation_parameter_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="simulation_parameter")

**Proposed Resources**:
- `departments` (from `departments` table)
- `names` (from `names` table)
- `descriptions` (from `descriptions` table)
- `flags` (from `flags` table, shared resource - unified boolean flags)

### 7. Field Artifact

**Artifact**: `field` (from `fields` table)

**Tables to map**:
- `fields` (main table - artifact itself)
- `field_departments` → Resource: `departments` (from `departments` table)
- `field_conditional_parameters` → Resource: `field_conditional_parameters` (from `field_conditional_parameters` table, which references `parameters` table)
- `field_names` (from denormalization) → Resource: `names` (from `names` table)
- `field_descriptions` (from denormalization) → Resource: `descriptions` (from `descriptions` table)
- `field_active_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="active")
- `field_parameters` → Resource: `parameters` (from `parameters` table, artifact `parameter`)

**Proposed Resources**:
- `departments` (from `departments` table)
- `field_conditional_parameters` (from `field_conditional_parameters` table, references `parameters`)
- `names` (from `names` table)
- `descriptions` (from `descriptions` table)
- `flags` (from `flags` table, shared resource - unified boolean flags)
- `parameters` (from `parameters` table, also an artifact `parameter`)

**Note**: `field` is both an artifact (singular) and a resource (plural `fields`). When `field` artifact is referenced by `document` artifact via `document_fields` junction table, the resource is `fields`.

### 8. Agent Artifact (Already Exists)

**Artifact**: `agent` (from `agents` table)

**Tables to map**:
- `agents` (main table - artifact itself)
- `agent_departments` → Resource: `departments` (from `departments` table)
- `agent_prompts` → Resource: `prompts` (from `prompts` table)
- `agent_department_prompts` → Resource: `agent_department_prompts` (from `agent_department_prompts` table)
- `agent_developer_instructions` → Resource: `developer_instructions` (from `developer_instructions` table)
- `agent_tools` → Resource: `tools` (from `tools` table)
- `agent_reasoning_levels` → Resource: `model_reasoning_levels` (from `model_reasoning_levels` table)
- `agent_temperature_levels` → Resource: `model_temperature_levels` (from `model_temperature_levels` table)
- `agent_voices` → Resource: `model_voices` (from `model_voices` table)
- `agent_names` (from denormalization) → Resource: `names` (from `names` table)
- `agent_descriptions` (from denormalization) → Resource: `descriptions` (from `descriptions` table)
- `agent_active_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="active")
- `agent_models` → Resource: `models` (from `models` table, artifact `model`)

**Proposed Resources**:
- `departments` (from `departments` table)
- `prompts` (from `prompts` table)
- `agent_department_prompts` (from `agent_department_prompts` table)
- `developer_instructions` (from `developer_instructions` table)
- `tools` (from `tools` table)
- `model_reasoning_levels` (from `model_reasoning_levels` table)
- `model_temperature_levels` (from `model_temperature_levels` table)
- `model_voices` (from `model_voices` table)
- `names` (from `names` table)
- `descriptions` (from `descriptions` table)
- `flags` (from `flags` table, shared resource - unified boolean flags)
- `models` (from `models` table, also an artifact `model`)

### 9. Model Artifact

**Artifact**: `model` (from `models` table)

**Tables to map**:
- `models` (main table - artifact itself)
- `model_departments` → Resource: `departments` (from `departments` table)
- `model_endpoints` → Resource: `model_endpoints` (from `model_endpoints` table)
- `model_modalities` → Resource: `model_modalities` (from `model_modalities` table)
- `model_pricing` → Resource: `model_pricing` (from `model_pricing` table)
- `model_qualities` → Resource: `model_qualities` (from `model_qualities` table)
- `model_reasoning_levels` → Resource: `model_reasoning_levels` (from `model_reasoning_levels` table)
- `model_temperature_levels` → Resource: `model_temperature_levels` (from `model_temperature_levels` table)
- `model_voices` → Resource: `model_voices` (from `model_voices` table)
- `model_names` (from denormalization) → Resource: `names` (from `names` table)
- `model_descriptions` (from denormalization) → Resource: `descriptions` (from `descriptions` table)
- `model_values` (from denormalization) → Resource: `values` (from `values` table)
- `model_active_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="active")
- `model_providers` → Resource: `providers` (from `providers` table, artifact `provider`)

**Proposed Resources**:
- `departments` (from `departments` table)
- `model_endpoints` (from `model_endpoints` table)
- `model_modalities` (from `model_modalities` table)
- `model_pricing` (from `model_pricing` table)
- `model_qualities` (from `model_qualities` table)
- `model_reasoning_levels` (from `model_reasoning_levels` table)
- `model_temperature_levels` (from `model_temperature_levels` table)
- `model_voices` (from `model_voices` table)
- `names` (from `names` table)
- `descriptions` (from `descriptions` table)
- `values` (from `values` table)
- `flags` (from `flags` table, shared resource - unified boolean flags)
- `providers` (from `providers` table, also an artifact `provider`)

### 10. Rubric Artifact (Already Exists)

**Artifact**: `rubric` (from `rubrics` table)

**Tables to map**:
- `rubrics` (main table - artifact itself)
- `rubric_departments` → Resource: `departments` (from `departments` table)
- `rubric_groups` → Resource: `groups` (from `groups` table)
- `rubric_standard_groups` → Resource: `standard_groups` (from `standard_groups` table)
- `rubric_grade_agents` → Resource: `rubric_grade_agents` (from `rubric_grade_agents` table)
- `rubric_grade_agents_audio` → Resource: `rubric_grade_agents_audio` (from `rubric_grade_agents_audio` table)
- `rubric_names` (from denormalization) → Resource: `names` (from `names` table)
- `rubric_descriptions` (from denormalization) → Resource: `descriptions` (from `descriptions` table)
- `rubric_points` (from denormalization) → Resource: `points` (from `points` table)
- `rubric_pass_points` (from denormalization) → Resource: `pass_points` (from `pass_points` table)
- `rubric_active_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="active")
- `rubric_artifacts` (from denormalization) → Resource: `artifacts` (from artifacts enum - note: enum name is plural)
- `rubric_domains` → Resource: `domains` (from `domains` table)

**Proposed Resources**:
- `departments` (from `departments` table)
- `groups` (from `groups` table)
- `standard_groups` (from `standard_groups` table)
- `rubric_grade_agents` (from `rubric_grade_agents` table)
- `rubric_grade_agents_audio` (from `rubric_grade_agents_audio` table)
- `names` (from `names` table)
- `descriptions` (from `descriptions` table)
- `points` (from `points` table - via `rubric_points` junction table with `type_rubric_points` enum: 'total', 'pass')
- `flags` (from `flags` table, shared resource - via `rubric_flags` junction table with `type_rubric_flags` enum)
- `artifacts` (from artifacts enum)
- `domains` (from `domains` table)

### 11. Eval Artifact

**Artifact**: `eval` (from `evals` table)

**Tables to map**:
- `evals` (main table - artifact itself)
- `eval_departments` → Resource: `departments` (from `departments` table)
- `eval_agents` → Resource: `agents` (from `agents` table, artifact `agent`)
- `eval_groups` → Resource: `groups` (from `groups` table)
- `eval_groups_rubric_grade_agents` → Resource: `rubric_grade_agents` (from `rubric_grade_agents` table)
- `eval_runs` → Resource: `runs` (from `runs` table, artifact `run`)
- `eval_runs_rubric_grade_agents` → Resource: `rubric_grade_agents` (from `rubric_grade_agents` table)
- `eval_attempts` → Resource: `eval_attempts` (from `eval_attempts` table)
- `eval_names` (from denormalization) → Resource: `names` (from `names` table)
- `eval_descriptions` (from denormalization) → Resource: `descriptions` (from `descriptions` table)
- `eval_flags` → Resource: `flags` (from `flags` table, shared resource, consolidated junction table with `type_eval_flags` enum: 'active', 'dynamic', 'groups')

**Proposed Resources**:
- `departments` (from `departments` table)
- `agents` (from `agents` table, also an artifact `agent`)
- `groups` (from `groups` table)
- `rubric_grade_agents` (from `rubric_grade_agents` table)
- `runs` (from `runs` table, also an artifact `run`)
- `eval_attempts` (from `eval_attempts` table)
- `names` (from `names` table)
- `descriptions` (from `descriptions` table)
- `flags` (from `flags` table, shared resource - unified boolean flags)

### 12. Department Artifact

**Artifact**: `department` (from `departments` table)

**Tables to map**:
- `departments` (main table - artifact itself)
- `department_settings` → Resource: `settings` (from `settings` table, artifact `setting`)
- `department_names` (from denormalization) → Resource: `names` (from `names` table)
- `department_descriptions` (from denormalization) → Resource: `descriptions` (from `descriptions` table)
- `department_active_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="active")

**Proposed Resources**:
- `settings` (from `settings` table, also an artifact `setting`)
- `names` (from `names` table)
- `descriptions` (from `descriptions` table)
- `active_flags` (from `active_flags` table)

### 13. Provider Artifact

**Artifact**: `provider` (from `providers` table)

**Tables to map**:
- `providers` (main table - artifact itself)
- `provider_endpoints` → Resource: `provider_endpoints` (from `provider_endpoints` table)
- `provider_names` (from denormalization) → Resource: `names` (from `names` table)
- `provider_descriptions` (from denormalization) → Resource: `descriptions` (from `descriptions` table)
- `provider_values` (from denormalization) → Resource: `values` (from `values` table)
- `provider_active_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="active")

**Proposed Resources**:
- `provider_endpoints` (from `provider_endpoints` table)
- `names` (from `names` table)
- `descriptions` (from `descriptions` table)
- `values` (from `values` table)
- `flags` (from `flags` table, shared resource - unified boolean flags)

### 14. Auth Artifact

**Artifact**: `auth` (from `auth` table)

**Tables to map**:
- `auth` (main table - artifact itself)
- `auth_items` → Resource: `auth_items` (from `auth_items` table)
- `auth_names` (from denormalization) → Resource: `names` (from `names` table)
- `auth_descriptions` (from denormalization) → Resource: `descriptions` (from `descriptions` table)
- `auth_slugs` (from denormalization) → Resource: `slugs` (from `slugs` table)
- `auth_icon_urls` (from denormalization) → Resource: `icon_urls` (from `icon_urls` table)
- `auth_active_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="active")
- `auth_auth_types` (from denormalization) → Resource: `auth_types` (from `auth_types` table)

**Proposed Resources**:
- `auth_items` (from `auth_items` table)
- `names` (from `names` table)
- `descriptions` (from `descriptions` table)
- `slugs` (from `slugs` table)
- `icon_urls` (from `icon_urls` table)
- `flags` (from `flags` table, shared resource - unified boolean flags)
- `auth_types` (from `auth_types` table)

### 15. Key Artifact

**Artifact**: `key` (from `keys` table)

**Tables to map**:
- `keys` (main table - artifact itself)
- `key_names` (from denormalization) → Resource: `names` (from `names` table)
- `key_descriptions` (from denormalization) → Resource: `descriptions` (from `descriptions` table)
- `key_keys` (from denormalization) → Resource: `key_values` (from `key_values` table)
- `key_active_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="active")

**Proposed Resources**:
- `names` (from `names` table)
- `descriptions` (from `descriptions` table)
- `key_values` (from `key_values` table)
- `flags` (from `flags` table, shared resource - unified boolean flags)

### 16. Setting Artifact

**Artifact**: `setting` (from `settings` table)

**Tables to map**:
- `settings` (main table - artifact itself)
- `setting_auths` → Resource: `auth` (from `auth` table, artifact `auth` - note: `auth` is singular table name)
- `setting_auth_keys` → Resource: `setting_auth_keys` (from `setting_auth_keys` table)
- `setting_auth_values` → Resource: `setting_auth_values` (from `setting_auth_values` table)
- `setting_providers` → Resource: `providers` (from `providers` table, artifact `provider`)
- `setting_provider_keys` → Resource: `setting_provider_keys` (from `setting_provider_keys` table)
- `settings_default_account` → Resource: `settings_default_account` (from `settings_default_account` table)
- `settings_default_department` → Resource: `settings_default_department` (from `settings_default_department` table)
- `settings_default_guest` → Resource: `settings_default_guest` (from `settings_default_guest` table)
- `setting_names` (from denormalization) → Resource: `names` (from `names` table)
- `setting_descriptions` (from denormalization) → Resource: `descriptions` (from `descriptions` table)
- `setting_active_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="active")
- `setting_guest_login_enabled_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="guest_login_enabled")
- `setting_primary_colors` (from denormalization) → Resource: `colors` (from `colors` table, shared resource, type="primary")
- `setting_accent_colors` (from denormalization) → Resource: `colors` (from `colors` table, shared resource, type="accent")
- `setting_background_colors` (from denormalization) → Resource: `colors` (from `colors` table, shared resource, type="background")
- `setting_surface_colors` (from denormalization) → Resource: `colors` (from `colors` table, shared resource, type="surface")
- `setting_success_colors` (from denormalization) → Resource: `colors` (from `colors` table, shared resource, type="success")
- `setting_warning_colors` (from denormalization) → Resource: `colors` (from `colors` table, shared resource, type="warning")
- `setting_error_colors` (from denormalization) → Resource: `colors` (from `colors` table, shared resource, type="error")
- `setting_sidebar_background_colors` (from denormalization) → Resource: `colors` (from `colors` table, shared resource, type="sidebar_background")
- `setting_sidebar_primary_colors` (from denormalization) → Resource: `colors` (from `colors` table, shared resource, type="sidebar_primary")
- `setting_chart1_colors` (from denormalization) → Resource: `colors` (from `colors` table, shared resource, type="chart1")
- `setting_chart2_colors` (from denormalization) → Resource: `colors` (from `colors` table, shared resource, type="chart2")
- `setting_chart3_colors` (from denormalization) → Resource: `colors` (from `colors` table, shared resource, type="chart3")
- `setting_chart4_colors` (from denormalization) → Resource: `colors` (from `colors` table, shared resource, type="chart4")
- `setting_chart5_colors` (from denormalization) → Resource: `colors` (from `colors` table, shared resource, type="chart5")
- `setting_success_thresholds` (from denormalization) → Resource: `success_thresholds` (from `success_thresholds` table)
- `setting_warning_thresholds` (from denormalization) → Resource: `warning_thresholds` (from `warning_thresholds` table)
- `setting_danger_thresholds` (from denormalization) → Resource: `danger_thresholds` (from `danger_thresholds` table)

**Proposed Resources**: ~15+ unique resources for settings (many junction tables reference same resources)
- `auth` (from `auth` table, also an artifact `auth` - singular table name)
- `setting_auth_keys`, `setting_auth_values` (from setting junction tables)
- `providers` (from `providers` table, also an artifact `provider`)
- `setting_provider_keys` (from setting junction table)
- `settings_default_account`, `settings_default_department`, `settings_default_guest` (from settings default tables)
- `names`, `descriptions` (from attribute tables)
- `flags` (from `flags` table, shared resource - unified boolean flags)
- `colors` (from `colors` table, shared resource - used by settings and personas)
- `success_thresholds`, `warning_thresholds`, `danger_thresholds` (from threshold tables)

### 17. Profile Artifact

**Artifact**: `profile` (from `profiles` table)

**Tables to map**:
- `profiles` (main table - artifact itself)
- `profile_departments` → Resource: `departments` (from `departments` table)
- `profile_emails` → Resource: `profile_emails` (from `profile_emails` table)
- `profile_activity` → Resource: `profile_activity` (from `profile_activity` table)
- `profile_request_limits` → Resource: `profile_request_limits` (from `profile_request_limits` table)
- `profile_first_names` (from denormalization) → Resource: `first_names` (from `first_names` table)
- `profile_last_names` (from denormalization) → Resource: `last_names` (from `last_names` table)
- `profile_active_flags` (from denormalization) → Resource: `flags` (from `flags` table, shared resource, flag name="active")
- `profile_roles` (from denormalization) → Resource: `profile_roles` (from `profile_roles` table or enum)
- `profile_last_logins` (from denormalization) → Resource: `last_logins` (from `last_logins` table)

**Proposed Resources**:
- `departments` (from `departments` table)
- `profile_emails` (from `profile_emails` table)
- `profile_activity` (from `profile_activity` table)
- `profile_request_limits` (from `profile_request_limits` table)
- `first_names` (from `first_names` table)
- `last_names` (from `last_names` table)
- `flags` (from `flags` table, shared resource - unified boolean flags)
- `profile_roles` (from `profile_roles` table/enum)
- `last_logins` (from `last_logins` table)

## Summary

**Total Resources Needed**: ~200+ resources (estimated)

**Breakdown**:
- Junction table resources: ~100+
- Attribute resources (from denormalization): ~100+
- Existing resources that can be reused: ~10-15

## Next Steps

See Part 4 for migration strategy.

