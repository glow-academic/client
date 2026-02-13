-- Module: Confused Scenario
-- Category: scenario
-- Description: Confused Scenario scenario
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e88-7416-bade-488905253af6', 'Practice scenario featuring a confused or uncertain student persona.', '2025-08-12T12:52:09.879666+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.images_resource (created_at, name, active, completed, id, description, generated, mcp, upload_id) VALUES ('2025-12-21T14:38:39.922985+00:00', 'Classroom', true, true, '019b4159-2535-7781-9419-6be634e4eadf', 'Classroom', false, false, '019b4159-2534-76c6-a1bd-292393d6966f') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e80-7af1-8b0c-434eb3fdc669', 'Confused Scenario', '2025-08-12T12:52:09.879666+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.scenarios_resource (created_at, active, generated, mcp, id, name, description, is_root, problem_statement_enabled, objectives_enabled, video_enabled, images_enabled, questions_enabled, department_ids, persona_ids, parameter_ids, parent_id) VALUES ('2025-08-12T12:52:09.879666+00:00', true, false, false, '019bb25e-e61d-7f0d-8cb0-426ba262f584', 'Confused Scenario', 'Practice scenario featuring a confused or uncertain student persona.', true, true, true, false, false, false, '{}', '{019bb25e-e60c-7345-ac6d-50d29df6deb3}', '{}', '019bb25e-e61d-7f0d-8cb0-426ba262f584') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- scenario_artifact
INSERT INTO public.scenario_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.879666+00:00', '2025-12-21T14:38:39.922985+00:00', '019b3be4-3c3a-7a3d-963c-a55073c3c21c', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- scenario_descriptions_junction
INSERT INTO public.scenario_descriptions_junction (scenario_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7a3d-963c-a55073c3c21c', '019b995c-8e88-7416-bade-488905253af6', '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, description_id) DO NOTHING;
-- scenario_flags_junction
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7a3d-963c-a55073c3c21c', '019b995a-86ef-77dc-8ddc-2013a6e3194f', false, '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7a3d-963c-a55073c3c21c', '019b995a-86ef-77a3-a2a6-e6b760a9fcfe', true, '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7a3d-963c-a55073c3c21c', '019b995a-86ef-781a-8ecb-8c0a6cfab122', false, '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7a3d-963c-a55073c3c21c', '019b995a-86ef-7800-b93b-7897b07eca47', false, '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7a3d-963c-a55073c3c21c', '019b995a-86ef-7830-9317-80d8d52b1bb2', true, '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7a3d-963c-a55073c3c21c', '019be334-bfc3-7423-93ff-cc162b6984e9', true, '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7a3d-963c-a55073c3c21c', '019b995a-86ef-71e9-ad2c-6c2040afdffe', true, '2026-01-22T01:20:11.358045+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
-- scenario_images_junction
INSERT INTO public.scenario_images_junction (active, created_at, image_id, scenario_id, generated, mcp) VALUES (true, '2025-12-21T14:38:39.922985+00:00', '019b4159-2535-7781-9419-6be634e4eadf', '019b3be4-3c3a-7a3d-963c-a55073c3c21c', false, false) ON CONFLICT (scenario_id, image_id) DO NOTHING;
-- scenario_names_junction
INSERT INTO public.scenario_names_junction (scenario_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7a3d-963c-a55073c3c21c', '019b995c-8e80-7af1-8b0c-434eb3fdc669', '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, name_id) DO NOTHING;
-- scenario_parameters_junction
INSERT INTO public.scenario_parameters_junction (active, created_at, parameter_id, scenario_id, generated, mcp, type) VALUES (true, '2025-12-07T20:44:58.167108+00:00', '019bb25e-e621-700f-b494-72649843abfc', '019b3be4-3c3a-7a3d-963c-a55073c3c21c', false, false, 'direct') ON CONFLICT (scenario_id, parameter_id) DO NOTHING;
INSERT INTO public.scenario_parameters_junction (active, created_at, parameter_id, scenario_id, generated, mcp, type) VALUES (true, '2025-12-07T20:44:58.167108+00:00', '019bb25e-e621-701f-86f5-ee5cdc68a584', '019b3be4-3c3a-7a3d-963c-a55073c3c21c', false, false, 'direct') ON CONFLICT (scenario_id, parameter_id) DO NOTHING;
INSERT INTO public.scenario_parameters_junction (active, created_at, parameter_id, scenario_id, generated, mcp, type) VALUES (true, '2025-12-07T20:44:58.167108+00:00', '019bb25e-e621-7014-938e-88976a9c0f43', '019b3be4-3c3a-7a3d-963c-a55073c3c21c', false, false, 'direct') ON CONFLICT (scenario_id, parameter_id) DO NOTHING;
INSERT INTO public.scenario_parameters_junction (active, created_at, parameter_id, scenario_id, generated, mcp, type) VALUES (true, '2025-12-07T20:44:58.167108+00:00', '019bb25e-e621-7023-a8a1-e0f52a01224d', '019b3be4-3c3a-7a3d-963c-a55073c3c21c', false, false, 'direct') ON CONFLICT (scenario_id, parameter_id) DO NOTHING;
-- scenario_personas_junction
INSERT INTO public.scenario_personas_junction (active, created_at, persona_id, scenario_id, generated, mcp) VALUES (true, '2025-10-12T20:52:39.724884+00:00', '019bb25e-e60c-7345-ac6d-50d29df6deb3', '019b3be4-3c3a-7a3d-963c-a55073c3c21c', false, false) ON CONFLICT (scenario_id, persona_id) DO NOTHING;
-- scenario_scenarios_junction
INSERT INTO public.scenario_scenarios_junction (scenario_id, scenarios_id, active, created_at, generated, mcp) VALUES ('019b3be4-3c3a-7a3d-963c-a55073c3c21c', '019bb25e-e61d-7f0d-8cb0-426ba262f584', true, '2025-08-12T12:52:09.879666+00:00', false, false) ON CONFLICT (scenario_id, scenarios_id) DO NOTHING;
