# Database Schema - Public Schema

## Legend

- **Primary Keys**: <u>underlined</u>
- **Foreign Keys**: *italicized*
- **Regular Columns**: plain text

---

## Agent Tables

- `agent_artifact`(created_at, updated_at, <u>id</u>, generated, mcp, group_id)
- `agent_departments`(active, created_at, updated_at, <u>agent_id</u>, <u>department_id</u>, generated, mcp)
- `agent_descriptions`(<u>agent_id</u>, <u>description_id</u>, created_at, updated_at, generated, mcp, active)
- `agent_flags`(<u>agent_id</u>, <u>flag_id</u>, value, created_at, updated_at, generated, mcp, active)
- `agent_instructions`(<u>agent_id</u>, <u>instruction_id</u>, created_at, updated_at, generated, mcp, active)
- `agent_models`(<u>agent_id</u>, <u>model_id</u>, created_at, updated_at, generated, mcp, active)
- `agent_names`(<u>agent_id</u>, <u>name_id</u>, created_at, updated_at, generated, mcp, active)
- `agent_prompts`(active, created_at, updated_at, <u>agent_id</u>, <u>prompt_id</u>, generated, mcp)
- `agent_reasoning_levels`(active, created_at, updated_at, <u>agent_id</u>, <u>reasoning_level_id</u>, generated, mcp)
- `agent_temperature_levels`(active, created_at, updated_at, <u>agent_id</u>, <u>temperature_level_id</u>, generated, mcp)
- `agent_tools`(<u>agent_id</u>, <u>tool_id</u>, active, created_at, updated_at, generated, mcp)
- `agent_voices`(active, created_at, updated_at, <u>agent_id</u>, <u>voice_id</u>, generated, mcp)

## Agents Tables

- `agents_resource`(created_at, updated_at, agent_id, active, generated, mcp, call_id, id)

## Analyses Tables

- `analyses_resource`(<u>id</u>, created_at, content, active, generated, call_id, mcp)

## App Tables

- `app_metrics`(<u>ts</u>, requests_total, errors_total, avg_latency_ms, cpu_percent, memory_bytes)

## Args Tables

- `args_outputs_resource`(<u>id</u>, args_id, name, template, created_at, updated_at, active, generated, call_id, mcp)
- `args_outputs_values`(<u>id</u>, call_id, args_outputs_id, string_value, number_value, boolean_value, created_at, updated_at)
- `args_resource`(<u>id</u>, name, description, field_type, required, default_value, position, created_at, updated_at, active, generated, call_id, mcp, type)
- `args_values`(<u>id</u>, call_id (nullable), args_id, string_value, number_value, boolean_value, created_at, updated_at)

## Artifact Tables

- `artifact_flag_types`(<u>artifact</u>, <u>flag_type</u>, created_at, updated_at)
- `artifact_resources`(<u>artifact</u>, <u>resource</u>, created_at, updated_at)

## Attempt Tables

- `attempt_chats`(created_at, updated_at, <u>chat_id</u>, <u>attempt_id</u>)
- `attempt_profiles`(active, created_at, updated_at, <u>profile_id</u>, <u>attempt_id</u>)
- `attempt_tests`(created_at, updated_at, <u>attempt_id</u>, <u>test_id</u>)

## Audio Tables

- `audio_uploads`(<u>audio_id</u>, <u>upload_id</u>, active, created_at, updated_at)

## Audios Tables

- `audios_resource`(<u>id</u>, created_at, updated_at, active, generated, call_id, mcp)

## Auth Tables

- `auth_artifact`(created_at, updated_at, <u>id</u>, generated, mcp, group_id)
- `auth_descriptions`(<u>auth_id</u>, <u>description_id</u>, created_at, updated_at, generated, mcp, active)
- `auth_flags`(<u>auth_id</u>, <u>flag_id</u>, value, created_at, updated_at, generated, mcp, active)
- `auth_items`(<u>auth_id</u>, <u>item_id</u>, created_at, updated_at, generated, mcp, active)
- `auth_names`(<u>auth_id</u>, <u>name_id</u>, created_at, updated_at, generated, mcp, active)
- `auth_protocols`(<u>auth_id</u>, <u>protocol_id</u>, created_at, updated_at, generated, mcp, active)
- `auth_slugs`(<u>auth_id</u>, <u>slug_id</u>, created_at, updated_at, generated, mcp, active)

## Auths Tables

- `auths_resource`(created_at, updated_at, auth_id, active, generated, mcp, call_id, <u>id</u>, group_id)

## Chat Tables

- `chat_conversations`(<u>chat_id</u>, <u>conversation_id</u>, active, created_at, updated_at, generated, mcp)
- `chat_groups`(created_at, updated_at, <u>chat_id</u>, <u>group_id</u>, generated, mcp, active)
- `chat_responses`(<u>chat_id</u>, <u>response_id</u>, active, created_at, updated_at, generated, mcp)

## Cohort Tables

- `cohort_artifact`(created_at, updated_at, <u>id</u>, generated, mcp, group_id)
- `cohort_departments`(active, created_at, updated_at, <u>cohort_id</u>, <u>department_id</u>, generated, mcp)
- `cohort_descriptions`(<u>cohort_id</u>, <u>description_id</u>, created_at, updated_at, generated, mcp, active)
- `cohort_flags`(<u>cohort_id</u>, <u>flag_id</u>, value, created_at, updated_at, generated, mcp, active)
- `cohort_names`(<u>cohort_id</u>, <u>name_id</u>, created_at, updated_at, generated, mcp, active)
- `cohort_profiles`(active, created_at, updated_at, <u>cohort_id</u>, <u>profile_id</u>, generated, mcp)
- `cohort_simulations`(active, created_at, updated_at, position, <u>cohort_id</u>, <u>simulation_id</u>, generated, mcp)

## Cohorts Tables

- `cohorts_resource`(created_at, updated_at, cohort_id, active, generated, mcp, call_id, id)

