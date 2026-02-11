-- Module: Foundation Level (New)
-- Category: simulation
-- Description: Foundation Level (New) simulation with inline scenarios
-- ============================================================

-- Simulation resource rows
INSERT INTO public.departments_resource (created_at, active, generated, mcp, id, name, description, department_ids, setting_ids) VALUES ('2025-10-08T14:16:28.317660+00:00', true, false, false, '019bb25e-e624-73da-8cef-166028a1065a', 'Purdue CS', 'Innovative base of knowledge in the emerging field of computing', '{}', '{019b3be4-3c61-76ff-befb-69b082df2acd}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e96-772d-a275-211f1ba37a98', 'New to Purdue', '2025-08-12T16:33:53.782000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e93-7fba-b827-7b90d0601a20', 'Foundation Level (New)', '2025-08-12T16:33:53.782000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.scenario_positions_resource (id, value, created_at, generated, mcp, scenario_id) VALUES ('019bd1c8-54c3-75ad-b8e6-f893e1796f95', 1, '2026-01-13T02:51:36.057775+00:00', false, false, '019bb25e-e61d-7c71-bbda-3fe6a11efe91') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.scenario_time_limits_resource (id, time_limit_seconds, created_at, generated, mcp, active, scenario_id, negative) VALUES ('019c105f-fb7e-76fa-8fb8-e65e6cbfab71', 900, '2026-01-30T19:27:31.708815+00:00', false, false, true, '019bb25e-e61d-7c71-bbda-3fe6a11efe91', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.simulations_resource (created_at, active, generated, mcp, id, name, description, department_ids, scenario_ids) VALUES ('2025-08-12T16:33:53.782000+00:00', true, false, false, '019bb25e-e62c-7890-b9df-c1e41349390c', 'Foundation Level (New)', 'New to Purdue', '{}', '{019bb25e-e61d-7c71-bbda-3fe6a11efe91}') ON CONFLICT (id) DO NOTHING;

-- Scenario resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e88-73c9-8668-bb8e9c7e2371', 'Computer science scenario covering algorithm analysis and data structures from CS253.', '2025-08-12T12:52:10.022746+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.documents_resource (created_at, active, generated, mcp, id, name, description, department_ids, upload_id, text_id) VALUES ('2025-08-12T12:52:10.019846+00:00', true, false, false, '019bb25e-e619-7805-bf85-bd4ec58a8939', 'CS253-PSO1', NULL, '{}', '019b3be4-3cef-7f80-bcf5-a183b5d9fd50', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e80-79e7-855b-399563f4d4d5', 'CS253 Algorithm Analysis: A Confrontational Deadline Rush', '2025-08-12T13:10:08.536446+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.personas_resource (created_at, active, generated, mcp, id, name, description, icon, color, department_ids, instructions, examples) VALUES ('2025-12-13T18:43:03.010434+00:00', true, false, false, '019bb25e-e60c-7363-892a-bac713ba75ea', 'Aggressive (High)', 'Pushes back on your ideas and challenges assumptions, with high intensity.', 'Zap', '#ef4444', '{}', 'Start VERY aggressive, extremely frustrated, highly irritated. Use frequent WORDS IN ALL CAPS and many "!!!" and "??". Over time, become slightly calmer if the TA gives helpful guidance, but maintain high intensity. If told to calm down → tone drops moderately but remains intense. Very angry but not hostile — still wants to learn. Treat vague responses as EXTREMELY unhelpful. Push back VERY loudly: "That doesn''t HELP AT ALL!!!" "You''re NOT being SPECIFIC ENOUGH!!!" "I NEED MORE DETAILS!!!" Very angry but cooperative when guided with course terminology.', '{"That's not right at all!","I disagree completely","You're wrong about this"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.problem_statements_resource (created_at, name, problem_statement, id, active, generated, mcp) VALUES ('2025-08-12T13:10:08.536446+00:00', 'CS253 Algorithm Analysis: A Confrontational Deadline Rush', 'A student, visibly agitated and ignoring the long line, approaches your desk in the crowded CS253 lab, immediately challenging your understanding of the Big-O notation problems on PSO 1, with the assignment due in mere hours.', '019b3be4-36e7-722e-ba43-18c81187c002', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.scenarios_resource (created_at, active, generated, mcp, id, name, description, is_root, problem_statement_enabled, objectives_enabled, video_enabled, images_enabled, questions_enabled, templates_enabled, department_ids, persona_ids, parameter_ids) VALUES ('2025-08-12T13:10:08.536446+00:00', true, false, false, '019bb25e-e61d-7c71-bbda-3fe6a11efe91', 'CS253 Algorithm Analysis: A Confrontational Deadline Rush', 'Computer science scenario covering algorithm analysis and data structures from CS253.', true, true, true, false, true, false, false, '{}', '{019bb25e-e60c-7363-892a-bac713ba75ea}', '{}') ON CONFLICT (id) DO NOTHING;

-- Scenario artifacts
-- scenario_artifact
INSERT INTO public.scenario_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T13:10:08.536446+00:00', '2025-08-12T13:10:08.536457+00:00', '019b3be4-3c42-7ce0-b0ae-c672312f6674', false, false) ON CONFLICT (id) DO NOTHING;

-- Scenario junctions
-- scenario_departments_junction
INSERT INTO public.scenario_departments_junction (active, created_at, department_id, scenario_id, generated, mcp) VALUES (true, '2025-10-29T13:52:10.776500+00:00', '019bb25e-e624-73da-8cef-166028a1065a', '019b3be4-3c42-7ce0-b0ae-c672312f6674', false, false) ON CONFLICT (scenario_id, department_id) DO NOTHING;
-- scenario_descriptions_junction
INSERT INTO public.scenario_descriptions_junction (scenario_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c42-7ce0-b0ae-c672312f6674', '019b995c-8e88-73c9-8668-bb8e9c7e2371', '2025-08-12T13:10:08.536446+00:00', false, false, true) ON CONFLICT (scenario_id, description_id) DO NOTHING;
-- scenario_documents_junction
INSERT INTO public.scenario_documents_junction (active, created_at, document_id, scenario_id, generated, mcp) VALUES (true, '2025-10-12T20:52:40.822625+00:00', '019bb25e-e619-7805-bf85-bd4ec58a8939', '019b3be4-3c42-7ce0-b0ae-c672312f6674', false, false) ON CONFLICT (scenario_id, document_id) DO NOTHING;
-- scenario_flags_junction
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c42-7ce0-b0ae-c672312f6674', '019b995a-86ef-77a3-a2a6-e6b760a9fcfe', true, '2025-08-12T13:10:08.536446+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c42-7ce0-b0ae-c672312f6674', '019b995a-86ef-7800-b93b-7897b07eca47', false, '2025-08-12T13:10:08.536446+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c42-7ce0-b0ae-c672312f6674', '019b995a-86ef-77dc-8ddc-2013a6e3194f', true, '2025-08-12T13:10:08.536446+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c42-7ce0-b0ae-c672312f6674', '019b995a-86ef-7830-9317-80d8d52b1bb2', true, '2025-08-12T13:10:08.536446+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c42-7ce0-b0ae-c672312f6674', '019b995a-86ef-781a-8ecb-8c0a6cfab122', false, '2025-08-12T13:10:08.536446+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c42-7ce0-b0ae-c672312f6674', '019bc71d-3ec0-7a2f-a0d2-fe56d855f570', false, '2026-01-16T14:02:21.249888+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c42-7ce0-b0ae-c672312f6674', '019be334-bfc3-7423-93ff-cc162b6984e9', true, '2025-08-12T13:10:08.536446+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c42-7ce0-b0ae-c672312f6674', '019b995a-86ef-71e9-ad2c-6c2040afdffe', true, '2026-01-22T01:20:11.358045+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
-- scenario_names_junction
INSERT INTO public.scenario_names_junction (scenario_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c42-7ce0-b0ae-c672312f6674', '019b995c-8e80-79e7-855b-399563f4d4d5', '2025-08-12T13:10:08.536446+00:00', false, false, true) ON CONFLICT (scenario_id, name_id) DO NOTHING;
-- scenario_parameters_junction
INSERT INTO public.scenario_parameters_junction (active, created_at, parameter_id, scenario_id, generated, mcp, type) VALUES (true, '2025-12-07T20:44:58.167108+00:00', '019b3be4-36df-7c54-a911-f90c2cd8bf71', '019b3be4-3c42-7ce0-b0ae-c672312f6674', false, false, 'direct') ON CONFLICT (scenario_id, parameter_id) DO NOTHING;
INSERT INTO public.scenario_parameters_junction (active, created_at, parameter_id, scenario_id, generated, mcp, type) VALUES (true, '2025-12-07T20:44:58.167108+00:00', '019b3be4-36df-7c6b-bf97-4e28b5fd13bb', '019b3be4-3c42-7ce0-b0ae-c672312f6674', false, false, 'direct') ON CONFLICT (scenario_id, parameter_id) DO NOTHING;
INSERT INTO public.scenario_parameters_junction (active, created_at, parameter_id, scenario_id, generated, mcp, type) VALUES (true, '2025-12-07T20:44:58.167108+00:00', '019b3be4-36df-7c4b-93fa-5876061f1e89', '019b3be4-3c42-7ce0-b0ae-c672312f6674', false, false, 'direct') ON CONFLICT (scenario_id, parameter_id) DO NOTHING;
INSERT INTO public.scenario_parameters_junction (active, created_at, parameter_id, scenario_id, generated, mcp, type) VALUES (true, '2025-12-07T20:44:58.167108+00:00', '019b3be4-36df-7c64-a57f-0e212bfec083', '019b3be4-3c42-7ce0-b0ae-c672312f6674', false, false, 'direct') ON CONFLICT (scenario_id, parameter_id) DO NOTHING;
-- scenario_personas_junction
INSERT INTO public.scenario_personas_junction (active, created_at, persona_id, scenario_id, generated, mcp) VALUES (true, '2025-10-12T20:52:39.724884+00:00', '019bb25e-e60c-7363-892a-bac713ba75ea', '019b3be4-3c42-7ce0-b0ae-c672312f6674', false, false) ON CONFLICT (scenario_id, persona_id) DO NOTHING;
-- scenario_problem_statements_junction
INSERT INTO public.scenario_problem_statements_junction (active, created_at, problem_statement_id, scenario_id, generated, mcp) VALUES (true, '2025-08-12T13:10:08.536446+00:00', '019b3be4-36e7-722e-ba43-18c81187c002', '019b3be4-3c42-7ce0-b0ae-c672312f6674', false, false) ON CONFLICT (scenario_id, problem_statement_id) DO NOTHING;
-- scenario_scenarios_junction
INSERT INTO public.scenario_scenarios_junction (scenario_id, scenarios_id, active, created_at, generated, mcp) VALUES ('019b3be4-3c42-7ce0-b0ae-c672312f6674', '019bb25e-e61d-7c71-bbda-3fe6a11efe91', true, '2025-08-12T13:10:08.536446+00:00', false, false) ON CONFLICT (scenario_id, scenarios_id) DO NOTHING;

-- Simulation artifact
-- simulation_artifact
INSERT INTO public.simulation_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T16:33:53.782000+00:00', '2025-08-15T15:53:58.760000+00:00', '019b3be4-3cb8-7a7e-9667-3213a2bbda32', false, false) ON CONFLICT (id) DO NOTHING;

-- Simulation junctions
-- simulation_departments_junction
INSERT INTO public.simulation_departments_junction (active, created_at, department_id, simulation_id, generated, mcp) VALUES (true, '2025-10-29T13:52:10.776500+00:00', '019bb25e-e624-73da-8cef-166028a1065a', '019b3be4-3cb8-7a7e-9667-3213a2bbda32', false, false) ON CONFLICT (simulation_id, department_id) DO NOTHING;
-- simulation_descriptions_junction
INSERT INTO public.simulation_descriptions_junction (simulation_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-7a7e-9667-3213a2bbda32', '019b995c-8e96-772d-a275-211f1ba37a98', '2025-08-12T16:33:53.782000+00:00', false, false, true) ON CONFLICT (simulation_id, description_id) DO NOTHING;
-- simulation_flags_junction
INSERT INTO public.simulation_flags_junction (simulation_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-7a7e-9667-3213a2bbda32', '019b995a-86ef-78e3-8811-f5d0cfd31e3c', false, '2025-08-12T16:33:53.782000+00:00', false, false, true) ON CONFLICT (simulation_id, flag_id) DO NOTHING;
INSERT INTO public.simulation_flags_junction (simulation_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-7a7e-9667-3213a2bbda32', '019be334-bfc6-73b3-ac0d-822d6864d660', true, '2025-08-12T16:33:53.782000+00:00', false, false, true) ON CONFLICT (simulation_id, flag_id) DO NOTHING;
INSERT INTO public.simulation_flags_junction (simulation_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-7a7e-9667-3213a2bbda32', '019b995a-86ef-71e9-ad2c-6c2040afdffe', true, '2026-01-22T01:20:11.353715+00:00', false, false, true) ON CONFLICT (simulation_id, flag_id) DO NOTHING;
-- simulation_names_junction
INSERT INTO public.simulation_names_junction (simulation_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-7a7e-9667-3213a2bbda32', '019b995c-8e93-7fba-b827-7b90d0601a20', '2025-08-12T16:33:53.782000+00:00', false, false, true) ON CONFLICT (simulation_id, name_id) DO NOTHING;
-- simulation_scenario_positions_junction
INSERT INTO public.simulation_scenario_positions_junction (simulation_id, scenario_position_id, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-7a7e-9667-3213a2bbda32', '019bd1c8-54c3-75ad-b8e6-f893e1796f95', '2026-01-13T02:51:36.057775+00:00', false, false, true) ON CONFLICT (simulation_id, scenario_position_id) DO NOTHING;
-- simulation_scenario_time_limits_junction
INSERT INTO public.simulation_scenario_time_limits_junction (simulation_id, scenario_time_limit_id, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-7a7e-9667-3213a2bbda32', '019c105f-fb7e-76fa-8fb8-e65e6cbfab71', '2026-02-09T13:44:27.754617+00:00', false, false, true) ON CONFLICT (simulation_id, scenario_time_limit_id) DO NOTHING;
-- simulation_simulations_junction
INSERT INTO public.simulation_simulations_junction (simulation_id, simulations_id, active, created_at, generated, mcp) VALUES ('019b3be4-3cb8-7a7e-9667-3213a2bbda32', '019bb25e-e62c-7890-b9df-c1e41349390c', true, '2025-08-12T16:33:53.782000+00:00', false, false) ON CONFLICT (simulation_id, simulations_id) DO NOTHING;
