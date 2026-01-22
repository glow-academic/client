# Database Migration Plan: Cleanup & Junction Table Renaming

## Overview

This migration will:
1. Drop unnecessary tables
2. Fix `entry_type` enum (remove unused values, add missing values)
3. Rename all junction tables to add `_junction` suffix for clarity

---

## Part 1: Tables to Drop

### 1.1 `debug_info_draft`
- **Reason**: `debug_info` is an entry (`debug_info_entry` exists), not a resource. Only resources should have `_draft` tables.
- **Current data**: 0 rows

### 1.2 `settings_default_department`
- **Reason**: Redundant junction table. Settings already link to departments via `setting_departments`.
- **Current data**: 1 row
- **Code impact**: Used in `server/app/sql/v4/auth/get_login_data_complete.sql`
  - Will need to update SQL to use `setting_departments` with a flag, or remove default department concept

---

## Part 2: Entry Type Enum Changes

### 2a. Values to REMOVE (no corresponding `_entry` table):

| Enum Value | Action |
|------------|--------|
| `analytics` | Remove |
| `conversations` | Remove |
| `profile_activity` | Remove |
| `times` | Remove |

### 2b. Values to ADD (have `_entry` table but missing from enum):

| Entry Table | Enum Value to Add |
|-------------|-------------------|
| `audits_entry` | `audits` |
| `debug_info_entry` | `debug_info` |
| `grants_entry` | `grants` |
| `tests_entry` | `tests` |

**Note**: Removing enum values in PostgreSQL requires recreating the type.

---

## Part 3: Junction Tables to Rename (133 tables + 6 complex junctions)

All tables following the `{artifact}_{resource}`, `{artifact}_{entry}`, or `{artifact}_{artifact}` pattern will get a `_junction` suffix.

### Agent Junction Tables (11 tables)
| Current Name | New Name |
|--------------|----------|
| `agent_departments` | `agent_departments_junction` |
| `agent_descriptions` | `agent_descriptions_junction` |
| `agent_flags` | `agent_flags_junction` |
| `agent_instructions` | `agent_instructions_junction` |
| `agent_models` | `agent_models_junction` |
| `agent_names` | `agent_names_junction` |
| `agent_prompts` | `agent_prompts_junction` |
| `agent_reasoning_levels` | `agent_reasoning_levels_junction` |
| `agent_temperature_levels` | `agent_temperature_levels_junction` |
| `agent_tools` | `agent_tools_junction` |
| `agent_voices` | `agent_voices_junction` |

### Auth Junction Tables (6 tables)
| Current Name | New Name |
|--------------|----------|
| `auth_descriptions` | `auth_descriptions_junction` |
| `auth_flags` | `auth_flags_junction` |
| `auth_items` | `auth_items_junction` |
| `auth_names` | `auth_names_junction` |
| `auth_protocols` | `auth_protocols_junction` |
| `auth_slugs` | `auth_slugs_junction` |

### Cohort Junction Tables (6 tables)
| Current Name | New Name |
|--------------|----------|
| `cohort_departments` | `cohort_departments_junction` |
| `cohort_descriptions` | `cohort_descriptions_junction` |
| `cohort_flags` | `cohort_flags_junction` |
| `cohort_names` | `cohort_names_junction` |
| `cohort_simulation_positions` | `cohort_simulation_positions_junction` |
| `cohort_simulations` | `cohort_simulations_junction` |

### Department Junction Tables (4 tables)
| Current Name | New Name |
|--------------|----------|
| `department_descriptions` | `department_descriptions_junction` |
| `department_flags` | `department_flags_junction` |
| `department_names` | `department_names_junction` |
| `department_settings` | `department_settings_junction` |

### Document Junction Tables (7 tables)
| Current Name | New Name |
|--------------|----------|
| `document_departments` | `document_departments_junction` |
| `document_descriptions` | `document_descriptions_junction` |
| `document_fields` | `document_fields_junction` |
| `document_flags` | `document_flags_junction` |
| `document_groups` | `document_groups_junction` |
| `document_names` | `document_names_junction` |
| `document_parameters` | `document_parameters_junction` |

