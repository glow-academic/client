# Relation Audit Report

Date: 2026-02-11
Source: RELATION.md audit run after \Restoring database from latest backup...
yarn run v1.22.22
$ bash scripts/start.sh
🔄 Default mode: Using latest backup...
📁 Found latest backup: restore_433_20260211_160617.sql.gz
🔧 Setting up database and user...
🗑️  Dropping existing database...
🗄️  Creating database 'mydb'...
🔄 Restoring from backup: restore_433_20260211_160617.sql.gz
✅ Backup restored successfully (custom format)
✅ Database restored and ready
✅ Database setup completed!
Done in 10.98s.
✅ Database restored

## Counts
- AUDIT1: 0
- AUDIT2: 0
- AUDIT3: 6
- AUDIT4: 2
- AUDIT5A: 24
- AUDIT5B: 45
- AUDIT6A: 9
- AUDIT6B: 241
- AUDIT7: 10
- AUDIT8: 2
- AUDIT9A: 2
- AUDIT9B: 2
- AUDIT10: 17
- AUDIT11A: 12
- AUDIT11B: 3
- AUDIT11C: 0
- AUDIT11D: 11
- AUDIT11E: 0
- AUDIT12: 2
- AUDIT13: 51
- AUDIT14: 2
- AUDIT15: 0
- AUDIT16: 31

## Gaps (Non-Empty Audits)

### AUDIT3 (6 rows)
- arg_positions|arg_positions_calls_connection
- audios|audios_calls_connection
- document_fields|document_fields_calls_connection
- document_uploads|document_uploads_calls_connection
- persona_fields|persona_fields_calls_connection
- provider_keys|provider_keys_calls_connection

### AUDIT4 (2 rows)
- scenario_parameter_fields_junction
- tool_calls_junction

### AUDIT5A (24 rows)
- document|images|document_images_junction
- document|templates|document_templates_junction
- document|uploads|document_uploads_junction
- document|texts|document_texts_junction
- eval|rubrics|eval_rubrics_junction
- setting|providers|setting_providers_junction
- model|endpoints|model_endpoints_junction
- model|keys|model_keys_junction
- field|parameters|field_parameters_junction
- training|departments|training_departments_junction
- training|descriptions|training_descriptions_junction
- training|documents|training_documents_junction
- training|flags|training_flags_junction
- training|images|training_images_junction
- training|names|training_names_junction
- training|objectives|training_objectives_junction
- training|options|training_options_junction
- training|parameters|training_parameters_junction
- training|personas|training_personas_junction
- training|problem_statements|training_problem_statements_junction
- training|questions|training_questions_junction
- training|templates|training_templates_junction
- training|videos|training_videos_junction
- training|parameter_fields|training_parameter_fields_junction

### AUDIT5B (45 rows)
- agent_agents_junction
- agent_tools_junction
- auth_auths_junction
- auth_departments_junction
- cohort_cohorts_junction
- department_departments_junction
- document_documents_junction
- eval_evals_junction
- eval_groups_rubrics_junction
- eval_runs_rubrics_junction
- field_fields_junction
- model_models_junction
- model_values_junction
- parameter_parameters_junction
- persona_personas_junction
- profile_activity_junction
- profile_audits_junction
- profile_emulations_junction
- profile_grants_junction
- profile_logins_junction
- profile_problems_junction
- profile_profiles_junction
- profile_roles_junction
- profile_runs_junction
- provider_departments_junction
- provider_endpoints_junction
- provider_keys_junction
- provider_providers_junction
- rubric_rubrics_junction
- scenario_scenarios_junction
- scenario_tree_junction
- setting_agents_junction
- setting_auth_item_keys_junction
- setting_auth_values_junction
- setting_provider_keys_junction
- setting_role_routes_junction
- setting_roles_junction
- setting_settings_junction
- simulation_scenario_personas_junction
- simulation_simulations_junction
- tool_arg_positions_junction
- tool_calls_junction
- tool_departments_junction
- tool_flags_junction
- tool_tools_junction

### AUDIT6A (9 rows)
- attempts|cohorts|attempts_cohorts_connection
- attempts|departments|attempts_departments_connection
- attempts|profiles|attempts_profiles_connection
- attempts|simulations|attempts_simulations_connection
- chats|personas|chats_personas_connection
- chats|scenarios|chats_scenarios_connection
- feedbacks|rubrics|feedbacks_rubrics_connection
- grades|rubrics|grades_rubrics_connection
- messages|profiles|messages_profiles_connection

