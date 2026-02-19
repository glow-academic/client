-- Module: General Scenario
-- Category: scenario
-- Description: General Scenario scenario
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e88-7411-9ca3-b6320b225573', 'General purpose scenario for flexible practice across various situations.', '2025-08-12T12:52:09.879666+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e80-7a56-b755-f6330dbf98a9', 'General Scenario', '2025-08-12T12:52:09.879666+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.scenarios_resource (created_at, active, generated, mcp, id, name, description, problem_statement_enabled, objectives_enabled, video_enabled, images_enabled, questions_enabled, department_ids, persona_ids, parameter_ids, parameter_field_ids) VALUES ('2025-08-12T12:52:09.879666+00:00', true, false, false, '019bb25e-e61d-7efa-8819-7dcb0cf829f8', 'General Scenario', 'General purpose scenario for flexible practice across various situations.', true, true, false, true, false, '{}', '{}', '{}', '{}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- scenario_artifact
INSERT INTO public.scenario_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.879666+00:00', '2025-08-12T12:52:09.879666+00:00', '019b3be4-3c3a-7921-87f3-166765531ad9', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- scenario_descriptions_junction
INSERT INTO public.scenario_descriptions_junction (scenario_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7921-87f3-166765531ad9', '019b995c-8e88-7411-9ca3-b6320b225573', '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, description_id) DO NOTHING;
-- scenario_flags_junction
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7921-87f3-166765531ad9', '019b995a-86ef-77dc-8ddc-2013a6e3194f', true, '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7921-87f3-166765531ad9', '019b995a-86ef-77a3-a2a6-e6b760a9fcfe', true, '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7921-87f3-166765531ad9', '019b995a-86ef-781a-8ecb-8c0a6cfab122', false, '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7921-87f3-166765531ad9', '019b995a-86ef-7800-b93b-7897b07eca47', false, '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7921-87f3-166765531ad9', '019b995a-86ef-7830-9317-80d8d52b1bb2', true, '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7921-87f3-166765531ad9', '019be334-bfc3-7423-93ff-cc162b6984e9', true, '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7921-87f3-166765531ad9', '019b995a-86ef-71e9-ad2c-6c2040afdffe', true, '2026-01-22T01:20:11.358045+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7921-87f3-166765531ad9', '019c7307-6fd9-7454-8f14-6f55256edc46', true, '2026-02-18T23:13:13.181902+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7921-87f3-166765531ad9', '019c7307-6fd9-7433-ad75-ac78d08e7ede', true, '2026-02-18T23:13:13.181902+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7921-87f3-166765531ad9', '019c7307-6fd9-73ba-ab1f-03fb6719f8dd', true, '2026-02-18T23:13:13.181902+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7921-87f3-166765531ad9', '019c7307-6fd8-7fa2-955b-b06b6c5f9896', true, '2026-02-18T23:13:13.181902+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7921-87f3-166765531ad9', '019c7307-6fd9-74b2-bc6a-ad91933ee830', true, '2026-02-18T23:13:13.181902+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7921-87f3-166765531ad9', '019c7307-6fd9-7487-aaea-6d896596223b', true, '2026-02-18T23:13:13.181902+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
-- scenario_names_junction
INSERT INTO public.scenario_names_junction (scenario_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7921-87f3-166765531ad9', '019b995c-8e80-7a56-b755-f6330dbf98a9', '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, name_id) DO NOTHING;
-- scenario_parameters_junction
INSERT INTO public.scenario_parameters_junction (active, created_at, parameter_id, scenario_id, generated, mcp, type) VALUES (true, '2025-12-07T20:44:58.167108+00:00', '019bb25e-e621-701f-86f5-ee5cdc68a584', '019b3be4-3c3a-7921-87f3-166765531ad9', false, false, 'direct') ON CONFLICT (scenario_id, parameter_id) DO NOTHING;
INSERT INTO public.scenario_parameters_junction (active, created_at, parameter_id, scenario_id, generated, mcp, type) VALUES (true, '2025-12-07T20:44:58.167108+00:00', '019bb25e-e621-700f-b494-72649843abfc', '019b3be4-3c3a-7921-87f3-166765531ad9', false, false, 'direct') ON CONFLICT (scenario_id, parameter_id) DO NOTHING;
INSERT INTO public.scenario_parameters_junction (active, created_at, parameter_id, scenario_id, generated, mcp, type) VALUES (true, '2025-12-07T20:44:58.167108+00:00', '019bb25e-e621-7023-a8a1-e0f52a01224d', '019b3be4-3c3a-7921-87f3-166765531ad9', false, false, 'direct') ON CONFLICT (scenario_id, parameter_id) DO NOTHING;
INSERT INTO public.scenario_parameters_junction (active, created_at, parameter_id, scenario_id, generated, mcp, type) VALUES (true, '2025-12-07T20:44:58.167108+00:00', '019bb25e-e621-7014-938e-88976a9c0f43', '019b3be4-3c3a-7921-87f3-166765531ad9', false, false, 'direct') ON CONFLICT (scenario_id, parameter_id) DO NOTHING;
-- scenario_scenarios_junction
INSERT INTO public.scenario_scenarios_junction (scenario_id, scenarios_id, active, created_at, generated, mcp) VALUES ('019b3be4-3c3a-7921-87f3-166765531ad9', '019bb25e-e61d-7efa-8819-7dcb0cf829f8', true, '2025-08-12T12:52:09.879666+00:00', false, false) ON CONFLICT (scenario_id, scenarios_id) DO NOTHING;