### Eval Junction Tables (11 tables)
| Current Name | New Name |
|--------------|----------|
| `eval_agents` | `eval_agents_junction` |
| `eval_departments` | `eval_departments_junction` |
| `eval_descriptions` | `eval_descriptions_junction` |
| `eval_flags` | `eval_flags_junction` |
| `eval_group_positions` | `eval_group_positions_junction` |
| `eval_groups` | `eval_groups_junction` |
| `eval_groups_rubrics` | `eval_groups_rubrics_junction` |
| `eval_names` | `eval_names_junction` |
| `eval_run_positions` | `eval_run_positions_junction` |
| `eval_runs` | `eval_runs_junction` |
| `eval_runs_rubrics` | `eval_runs_rubrics_junction` |

### Field Junction Tables (5 tables)
| Current Name | New Name |
|--------------|----------|
| `field_departments` | `field_departments_junction` |
| `field_descriptions` | `field_descriptions_junction` |
| `field_flags` | `field_flags_junction` |
| `field_names` | `field_names_junction` |
| `field_parameters` | `field_parameters_junction` |

### Model Junction Tables (14 tables)
| Current Name | New Name |
|--------------|----------|
| `model_departments` | `model_departments_junction` |
| `model_descriptions` | `model_descriptions_junction` |
| `model_endpoints` | `model_endpoints_junction` |
| `model_flags` | `model_flags_junction` |
| `model_keys` | `model_keys_junction` |
| `model_modalities` | `model_modalities_junction` |
| `model_names` | `model_names_junction` |
| `model_pricing` | `model_pricing_junction` |
| `model_providers` | `model_providers_junction` |
| `model_qualities` | `model_qualities_junction` |
| `model_reasoning_levels` | `model_reasoning_levels_junction` |
| `model_temperature_levels` | `model_temperature_levels_junction` |
| `model_values` | `model_values_junction` |
| `model_voices` | `model_voices_junction` |

### Parameter Junction Tables (6 tables)
| Current Name | New Name |
|--------------|----------|
| `parameter_departments` | `parameter_departments_junction` |
| `parameter_descriptions` | `parameter_descriptions_junction` |
| `parameter_fields` | `parameter_fields_junction` |
| `parameter_flags` | `parameter_flags_junction` |
| `parameter_names` | `parameter_names_junction` |

### Persona Junction Tables (10 tables)
| Current Name | New Name |
|--------------|----------|
| `persona_colors` | `persona_colors_junction` |
| `persona_departments` | `persona_departments_junction` |
| `persona_descriptions` | `persona_descriptions_junction` |
| `persona_examples` | `persona_examples_junction` |
| `persona_fields` | `persona_fields_junction` |
| `persona_flags` | `persona_flags_junction` |
| `persona_icons` | `persona_icons_junction` |
| `persona_instructions` | `persona_instructions_junction` |
| `persona_names` | `persona_names_junction` |
| `persona_parameters` | `persona_parameters_junction` |

### Profile Junction Tables (8 tables)
| Current Name | New Name |
|--------------|----------|
| `profile_cohorts` | `profile_cohorts_junction` |
| `profile_departments` | `profile_departments_junction` |
| `profile_emails` | `profile_emails_junction` |
| `profile_flags` | `profile_flags_junction` |
| `profile_names` | `profile_names_junction` |
| `profile_request_limits` | `profile_request_limits_junction` |
| `profile_roles` | `profile_roles_junction` |
| `profile_routes` | `profile_routes_junction` |

### Provider Junction Tables (4 tables)
| Current Name | New Name |
|--------------|----------|
| `provider_descriptions` | `provider_descriptions_junction` |
| `provider_flags` | `provider_flags_junction` |
| `provider_names` | `provider_names_junction` |
| `provider_values` | `provider_values_junction` |