### AUDIT6B (241 rows)
- agents_calls_connection
- agents_drafts_connection
- args_calls_connection
- args_drafts_connection
- args_outputs_calls_connection
- args_outputs_drafts_connection
- args_outputs_values_args_outputs_connection
- args_values_args_connection
- audios_drafts_connection
- auth_item_keys_calls_connection
- auths_calls_connection
- auths_drafts_connection
- benchmark_bundle_departments_connection
- benchmark_bundle_groups_connection
- benchmark_bundle_instructions_connection
- benchmark_bundle_keys_connection
- benchmark_bundle_models_connection
- benchmark_bundle_prompts_connection
- benchmark_bundle_reasoning_levels_connection
- benchmark_bundle_runs_connection
- benchmark_bundle_temperature_levels_connection
- benchmark_bundle_tools_connection
- benchmark_bundle_voices_connection
- benchmark_departments_connection
- benchmark_evals_connection
- benchmark_grades_rubrics_connection
- benchmark_invocations_groups_connection
- benchmark_invocations_runs_connection
- benchmark_profiles_connection
- benchmark_rubrics_connection
- benchmark_standard_groups_connection
- benchmark_standards_connection
- benchmark_tests_departments_connection
- benchmark_tests_evals_connection
- benchmark_tests_profiles_connection
- benchmark_tests_roles_connection
- bindings_bindings_connection
- bindings_calls_connection
- bindings_drafts_connection
- cohorts_calls_connection
- cohorts_drafts_connection
- colors_calls_connection
- colors_drafts_connection
- conditional_parameters_calls_connection
- conditional_parameters_drafts_connection
- config_agents_connection
- config_models_connection
- config_providers_connection
- departments_calls_connection
- departments_drafts_connection
- descriptions_calls_connection
- descriptions_drafts_connection
- documents_calls_connection
- documents_drafts_connection
- domains_calls_connection
- domains_domains_connection
- domains_drafts_connection
- emails_calls_connection
- emails_drafts_connection
- endpoints_calls_connection
- endpoints_drafts_connection
- evals_calls_connection
- evals_drafts_connection
- examples_calls_connection
- examples_drafts_connection
- feedbacks_standards_connection
- fields_calls_connection
- fields_drafts_connection
- flags_calls_connection
- flags_drafts_connection
- group_positions_calls_connection
- group_positions_drafts_connection
- group_rubrics_calls_connection
- group_rubrics_drafts_connection
- groups_calls_connection
- groups_drafts_connection
- groups_groups_connection
- icons_calls_connection
- icons_drafts_connection
- images_calls_connection
- images_drafts_connection
- instructions_calls_connection
- instructions_drafts_connection
- items_calls_connection
- items_drafts_connection
- keys_calls_connection
- keys_drafts_connection
- modalities_calls_connection
- modalities_drafts_connection
- models_calls_connection
- models_drafts_connection
- names_calls_connection
- names_drafts_connection
- objectives_calls_connection
- objectives_drafts_connection
- options_calls_connection
- options_drafts_connection
- parameter_fields_calls_connection
- parameter_fields_drafts_connection
- parameters_calls_connection
- parameters_drafts_connection
- personas_calls_connection
- personas_drafts_connection
- points_calls_connection
- points_drafts_connection
- pricing_calls_connection
- pricing_drafts_connection
- problem_statements_calls_connection
- problem_statements_drafts_connection
- profiles_calls_connection
- profiles_drafts_connection
- prompts_calls_connection
- prompts_drafts_connection
- protocols_calls_connection
- protocols_drafts_connection
- providers_calls_connection
- providers_drafts_connection
- qualities_calls_connection
- qualities_drafts_connection
- questions_calls_connection
- questions_drafts_connection
- reasoning_levels_calls_connection
- reasoning_levels_drafts_connection
- regenerates_calls_connection
- request_limits_calls_connection
- request_limits_drafts_connection
- responses_options_connection
- responses_questions_connection
- role_routes_calls_connection
- role_routes_drafts_connection
- roles_calls_connection
- roles_drafts_connection
- routes_calls_connection
- routes_drafts_connection
- rubrics_calls_connection
- rubrics_drafts_connection
- run_positions_calls_connection
- run_positions_drafts_connection
- run_pricing_pricing_connection
- run_rubrics_calls_connection
- run_rubrics_drafts_connection
- runs_calls_connection
- runs_drafts_connection
- runs_keys_connection
- runs_runs_connection
- runs_tools_connection
- scenario_flags_calls_connection
- scenario_flags_drafts_connection
- scenario_personas_calls_connection
- scenario_personas_drafts_connection
- scenario_positions_calls_connection
- scenario_positions_drafts_connection
- scenario_rubrics_calls_connection
- scenario_rubrics_drafts_connection
- scenario_time_limits_calls_connection
- scenario_time_limits_drafts_connection
- scenarios_calls_connection
- scenarios_drafts_connection
- settings_calls_connection
- settings_drafts_connection
- simulation_attempts_cohorts_connection
- simulation_attempts_departments_connection
- simulation_attempts_profiles_connection
- simulation_attempts_roles_connection
- simulation_attempts_simulations_connection
- simulation_chats_images_connection
- simulation_chats_objectives_connection
- simulation_chats_options_connection
- simulation_chats_parameters_connection
- simulation_chats_questions_connection
- simulation_chats_templates_connection
- simulation_chats_videos_connection
- simulation_grades_rubrics_connection
- simulation_positions_calls_connection
- simulation_positions_drafts_connection
- simulations_calls_connection
- simulations_drafts_connection
- slugs_calls_connection
- slugs_drafts_connection
- standard_groups_calls_connection
- standard_groups_drafts_connection
- standards_calls_connection
- standards_drafts_connection
- temperature_levels_calls_connection
- temperature_levels_drafts_connection
- templates_calls_connection
- templates_drafts_connection
- texts_calls_connection
- texts_drafts_connection
- texts_texts_connection
- thresholds_calls_connection
- thresholds_drafts_connection
- tools_calls_connection
- tools_drafts_connection
- training_bundle_departments_connection
- training_bundle_departments_documents_connection
- training_bundle_departments_images_connection
- training_bundle_departments_objectives_connection
- training_bundle_departments_options_connection
- training_bundle_departments_parameter_fields_connection
- training_bundle_departments_parameters_connection
- training_bundle_departments_personas_connection
- training_bundle_departments_problem_statements_connection
- training_bundle_departments_questions_connection
- training_bundle_departments_rubrics_connection
- training_bundle_departments_scenarios_connection
- training_bundle_departments_standard_groups_connection
- training_bundle_departments_standards_connection
- training_bundle_departments_templates_connection
- training_bundle_departments_time_limits_connection
- training_bundle_departments_videos_connection
- training_bundle_documents_connection
- training_bundle_fields_connection
- training_bundle_images_connection
- training_bundle_objectives_connection
- training_bundle_options_connection
- training_bundle_parameter_fields_connection
- training_bundle_parameters_connection
- training_bundle_personas_connection
- training_bundle_problem_statements_connection
- training_bundle_questions_connection
- training_bundle_scenarios_connection
- training_bundle_templates_connection
- training_bundle_videos_connection
- training_cohorts_connection
- training_departments_connection
- training_profiles_connection
- training_rubrics_connection
- training_simulations_connection
- training_standard_groups_connection
- training_standards_connection
- training_time_limits_connection
- uploads_calls_connection
- uploads_drafts_connection
- uploads_uploads_connection
- values_calls_connection
- values_drafts_connection
- videos_calls_connection
- videos_drafts_connection
- voices_calls_connection
- voices_drafts_connection