## Colors Tables

- `colors_resource`(<u>id</u>, name, description, hex_code, created_at, updated_at, active, generated, call_id, mcp)

## Contents Tables

- `contents_resource`(<u>id</u>, content_id, created_at, updated_at, active, generated, mcp, call_id)

## Conversations Tables

- `conversations_resource`(<u>id</u>, created_at, updated_at, end_reason, active, generated, call_id, mcp)

## Debug Tables

- `debug_info_resource`(created_at, content, <u>id</u>, active, generated, call_id, mcp)

## Default Tables

- `default_accounts_resource`(<u>id</u>, profile_id, type, active, generated, mcp, call_id, group_id, created_at, updated_at)

## Department Tables

- `department_artifact`(created_at, updated_at, <u>id</u>, generated, mcp, group_id)
- `department_descriptions`(<u>department_id</u>, <u>description_id</u>, created_at, updated_at, generated, mcp, active)
- `department_flags`(<u>department_id</u>, <u>flag_id</u>, value, created_at, updated_at, generated, mcp, active)
- `department_names`(<u>department_id</u>, <u>name_id</u>, created_at, updated_at, generated, mcp, active)
- `department_settings`(active, created_at, updated_at, <u>department_id</u>, <u>settings_id</u>, generated, mcp)

## Departments Tables

- `departments_resource`(created_at, updated_at, department_id, active, generated, mcp, call_id, <u>id</u>, group_id)

## Descriptions Tables

- `descriptions_resource`(<u>id</u>, description, created_at, updated_at, active, generated, call_id, mcp)

## Document Tables

- `document_artifact`(created_at, updated_at, <u>id</u>, generated, mcp, group_id)
- `document_departments`(active, created_at, updated_at, <u>department_id</u>, <u>document_id</u>, generated, mcp)
- `document_descriptions`(<u>document_id</u>, <u>description_id</u>, created_at, updated_at, generated, mcp, active)
- `document_fields`(active, created_at, updated_at, <u>document_id</u>, <u>field_id</u>, generated, mcp)
- `document_flags`(<u>document_id</u>, <u>flag_id</u>, value, created_at, updated_at, generated, mcp, active)
- `document_groups`(created_at, updated_at, <u>document_id</u>, <u>group_id</u>, generated, mcp, active)
- `document_names`(<u>document_id</u>, <u>name_id</u>, created_at, updated_at, generated, mcp, active)
- `document_parameters`(<u>document_id</u>, <u>parameter_id</u>, <u>type</u>, created_at, updated_at, active, generated, mcp)
- `document_schema_field_items`(<u>document_id</u>, <u>schema_field_item_id</u>, active, created_at, updated_at, generated, mcp)
- `document_tree`(active, created_at, updated_at, <u>child_id</u>, <u>parent_id</u>, generated, mcp)
- `document_uploads_resource`(active, created_at, updated_at, document_id, uploads_id)

## Documents Tables

- `documents_resource`(created_at, updated_at, document_id, active, generated, mcp, call_id, id)

## Domains Tables

- `domains_resource`(<u>id</u>, resource, active, generated, mcp, call_id, created_at, updated_at)

## Draft Tables