### Rubric Junction Tables (7 tables)
| Current Name | New Name |
|--------------|----------|
| `rubric_departments` | `rubric_departments_junction` |
| `rubric_descriptions` | `rubric_descriptions_junction` |
| `rubric_flags` | `rubric_flags_junction` |
| `rubric_names` | `rubric_names_junction` |
| `rubric_points` | `rubric_points_junction` |
| `rubric_standard_groups` | `rubric_standard_groups_junction` |
| `rubric_standards` | `rubric_standards_junction` |

### Scenario Junction Tables (15 tables)
| Current Name | New Name |
|--------------|----------|
| `scenario_departments` | `scenario_departments_junction` |
| `scenario_descriptions` | `scenario_descriptions_junction` |
| `scenario_documents` | `scenario_documents_junction` |
| `scenario_fields` | `scenario_fields_junction` |
| `scenario_flags` | `scenario_flags_junction` |
| `scenario_images` | `scenario_images_junction` |
| `scenario_names` | `scenario_names_junction` |
| `scenario_objectives` | `scenario_objectives_junction` |
| `scenario_options` | `scenario_options_junction` |
| `scenario_parameters` | `scenario_parameters_junction` |
| `scenario_personas` | `scenario_personas_junction` |
| `scenario_problem_statements` | `scenario_problem_statements_junction` |
| `scenario_questions` | `scenario_questions_junction` |
| `scenario_templates` | `scenario_templates_junction` |
| `scenario_videos` | `scenario_videos_junction` |

### Setting Junction Tables (12 tables)
| Current Name | New Name |
|--------------|----------|
| `setting_auth_keys` | `setting_auth_keys_junction` |
| `setting_auth_values` | `setting_auth_values_junction` |
| `setting_auths` | `setting_auths_junction` |
| `setting_colors` | `setting_colors_junction` |
| `setting_departments` | `setting_departments_junction` |
| `setting_descriptions` | `setting_descriptions_junction` |
| `setting_flags` | `setting_flags_junction` |
| `setting_names` | `setting_names_junction` |
| `setting_profiles` | `setting_profiles_junction` |
| `setting_provider_keys` | `setting_provider_keys_junction` |
| `setting_providers` | `setting_providers_junction` |
| `setting_thresholds` | `setting_thresholds_junction` |

### Simulation Junction Tables (9 tables)
| Current Name | New Name |
|--------------|----------|
| `simulation_departments` | `simulation_departments_junction` |
| `simulation_descriptions` | `simulation_descriptions_junction` |
| `simulation_flags` | `simulation_flags_junction` |
| `simulation_names` | `simulation_names_junction` |
| `simulation_scenario_flags` | `simulation_scenario_flags_junction` |
| `simulation_scenario_positions` | `simulation_scenario_positions_junction` |
| `simulation_scenario_rubrics` | `simulation_scenario_rubrics_junction` |
| `simulation_scenario_time_limits` | `simulation_scenario_time_limits_junction` |
| `simulation_scenarios` | `simulation_scenarios_junction` |

### Tool Junction Tables (6 tables)
| Current Name | New Name |
|--------------|----------|
| `tool_args` | `tool_args_junction` |
| `tool_args_outputs` | `tool_args_outputs_junction` |
| `tool_descriptions` | `tool_descriptions_junction` |
| `tool_domains` | `tool_domains_junction` |
| `tool_flags` | `tool_flags_junction` |
| `tool_names` | `tool_names_junction` |

---

## Summary

| Action | Count |
|--------|-------|
| Tables to drop | 2 |
| Enum values to remove | 4 |
| Enum values to add | 4 |
| Junction tables to rename | 141 |

---

## Migration Order

1. Drop `debug_info_draft` table
2. Drop `settings_default_department` table (after updating `get_login_data_complete.sql`)
3. Recreate `entry_type` enum with correct values
4. Rename all junction tables
5. Update all SQL files with new table names

---

## Code Files Requiring Updates

All SQL files in `server/app/sql/v4/` that reference junction tables will need updating. The migration will handle the database schema, but application SQL files need manual updates.