### AUDIT7 (10 rows)
- attempts|chats
- chats|grades
- chats|messages
- grades|feedbacks
- improvements|replacements
- messages|contents
- messages|hints
- messages|improvements
- messages|strengths
- strengths|highlights

### AUDIT8 (2 rows)
- fields|parameters
- flags|icons

### AUDIT9A (2 rows)
- args_outputs_values_entry|boolean_value
- args_values_entry|boolean_value

### AUDIT9B (2 rows)
- grants_entry|revoked_at
- grants_entry|used_at

### AUDIT10 (17 rows)
- agents_resource|prompt_id
- audios_entry|message_id
- audits_entry|session_id
- cohort_simulations_junction|simulation_id
- feedbacks_standards_connection|feedbacks_id
- groups_entry|session_id
- highlights_entry|message_feedback_id
- keys_resource|key_id
- replacements_entry|message_feedback_id
- resource_flags_relation|resource_id
- responses_entry|chat_id
- role_routes_drafts_connection|draft_id
- scenario_parameters_junction|parameter_id
- sessions_entry|profile_id
- simulation_contents_entry|call_id
- tests_entry|attempt_id
- view_outputs_relation|outputs_id

### AUDIT11A (12 rows)
- activity
- attempt
- benchmark
- dashboard
- health
- home
- leaderboard
- practice
- pricing
- reports
- test
- training

### AUDIT11B (3 rows)
- audios
- document_fields
- persona_fields