- `draft_agents`(<u>draft_id</u>, <u>agents_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_analyses`(<u>draft_id</u>, <u>analyses_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_auth`(<u>draft_id</u>, <u>auth_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_cohorts`(<u>draft_id</u>, <u>cohorts_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_colors`(<u>draft_id</u>, <u>colors_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_content`(<u>draft_id</u>, <u>content_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_conversations`(<u>draft_id</u>, <u>conversations_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_debug_info`(<u>draft_id</u>, <u>debug_info_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_departments`(<u>draft_id</u>, <u>departments_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_descriptions`(<u>draft_id</u>, <u>descriptions_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_documents`(<u>draft_id</u>, <u>documents_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_endpoints`(<u>draft_id</u>, <u>endpoints_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_evals`(<u>draft_id</u>, <u>evals_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_examples`(<u>draft_id</u>, <u>examples_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_feedbacks`(<u>draft_id</u>, <u>feedbacks_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_fields`(<u>draft_id</u>, <u>fields_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_flags`(<u>draft_id</u>, <u>flags_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_hints`(<u>draft_id</u>, <u>hints_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_icons`(<u>draft_id</u>, <u>icons_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_images`(<u>draft_id</u>, <u>images_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_improvements`(<u>draft_id</u>, <u>improvements_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_instructions`(<u>draft_id</u>, <u>instructions_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_items`(<u>draft_id</u>, <u>items_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_keys`(<u>draft_id</u>, <u>keys_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_models`(<u>draft_id</u>, <u>models_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_names`(<u>draft_id</u>, <u>names_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_objectives`(<u>draft_id</u>, <u>objectives_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_options`(<u>draft_id</u>, <u>options_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_parameters`(<u>draft_id</u>, <u>parameters_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_personas`(<u>draft_id</u>, <u>personas_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_points`(<u>draft_id</u>, <u>points_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_problem_statements`(<u>draft_id</u>, <u>problem_statements_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_profiles`(<u>draft_id</u>, <u>profiles_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_prompts`(<u>draft_id</u>, <u>prompts_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_protocols`(<u>draft_id</u>, <u>protocols_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_providers`(<u>draft_id</u>, <u>providers_id</u>, <u>version</u>, created_at, updated_at, generated, mcp, active)
- `draft_questions`(<u>draft_id</u>, <u>questions_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_responses`(<u>draft_id</u>, <u>responses_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_rubrics`(<u>draft_id</u>, <u>rubrics_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_scenarios`(<u>draft_id</u>, <u>scenarios_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_schema_field_items`(<u>draft_id</u>, <u>schema_field_items_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_schema_fields`(<u>draft_id</u>, <u>schema_fields_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_schemas`(<u>draft_id</u>, <u>schemas_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_settings`(<u>draft_id</u>, <u>settings_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_simulations`(<u>draft_id</u>, <u>simulations_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_slugs`(<u>draft_id</u>, <u>slugs_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_standard_groups`(<u>draft_id</u>, <u>standard_groups_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_strengths`(<u>draft_id</u>, <u>strengths_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_thresholds`(<u>draft_id</u>, <u>thresholds_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_times`(<u>draft_id</u>, <u>times_id</u>, version, created_at, updated_at, generated, mcp, active)
- `draft_videos`(<u>draft_id</u>, <u>videos_id</u>, version, created_at, updated_at, generated, mcp, active)

## Emails Tables

- `emails_resource`(<u>id</u>, email, created_at, updated_at, active, generated, call_id, mcp)

## Endpoints Tables

- `endpoints_resource`(<u>id</u>, base_url, active, created_at, updated_at, generated, call_id, mcp)

## Eval Tables

- `eval_agents`(<u>eval_id</u>, <u>agent_id</u>, created_at, updated_at, generated, mcp, active)
- `eval_analyses`(<u>eval_id</u>, <u>analyses_id</u>, created_at, updated_at, active, generated, mcp)
- `eval_artifact`(created_at, updated_at, <u>id</u>, generated, mcp, group_id)
- `eval_attempts`(created_at, archived, <u>id</u>, eval_id, infinite_mode, generated, mcp, active, updated_at)
- `eval_departments`(active, created_at, updated_at, <u>department_id</u>, <u>eval_id</u>, generated, mcp)
- `eval_descriptions`(<u>eval_id</u>, <u>description_id</u>, created_at, updated_at, generated, mcp, active)
- `eval_feedbacks`(<u>eval_id</u>, <u>feedbacks_id</u>, created_at, updated_at, active, generated, mcp)
- `eval_flags`(<u>eval_id</u>, <u>flag_id</u>, value, created_at, updated_at, generated, mcp, active)
- `eval_group_positions`(<u>eval_id</u>, <u>group_positions_id</u>, created_at, updated_at, active, generated, mcp)
- `eval_groups`(<u>eval_id</u>, <u>group_id</u>, created_at, updated_at, generated, mcp, active)
- `eval_groups_rubric_grade_agents`(<u>eval_id</u>, <u>group_id</u>, <u>rubric_grade_agent_id</u>, created_at, updated_at, generated, mcp, active)
- `eval_names`(<u>eval_id</u>, <u>name_id</u>, created_at, updated_at, generated, mcp, active)
- `eval_run_positions`(<u>eval_id</u>, <u>run_positions_id</u>, created_at, updated_at, active, generated, mcp)
- `eval_runs`(completed, created_at, updated_at, <u>eval_id</u>, <u>run_id</u>, generated, mcp, active)
- `eval_runs_rubric_grade_agents`(<u>eval_id</u>, <u>run_id</u>, <u>rubric_grade_agent_id</u>, created_at, updated_at, generated, mcp, active)
- `eval_times`(<u>eval_id</u>, <u>times_id</u>, created_at, updated_at, active, generated, mcp)

## Evals Tables

- `evals_resource`(created_at, updated_at, eval_id, active, generated, mcp, call_id, id, group_id)

## Examples Tables

- `examples_resource`(created_at, updated_at, example, <u>id</u>, generated, call_id, mcp)

## Feedbacks Tables

- `feedbacks_resource`(created_at, total, feedback, <u>id</u>, standard_id, active, generated, call_id, mcp)

## Field Tables

- `field_artifact`(created_at, updated_at, <u>id</u>, generated, mcp, group_id)
- `field_departments`(active, created_at, updated_at, <u>department_id</u>, <u>field_id</u>, generated, mcp)
- `field_descriptions`(<u>field_id</u>, <u>description_id</u>, created_at, updated_at, generated, mcp, active)
- `field_flags`(<u>field_id</u>, <u>flag_id</u>, value, created_at, updated_at, generated, mcp, active)
- `field_names`(<u>field_id</u>, <u>name_id</u>, created_at, updated_at, generated, mcp, active)
- `field_parameters`(<u>field_id</u>, <u>parameter_id</u>, <u>type</u>, created_at, updated_at, active, generated, mcp)

## Fields Tables

- `fields_resource`(created_at, updated_at, field_id, active, generated, mcp, call_id, <u>id</u>)

## Flags Tables

- `flags_resource`(<u>id</u>, name, description, icon_id, created_at, updated_at, active, generated, call_id, mcp, type)

## Grade Tables

- `grade_analyses`(<u>grade_id</u>, <u>analysis_id</u>, created_at, generated, mcp, active, updated_at)
- `grade_feedbacks`(<u>grade_id</u>, <u>feedback_id</u>, created_at, generated, mcp, active, updated_at)
- `grade_groups`(created_at, updated_at, <u>chat_id</u>, <u>group_id</u>, generated, mcp, active)
- `grade_improvements`(<u>grade_id</u>, <u>improvement_id</u>, created_at, generated, mcp, active, updated_at)
- `grade_strengths`(<u>grade_id</u>, <u>strength_id</u>, created_at, generated, mcp, active, updated_at)
- `grade_times`(<u>grade_id</u>, <u>time_id</u>, active, created_at, updated_at, generated, mcp)

## Group Tables

- `group_order`(<u>group_id</u>, <u>agent_id</u>, <u>position_idx</u>, created_at, updated_at, generated, mcp, active)
- `group_positions_resource`(<u>id</u>, eval_id, group_id, value, created_at, updated_at, active, generated, mcp, call_id)
- `group_runs`(created_at, updated_at, idx, <u>group_id</u>, <u>run_id</u>, generated, mcp, active)
- `group_stop`(<u>group_id</u>, <u>tool_id</u>, <u>position_idx</u>, created_at, updated_at, generated, mcp, active)

## Groups Tables

- `groups_resource`(<u>id</u>, group_id, created_at, updated_at, active, generated, mcp, call_id)
- `groups_rubric_grade_agents_resource`(<u>id</u>, rubric_id, grade_agent_id, agent_id, created_at, updated_at, active, generated, mcp, call_id)

## Hints Tables

- `hints_resource`(<u>id</u>, hint, created_at, updated_at, active, generated, call_id, mcp)

## Icons Tables

- `icons_resource`(<u>id</u>, name, description, value, created_at, updated_at, active, generated, call_id, mcp)

## Image Tables

- `image_departments`(active, created_at, updated_at, <u>department_id</u>, <u>image_id</u>, generated, mcp)
- `image_uploads`(active, created_at, updated_at, <u>image_id</u>, <u>upload_id</u>, generated, mcp)

## Images Tables

- `images_resource`(created_at, updated_at, name, active, completed, <u>id</u>, description, generated, call_id, mcp)

## Improvements Tables

- `improvements_resource`(<u>id</u>, created_at, name, description, message_id, active, generated, call_id, mcp)

## Instruction Tables

- `instruction_schemas`(<u>instruction_id</u>, <u>schema_id</u>, created_at, updated_at, generated, mcp, active)

## Instructions Tables

- `instructions_resource`(<u>id</u>, template, active, created_at, updated_at, generated, call_id, mcp)

## Items Tables

- `items_resource`(<u>id</u>, name, description, encrypted, position, active, created_at, updated_at, generated, call_id, mcp)

## Key Tables

- `key_descriptions`(<u>key_id</u>, <u>description_id</u>, created_at, updated_at, generated, mcp, active)
- `key_flags`(<u>key_id</u>, <u>flag_id</u>, value, created_at, updated_at, generated, mcp, active)
- `key_names`(<u>key_id</u>, <u>name_id</u>, created_at, updated_at, generated, mcp, active)

## Keys Tables

- `keys_resource`(<u>id</u>, key_id, created_at, updated_at, active, generated, mcp, call_id, key)

## Logins Tables

- `logins_resource`(<u>id</u>, last_login, created_at, updated_at, active, generated, call_id, mcp)

## Message Tables

- `message_audios`(<u>message_id</u>, <u>audio_id</u>, created_at, updated_at, generated, mcp, active)
- `message_calls`(<u>message_id</u>, <u>call_id</u>, created_at, updated_at)
- `message_contents`(<u>message_id</u>, <u>content_id</u>, idx, created_at, updated_at, generated, mcp, active)
- `message_documents`(<u>message_id</u>, <u>document_id</u>, created_at, updated_at, generated, mcp, active)
- `message_feedback_highlight`(idx, section, created_at, message_feedback_id, generated, mcp, active, updated_at)
- `message_feedback_replace`(idx, section, replace, created_at, message_feedback_id, generated, mcp, active, updated_at)
- `message_hints`(<u>message_id</u>, <u>hint_id</u>, idx, created_at, updated_at, generated, mcp, active)
- `message_images`(<u>message_id</u>, <u>image_id</u>, created_at, updated_at, generated, mcp, active)
- `message_personas`(created_at, updated_at, <u>message_id</u>, <u>persona_id</u>, generated, mcp, active)
- `message_runs`(created_at, updated_at, <u>message_id</u>, <u>run_id</u>, generated, mcp, active)
- `message_texts`(<u>message_id</u>, <u>text_id</u>, created_at, updated_at, generated, mcp, active)
- `message_tree`(active, created_at, updated_at, <u>parent_id</u>, <u>child_id</u>, generated, mcp)
- `message_videos`(<u>message_id</u>, <u>video_id</u>, created_at, updated_at, generated, mcp, active)

## Modalities Tables

- `modalities_resource`(<u>id</u>, modality, created_at, updated_at, active, generated, mcp, call_id)

## Model Tables

- `model_artifact`(created_at, updated_at, <u>id</u>, generated, mcp, group_id)
- `model_departments`(active, created_at, updated_at, <u>department_id</u>, <u>model_id</u>, generated, mcp)
- `model_descriptions`(<u>model_id</u>, <u>description_id</u>, created_at, updated_at, generated, mcp, active)
- `model_endpoints`(<u>model_id</u>, <u>endpoint_id</u>, created_at, updated_at, generated, mcp, active)
- `model_flags`(<u>model_id</u>, <u>flag_id</u>, value, created_at, updated_at, generated, mcp, active)
- `model_keys`(<u>model_id</u>, <u>key_id</u>, created_at, updated_at, generated, mcp, active)
- `model_modalities`(active, created_at, updated_at, <u>model_id</u>, generated, mcp, <u>modality_id</u>, <u>type</u>)
- `model_names`(<u>model_id</u>, <u>name_id</u>, created_at, updated_at, generated, mcp, active)
- `model_pricing`(active, created_at, updated_at, <u>model_id</u>, generated, mcp, <u>pricing_id</u>)
- `model_providers`(<u>model_id</u>, <u>providers_id</u>, created_at, updated_at, generated, mcp, active)
- `model_qualities`(active, created_at, updated_at, <u>model_id</u>, generated, mcp, <u>quality_id</u>)
- `model_reasoning_levels`(<u>model_id</u>, <u>reasoning_level_id</u>, created_at, updated_at, generated, mcp, active)
- `model_temperature_levels`(<u>model_id</u>, <u>temperature_level_id</u>, created_at, updated_at, generated, mcp, active)
- `model_values`(<u>model_id</u>, <u>value_id</u>, created_at, updated_at, generated, mcp, active)
- `model_voices`(<u>model_id</u>, <u>voice_id</u>, created_at, updated_at, generated, mcp, active)

## Models Tables

- `models_resource`(created_at, updated_at, value, model_id, active, generated, mcp, call_id, <u>id</u>)

## Names Tables

- `names_resource`(<u>id</u>, name, created_at, updated_at, active, generated, call_id, mcp)

## Objective Tables

- `objective_departments`(active, created_at, updated_at, <u>department_id</u>, <u>objective_id</u>, generated, mcp)

## Objectives Tables

- `objectives_resource`(created_at, updated_at, objective, <u>id</u>, active, generated, call_id, mcp)

## Options Tables

- `options_resource`(created_at, updated_at, option_text, active, <u>id</u>, is_correct, generated, call_id, mcp)

## Parameter Tables

- `parameter_artifact`(created_at, updated_at, <u>id</u>, generated, mcp, group_id)
- `parameter_departments`(active, created_at, updated_at, <u>department_id</u>, <u>parameter_id</u>, generated, mcp)
- `parameter_descriptions`(<u>parameter_id</u>, <u>description_id</u>, created_at, updated_at, generated, mcp, active)
- `parameter_fields`(<u>parameter_id</u>, <u>field_id</u>, created_at, updated_at, generated, mcp, active)
- `parameter_flags`(<u>parameter_id</u>, <u>flag_id</u>, value, created_at, updated_at, generated, mcp, active)
- `parameter_names`(<u>parameter_id</u>, <u>name_id</u>, created_at, updated_at, generated, mcp, active)

## Parameters Tables

- `parameters_resource`(created_at, updated_at, parameter_id, active, generated, mcp, call_id, <u>id</u>)

## Persona Tables

- `persona_artifact`(created_at, updated_at, <u>id</u>, generated, mcp, group_id)
- `persona_colors`(<u>persona_id</u>, <u>color_id</u>, created_at, updated_at, generated, mcp, active)
- `persona_departments`(active, created_at, updated_at, <u>department_id</u>, <u>persona_id</u>, generated, mcp)
- `persona_descriptions`(<u>persona_id</u>, <u>description_id</u>, created_at, updated_at, generated, mcp, active)
- `persona_examples`(idx, created_at, <u>example_id</u>, <u>persona_id</u>, active, generated, mcp, updated_at)
- `persona_fields`(active, created_at, updated_at, <u>field_id</u>, <u>persona_id</u>, generated, mcp)
- `persona_flags`(<u>persona_id</u>, <u>flag_id</u>, value, created_at, updated_at, generated, mcp, active)
- `persona_icons`(<u>persona_id</u>, <u>icon_id</u>, created_at, updated_at, generated, mcp, active)
- `persona_instructions`(<u>persona_id</u>, <u>instruction_id</u>, created_at, updated_at, generated, mcp, active)
- `persona_names`(<u>persona_id</u>, <u>name_id</u>, created_at, updated_at, generated, mcp, active)
- `persona_parameters`(<u>persona_id</u>, <u>parameter_id</u>, <u>type</u>, created_at, updated_at, active, generated, mcp)

## Personas Tables

- `personas_resource`(created_at, updated_at, persona_id, active, generated, mcp, call_id, id)

## Points Tables

- `points_resource`(<u>id</u>, value, created_at, updated_at, active, generated, call_id, mcp)

## Pricing Tables

- `pricing_resource`(<u>id</u>, pricing_type, price, unit_id, created_at, updated_at, active, generated, mcp, call_id)

## Problem Tables

- `problem_statement_departments`(active, created_at, updated_at, <u>department_id</u>, <u>problem_statement_id</u>, generated, mcp)
- `problem_statements_resource`(created_at, updated_at, name, problem_statement, <u>id</u>, active, generated, call_id, mcp)

## Profile Tables

- `profile_activity`(last_active, created_at, <u>id</u>, profile_id, generated, mcp, active, updated_at)
- `profile_artifact`(updated_at, created_at, <u>id</u>, generated, mcp, group_id)
- `profile_departments`(is_primary, created_at, active, updated_at, <u>department_id</u>, <u>profile_id</u>, generated, mcp)
- `profile_emails`(email, is_primary, active, created_at, updated_at, <u>profile_id</u>, <u>email_id</u>, generated, mcp)
- `profile_flags`(<u>profile_id</u>, <u>flag_id</u>, value, created_at, updated_at, generated, mcp, active)
- `profile_logins`(<u>profile_id</u>, <u>login_id</u>, created_at, updated_at, generated, mcp, active)
- `profile_names`(<u>profile_id</u>, <u>name_id</u>, <u>type</u>, created_at, updated_at, generated, mcp, active)
- `profile_request_limits`(requests_per_day, active, created_at, updated_at, profile_id, request_limit_id, generated, mcp)
- `profile_roles`(<u>profile_id</u>, <u>role_id</u>, created_at, updated_at, generated, mcp, active)

## Profiles Tables

- `profiles_resource`(updated_at, last_login, created_at, role, profile_id, active, generated, mcp, call_id, id)

## Prompt Tables

(No tables - prompts are linked directly via agent_prompts)

## Prompts Tables

- `prompts_resource`(created_at, updated_at, system_prompt, name, description, active, <u>id</u>, generated, call_id, mcp)

## Protocols Tables

- `protocols_resource`(<u>id</u>, value, created_at, updated_at, generated, call_id, mcp)

## Provider Tables

- `provider_artifact`(<u>id</u>, created_at, updated_at, generated, mcp, group_id)
- `provider_descriptions`(<u>provider_id</u>, <u>description_id</u>, created_at, updated_at, generated, mcp, active)
- `provider_flags`(<u>provider_id</u>, <u>flag_id</u>, value, created_at, updated_at, generated, mcp, active)
- `provider_names`(<u>provider_id</u>, <u>name_id</u>, created_at, updated_at, generated, mcp, active)
- `provider_values`(<u>provider_id</u>, <u>values_id</u>, created_at, updated_at, active, generated, mcp)

## Providers Tables

- `providers_resource`(<u>id</u>, provider_id, created_at, updated_at, active, generated, mcp, call_id, group_id)

## Qualities Tables

- `qualities_resource`(<u>id</u>, quality, created_at, updated_at, active, generated, mcp, call_id)

## Question Tables

- `question_departments`(active, created_at, updated_at, <u>department_id</u>, <u>question_id</u>, generated, mcp)

## Questions Tables

- `questions_resource`(created_at, updated_at, question_text, allow_multiple, active, <u>id</u>, time, generated, call_id, mcp)

## Reasoning Tables

- `reasoning_levels_resource`(<u>id</u>, reasoning_level_id, reasoning_level, created_at, updated_at, active, generated, call_id, mcp)

## Request Tables

- `request_limits_resource`(<u>id</u>, requests_per_day, created_at, updated_at, active, generated, call_id, mcp)

## Resource Tables

- `resource_modalities`(<u>resource</u>, <u>modality</u>, created_at, updated_at, generated, mcp, active)
- `resource_outputs`(<u>resource</u>, <u>outputs_id</u>, created_at, updated_at)
- `resource_tools`(tool_id, created_at, updated_at, resource, generated, mcp, active)

## Responses Tables

- `responses_resource`(created_at, updated_at, completed, <u>id</u>, option_id, question_id, active, generated, call_id, mcp)

## Roles Tables

- `roles_resource`(<u>id</u>, role, created_at, updated_at, active, generated, call_id, mcp)

## Rubric Tables

- `rubric_artifact`(created_at, updated_at, <u>id</u>, generated, mcp, group_id)
- `rubric_artifacts`(<u>rubric_id</u>, <u>artifact</u>, created_at, updated_at, generated, mcp, active)
- `rubric_departments`(active, created_at, updated_at, <u>department_id</u>, <u>rubric_id</u>, generated, mcp)
- `rubric_descriptions`(<u>rubric_id</u>, <u>description_id</u>, created_at, updated_at, generated, mcp, active)
- `rubric_flags`(<u>rubric_id</u>, <u>flag_id</u>, value, created_at, updated_at, generated, mcp, active)
- `rubric_grade_agents`(<u>id</u>, rubric_id, grade_agent_id, created_at, updated_at, agent_id, generated, mcp, active)
- `rubric_grade_agents_audio`(<u>rubric_grade_agent_id</u>, <u>audio_agent_id</u>, created_at, updated_at, generated, mcp, active)
- `rubric_groups`(created_at, updated_at, <u>group_id</u>, <u>rubric_id</u>, generated, mcp, active)
- `rubric_names`(<u>rubric_id</u>, <u>name_id</u>, created_at, updated_at, generated, mcp, active)
- `rubric_points`(<u>rubric_id</u>, <u>point_id</u>, <u>type</u>, created_at, updated_at, generated, mcp, active)
- `rubric_standard_groups`(<u>rubric_id</u>, <u>standard_group_id</u>, position, active, created_at, updated_at, generated, mcp)

## Rubrics Tables

- `rubrics_resource`(created_at, updated_at, rubric_id, active, generated, mcp, call_id, <u>id</u>)

## Run Tables

- `run_debug_info`(<u>run_id</u>, <u>debug_info_id</u>, created_at, generated, mcp, active, updated_at)
- `run_models`(active, created_at, updated_at, <u>model_id</u>, <u>run_id</u>, generated, mcp)
- `run_personas`(active, created_at, updated_at, <u>persona_id</u>, <u>run_id</u>, generated, mcp)
- `run_positions_resource`(<u>id</u>, eval_id, run_id, value, created_at, updated_at, active, generated, mcp, call_id)
- `run_pricing_usage`(<u>pricing_type</u>, count, created_at, updated_at, <u>run_id</u>, <u>unit_id</u>, generated, mcp, active)
- `run_profiles`(active, created_at, updated_at, <u>profile_id</u>, <u>run_id</u>, generated, mcp)

## Runs Tables

- `runs_resource`(<u>id</u>, run_id, created_at, updated_at, active, generated, mcp, call_id)
- `runs_rubric_grade_agents_resource`(<u>id</u>, rubric_id, grade_agent_id, agent_id, created_at, updated_at, active, generated, mcp, call_id)

## Scenario Tables

- `scenario_artifact`(created_at, updated_at, <u>id</u>, generated, mcp, group_id)
- `scenario_content`(<u>scenario_id</u>, <u>content_id</u>, created_at, updated_at, active, generated, mcp)
- `scenario_conversations`(<u>scenario_id</u>, <u>conversation_id</u>, created_at, updated_at, active, generated, mcp)
- `scenario_departments`(active, created_at, updated_at, <u>department_id</u>, <u>scenario_id</u>, generated, mcp)
- `scenario_descriptions`(<u>scenario_id</u>, <u>description_id</u>, created_at, updated_at, generated, mcp, active)
- `scenario_documents`(active, created_at, updated_at, <u>document_id</u>, <u>scenario_id</u>, generated, mcp)
- `scenario_fields`(active, created_at, updated_at, <u>field_id</u>, <u>scenario_id</u>, generated, mcp)
- `scenario_flags`(<u>scenario_id</u>, <u>flag_id</u>, value, created_at, updated_at, generated, mcp, active)
- `scenario_flags_resource`(<u>id</u>, name, description, icon_id, created_at, updated_at, active, generated, mcp, call_id)
- `scenario_groups`(created_at, updated_at, <u>group_id</u>, <u>scenario_id</u>, generated, mcp, active)
- `scenario_hints`(<u>scenario_id</u>, <u>hint_id</u>, created_at, updated_at, active, generated, mcp)
- `scenario_images`(active, created_at, updated_at, <u>image_id</u>, <u>scenario_id</u>, generated, mcp)
- `scenario_names`(<u>scenario_id</u>, <u>name_id</u>, created_at, updated_at, generated, mcp, active)
- `scenario_objectives`(idx, created_at, <u>objective_id</u>, <u>scenario_id</u>, generated, mcp, active, updated_at)
- `scenario_options`(<u>scenario_id</u>, <u>option_id</u>, active, created_at, updated_at, generated, mcp)
- `scenario_parameters`(active, created_at, updated_at, <u>parameter_id</u>, <u>scenario_id</u>, generated, mcp, type)
- `scenario_personas`(active, created_at, updated_at, <u>persona_id</u>, <u>scenario_id</u>, generated, mcp)
- `scenario_positions_resource`(<u>simulation_id</u>, <u>scenario_id</u>, value, created_at, updated_at, generated, mcp, call_id)
- `scenario_problem_statements`(active, created_at, updated_at, <u>problem_statement_id</u>, <u>scenario_id</u>, generated, mcp)
- `scenario_questions`(active, created_at, updated_at, <u>question_id</u>, <u>scenario_id</u>, generated, mcp)
- `scenario_responses`(<u>scenario_id</u>, <u>response_id</u>, created_at, updated_at, active, generated, mcp)
- `scenario_rubric_grade_agents_resource`(<u>id</u>, rubric_id, grade_agent_id, agent_id, created_at, updated_at, active, generated, call_id, mcp)
- `scenario_scenario_flags`(<u>scenario_id</u>, <u>scenario_flags_id</u>, created_at, updated_at, active, generated, mcp)
- `scenario_templates`(<u>scenario_id</u>, <u>template_id</u>, created_at, updated_at, active, generated, mcp)
- `scenario_time_limits`(<u>simulation_id</u>, <u>scenario_id</u>, time_limit_seconds, active, created_at, updated_at, generated, mcp)
- `scenario_tree`(active, created_at, updated_at, <u>child_id</u>, <u>parent_id</u>, generated, mcp)
- `scenario_video_images`(idx, active, created_at, updated_at, <u>image_id</u>, <u>scenario_id</u>, <u>video_id</u>, generated, mcp)
- `scenario_videos`(active, created_at, updated_at, <u>scenario_id</u>, <u>video_id</u>, generated, mcp)

## Scenarios Tables

- `scenarios_resource`(created_at, updated_at, scenario_id, active, generated, mcp, call_id, id)

## Service Tables

- `service_health`(<u>ts</u>, <u>service</u>, ok, latency_ms, error, generated, mcp, active, updated_at)

## Setting Tables

- `setting_artifact`(created_at, <u>id</u>, updated_at, generated, mcp, group_id)
- `setting_auth_keys`(active, created_at, updated_at, <u>auth_id</u>, <u>auth_item_id</u>, <u>key_id</u>, <u>settings_id</u>, generated, mcp)
- `setting_auth_values`(value, created_at, updated_at, <u>auth_id</u>, <u>auth_item_id</u>, <u>settings_id</u>, generated, mcp, active)
- `setting_auths`(active, created_at, updated_at, <u>auth_id</u>, <u>settings_id</u>, generated, mcp)
- `setting_colors`(<u>setting_id</u>, <u>color_id</u>, <u>type</u>, created_at, updated_at, generated, mcp, active)
- `setting_default_accounts`(<u>setting_id</u>, <u>default_account_id</u>, active, created_at, updated_at, generated, mcp, call_id)
- `setting_departments`(<u>setting_id</u>, <u>department_id</u>, active, created_at, updated_at, generated, mcp)
- `setting_descriptions`(<u>setting_id</u>, <u>description_id</u>, created_at, updated_at, generated, mcp, active)
- `setting_flags`(<u>setting_id</u>, <u>flag_id</u>, value, created_at, updated_at, generated, mcp, active)
- `setting_names`(<u>setting_id</u>, <u>name_id</u>, created_at, updated_at, generated, mcp, active)
- `setting_provider_keys`(active, created_at, updated_at, <u>key_id</u>, <u>settings_id</u>, <u>providers_id</u>, generated, mcp)
- `setting_providers`(active, created_at, updated_at, <u>settings_id</u>, <u>providers_id</u>, generated, mcp)
- `setting_thresholds`(<u>setting_id</u>, <u>threshold_id</u>, <u>type</u>, created_at, updated_at, generated, mcp, active)

## Settings Tables

- `settings_default_department`(active, created_at, updated_at, <u>department_id</u>, <u>settings_id</u>, generated, mcp)
- `settings_resource`(created_at, setting_id, updated_at, active, generated, mcp, call_id, id, group_id)

## Simulation Tables

- `simulation_analyses`(<u>simulation_id</u>, <u>analysis_id</u>, created_at, updated_at, active, generated, mcp)
- `simulation_artifact`(created_at, updated_at, <u>id</u>, generated, mcp, group_id)
- `simulation_attempts`(created_at, infinite_mode, archived, <u>id</u>, simulation_id, generated, mcp, active, updated_at)
- `simulation_departments`(active, created_at, updated_at, <u>department_id</u>, <u>simulation_id</u>, generated, mcp)
- `simulation_descriptions`(<u>simulation_id</u>, <u>description_id</u>, created_at, updated_at, generated, mcp, active)
- `simulation_eval_rubric_grade_agents`(<u>simulation_id</u>, <u>eval_rubric_grade_agents_id</u>, created_at, updated_at, active, generated, mcp)
- `simulation_feedbacks`(<u>simulation_id</u>, <u>feedback_id</u>, created_at, updated_at, active, generated, mcp)
- `simulation_flags`(<u>simulation_id</u>, <u>flag_id</u>, value, created_at, updated_at, generated, mcp, active)
- `simulation_improvements`(<u>simulation_id</u>, <u>improvement_id</u>, created_at, updated_at, active, generated, mcp)
- `simulation_names`(<u>simulation_id</u>, <u>name_id</u>, created_at, updated_at, generated, mcp, active)
- `simulation_scenario_flags`(<u>simulation_id</u>, <u>scenario_id</u>, <u>scenario_flag_id</u>, value, created_at, updated_at, generated, mcp, active)
- `simulation_scenario_positions`(<u>simulation_id</u>, <u>scenario_id</u>, created_at, updated_at, active, generated, mcp)
- `simulation_scenario_rubric_grade_agents`(<u>simulation_id</u>, <u>scenario_rubric_grade_agent_id</u>, created_at, updated_at, active, generated, mcp)
- `simulation_scenarios`(created_at, updated_at, <u>scenario_id</u>, <u>simulation_id</u>, generated, mcp, active)
- `simulation_scenarios_scenario_rubric_grade_agents`(<u>simulation_id</u>, <u>scenario_id</u>, <u>scenario_rubric_grade_agent_id</u>, created_at, updated_at, generated, mcp, active)
- `simulation_simulation_scenario_flags`(<u>simulation_id</u>, <u>simulation_scenario_flag_id</u>, created_at, updated_at, active, generated, mcp)
- `simulation_strengths`(<u>simulation_id</u>, <u>strength_id</u>, created_at, updated_at, active, generated, mcp)
- `simulation_times`(<u>simulation_id</u>, <u>time_id</u>, created_at, updated_at, active, generated, mcp)

## Simulations Tables

- `simulations_resource`(created_at, updated_at, simulation_id, active, generated, mcp, call_id, id)

## Slugs Tables

- `slugs_resource`(<u>id</u>, value, created_at, updated_at, generated, call_id, mcp)

## Standard Tables

- `standard_groups_resource`(created_at, name, short_name, description, points, pass_points, active, <u>id</u>, generated, call_id, mcp)

## Strengths Tables

- `strengths_resource`(<u>id</u>, created_at, name, description, message_id, active, generated, call_id, mcp)

## Temperature Tables

- `temperature_levels_resource`(<u>id</u>, temperature_level_id, temperature, is_upper, created_at, updated_at, active, generated, call_id, mcp)

## Templates Tables

- `templates_resource`(<u>id</u>, html, name, description, created_at, updated_at, active, generated, mcp, call_id)

## Test Tables

- `test_runs`(created_at, updated_at, <u>run_id</u>, <u>test_id</u>, generated, mcp, active)

## Texts Tables

- `texts_resource`(<u>id</u>, created_at, updated_at, content, active, generated, call_id, mcp)

## Thresholds Tables

- `thresholds_resource`(<u>id</u>, value, created_at, updated_at, active, generated, call_id, mcp)

## Times Tables

- `times_resource`(<u>id</u>, created_at, updated_at, time_taken, active, generated, call_id, mcp)

## Tool Tables

- `tool_args`(<u>tool_id</u>, <u>args_id</u>, created_at, updated_at, generated, mcp)
- `tool_args_outputs`(<u>tool_id</u>, <u>args_outputs_id</u>, created_at, updated_at, generated, mcp)
- `tool_artifact`(<u>id</u>, created_at, updated_at, group_id, generated, mcp)
- `tool_descriptions`(<u>tool_id</u>, <u>description_id</u>, created_at, updated_at, generated, mcp, active)
- `tool_domains`(<u>tool_id</u>, <u>domain_id</u>, active, created_at, updated_at, generated, mcp)
- `tool_flags`(<u>tool_id</u>, <u>flag_id</u>, value, created_at, updated_at, generated, mcp, active)
- `tool_names`(<u>tool_id</u>, <u>name_id</u>, created_at, updated_at, generated, mcp, active)
- `tool_schema_field_items`(<u>tool_id</u>, <u>schema_field_item_id</u>, active, created_at, updated_at, generated, mcp)

## Uploads Tables

- `uploads_resource`(<u>id</u>, upload_id, created_at, updated_at, active, generated, mcp, call_id, group_id)

## Values Tables

- `values_resource`(<u>id</u>, value, created_at, updated_at, active, generated, call_id, mcp)

## Video Tables

- `video_departments`(active, created_at, updated_at, <u>department_id</u>, <u>video_id</u>, generated, mcp)
- `video_uploads`(active, created_at, updated_at, <u>upload_id</u>, <u>video_id</u>, generated, mcp)

## Videos Tables

- `videos_resource`(created_at, updated_at, name, length_seconds, active, completed, <u>id</u>, description, generated, call_id, mcp)

## Voices Tables

- `voices_resource`(<u>id</u>, voice_id, voice, created_at, updated_at, active, generated, call_id, mcp)

## Other Tables

- `activity`(created_at, message, endpoint, error, <u>id</u>, profile_id)
- `calls`(created_at, updated_at, external_call_id, completed, <u>id</u>, tool_id, template_id, arguments_raw)
- `chats`(created_at, updated_at, title, completed, <u>id</u>, scenario_id, generated, mcp, active)
- `contents`(<u>id</u>, content, created_at, updated_at, active, generated, call_id, mcp)
- `drafts`(<u>id</u>, profile_id, version, created_at, updated_at, artifact, group_id, generated, mcp, active)
- `grades`(created_at, description, passed, score, <u>id</u>, run_id, rubric_grade_agent_id, generated, mcp, active, updated_at)
- `groups`(created_at, updated_at, <u>id</u>, trace_id, generated, mcp, active)
- `messages`(created_at, updated_at, content, role, completed, audio, <u>id</u>, generated, mcp, active)
- `outputs`(<u>id</u>, name, field_type, description, created_at, updated_at, type)
- `problems`(created_at, type, message, resolved, <u>id</u>, profile_id, generated, mcp, active, updated_at)
- `runs`(created_at, updated_at, input_tokens, output_tokens, cached_input_tokens, <u>id</u>, agent_id, key_id, generated, mcp)
- `standards`(created_at, name, description, points, <u>id</u>, standard_group_id, generated, mcp, active, updated_at)
- `tests`(created_at, updated_at, title, completed, trace_id, <u>id</u>, run_id, generated, mcp, active)
- `units`(name, unit_category, value, active, created_at, updated_at, <u>id</u>, generated, mcp)
- `uploads`(created_at, updated_at, file_path, mime_type, size, <u>id</u>, generated, mcp, active)