### AUDIT11D (11 rows)
- analyses
- attempts
- chats
- completions
- contents
- feedbacks
- grades
- hints
- improvements
- message_tree
- strengths

### AUDIT12 (2 rows)
- hints_entry
- view_calls_entry

### AUDIT13 (51 rows)
- api_*|323
- socket_*|158
- test_*|114
- infrastructure_*|21
- infra_*|10
- utils_*|9
- pgp_pub_decrypt_bytea|3
- pgp_pub_decrypt|3
- gen_salt|2
- armor|2
- digest|2
- hmac|2
- pgp_pub_encrypt|2
- pgp_pub_encrypt_bytea|2
- pgp_sym_decrypt|2
- pgp_sym_decrypt_bytea|2
- pgp_sym_encrypt|2
- pgp_sym_encrypt_bytea|2
- fips_mode|1
- encrypt_iv|1
- is_rfc4122_uuid|1
- message_content_hash|1
- message_is_conversation_message|1
- pgp_armor_headers|1
- pgp_key_id|1
- encrypt|1
- decrypt_iv|1
- uuid_ns_oid|1
- uuid_ns_url|1
- uuid_ns_x500|1
- validate_department_create_permissions|1
- validate_department_update_permissions|1
- validate_rate_limit|1
- safe_jsonb_parse|1
- decrypt|1
- dearmor|1
- update_updated_at_column|1
- crypt|1
- uuid_generate_v1|1
- uuid_generate_v1mc|1
- uuid_generate_v3|1
- uuid_generate_v4|1
- uuid_generate_v5|1
- uuid_nil|1
- gen_random_uuid|1
- gen_random_bytes|1
- gen_trace_id|1
- get_departments_resource_complete|1
- get_eval_rubric_grade_agents_resource_complete|1
- get_providers_resource_complete|1
- uuid_ns_dns|1

### AUDIT14 (2 rows)
- mv_draft_agent
- mv_draft_model

### AUDIT16 (31 rows)
- agent_departments_department_id_fkey|NO ACTION|agent_departments_junction
- agent_prompts_prompt_id_fkey|NO ACTION|agent_prompts_junction
- auth_departments_department_id_fkey|NO ACTION|auth_departments_junction
- cohort_departments_department_id_fkey|NO ACTION|cohort_departments_junction
- document_departments_department_id_fkey|NO ACTION|document_departments_junction
- eval_departments_department_id_fkey|NO ACTION|eval_departments_junction
- eval_runs_eval_id_fkey|NO ACTION|eval_runs_junction
- field_departments_department_id_fkey|NO ACTION|field_departments_junction
- model_departments_department_id_fkey|NO ACTION|model_departments_junction
- parameter_departments_department_id_fkey|NO ACTION|parameter_departments_junction
- persona_departments_department_id_fkey|NO ACTION|persona_departments_junction
- persona_examples_example_id_fkey|NO ACTION|persona_examples_junction
- profile_departments_department_id_fkey|NO ACTION|profile_departments_junction
- provider_departments_department_id_fkey|NO ACTION|provider_departments_junction
- rubric_departments_department_id_fkey|NO ACTION|rubric_departments_junction
- scenario_departments_department_id_fkey|NO ACTION|scenario_departments_junction
- scenario_documents_document_id_fkey|NO ACTION|scenario_documents_junction
- scenario_images_image_id_fkey|NO ACTION|scenario_images_junction
- scenario_objectives_objective_id_fkey|NO ACTION|scenario_objectives_junction
- scenario_options_option_id_fkey|RESTRICT|scenario_options_junction
- scenario_parameter_fields_call_id_fkey|NO ACTION|scenario_parameter_fields_junction
- scenario_personas_persona_id_fkey|NO ACTION|scenario_personas_junction
- scenario_problem_statements_problem_statement_id_fkey|NO ACTION|scenario_problem_statements_junction
- scenario_questions_question_id_fkey|NO ACTION|scenario_questions_junction
- scenario_videos_video_id_fkey|NO ACTION|scenario_videos_junction
- setting_auth_item_keys_junction_auth_item_keys_id_fkey|NO ACTION|setting_auth_item_keys_junction
- simulation_departments_department_id_fkey|NO ACTION|simulation_departments_junction
- simulation_scenario_personas_resource_fk|NO ACTION|simulation_scenario_personas_junction
- simulation_scenario_personas_simulation_fk|NO ACTION|simulation_scenario_personas_junction
- simulation_scenarios_scenario_id_fkey|NO ACTION|simulation_scenarios_junction
- tool_departments_department_id_fkey|NO ACTION|tool_departments_junction
