-- Module: Happy Practice
-- Category: simulation
-- Description: Happy Practice simulation with inline scenarios
-- ============================================================

-- Simulation resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e96-7712-8abb-da48b93ef8c4', 'Provides uplifting feedback and cheerful responses.', '2025-08-12T12:52:09.984906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e93-7feb-be32-6f91cbc60bed', 'Happy Practice', '2025-08-12T12:52:09.984906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.simulations_resource (created_at, active, generated, mcp, id, name, description, department_ids, scenario_ids, scenario_rubric_ids, scenario_time_limit_ids, scenario_position_ids, scenario_flag_ids, practice) VALUES ('2025-08-12T12:52:09.984906+00:00', true, false, false, '019bb25e-e62c-7899-81e2-c49cae2dbc50', 'Happy Practice', 'Provides uplifting feedback and cheerful responses.', '{}', '{019bb25e-e61d-7f22-b0ce-2f8bd6f51c97}', '{}', '{}', '{}', '{}', true) ON CONFLICT (id) DO NOTHING;

-- Scenario resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e88-741c-b770-c29e2395fe6b', 'Practice scenario featuring a cheerful and positive student persona.', '2025-08-12T12:52:09.879666+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.images_resource (created_at, name, active, id, description, generated, mcp) VALUES ('2025-12-21T14:38:39.922985+00:00', 'Classroom', true, '019b4159-2535-7781-9419-6be634e4eadf', 'Classroom', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e80-7a8b-9463-e9e31661a1f0', 'Happy Scenario', '2025-08-12T12:52:09.879666+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.scenarios_resource (created_at, active, generated, mcp, id, name, description, problem_statement_enabled, objectives_enabled, video_enabled, images_enabled, questions_enabled, department_ids, persona_ids, parameter_field_ids, document_ids, objective_ids, image_ids, video_ids, question_ids, option_ids, problem_statement_ids) VALUES ('2025-08-12T12:52:09.879666+00:00', true, false, false, '019bb25e-e61d-7f22-b0ce-2f8bd6f51c97', 'Happy Scenario', 'Practice scenario featuring a cheerful and positive student persona.', true, true, false, false, false, '{}', '{019bb25e-e60c-72c3-8812-953686ef2201}', '{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}') ON CONFLICT (id) DO NOTHING;

-- Scenario artifacts
-- scenario_artifact
INSERT INTO public.scenario_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.879666+00:00', '2025-12-21T14:38:39.922985+00:00', '019b3be4-3c3a-7a28-b471-885b59021712', false, false) ON CONFLICT (id) DO NOTHING;

-- Scenario junctions
-- scenario_descriptions_junction
INSERT INTO public.scenario_descriptions_junction (scenario_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7a28-b471-885b59021712', '019b995c-8e88-741c-b770-c29e2395fe6b', '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, description_id) DO NOTHING;
-- scenario_flags_junction
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7a28-b471-885b59021712', '019b995a-86ef-77dc-8ddc-2013a6e3194f', '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7a28-b471-885b59021712', '019b995a-86ef-77a3-a2a6-e6b760a9fcfe', '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7a28-b471-885b59021712', '019b995a-86ef-781a-8ecb-8c0a6cfab122', '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7a28-b471-885b59021712', '019b995a-86ef-7800-b93b-7897b07eca47', '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7a28-b471-885b59021712', '019b995a-86ef-7830-9317-80d8d52b1bb2', '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7a28-b471-885b59021712', '019be334-bfc3-7423-93ff-cc162b6984e9', '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7a28-b471-885b59021712', '019b995a-86ef-71e9-ad2c-6c2040afdffe', '2026-01-22T01:20:11.358045+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7a28-b471-885b59021712', '019c7307-6fd9-7487-aaea-6d896596223b', '2026-02-18T23:13:13.181902+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7a28-b471-885b59021712', '019c7307-6fd9-74b2-bc6a-ad91933ee830', '2026-02-18T23:13:13.181902+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7a28-b471-885b59021712', '019c7307-6fd8-7fa2-955b-b06b6c5f9896', '2026-02-18T23:13:13.181902+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7a28-b471-885b59021712', '019c7307-6fd9-73ba-ab1f-03fb6719f8dd', '2026-02-18T23:13:13.181902+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7a28-b471-885b59021712', '019c7307-6fd9-7433-ad75-ac78d08e7ede', '2026-02-18T23:13:13.181902+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7a28-b471-885b59021712', '019c7307-6fd9-7454-8f14-6f55256edc46', '2026-02-18T23:13:13.181902+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
-- scenario_images_junction
INSERT INTO public.scenario_images_junction (active, created_at, image_id, scenario_id, generated, mcp) VALUES (true, '2025-12-21T14:38:39.922985+00:00', '019b4159-2535-7781-9419-6be634e4eadf', '019b3be4-3c3a-7a28-b471-885b59021712', false, false) ON CONFLICT (scenario_id, image_id) DO NOTHING;
-- scenario_names_junction
INSERT INTO public.scenario_names_junction (scenario_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7a28-b471-885b59021712', '019b995c-8e80-7a8b-9463-e9e31661a1f0', '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, name_id) DO NOTHING;
-- scenario_personas_junction
INSERT INTO public.scenario_personas_junction (active, created_at, persona_id, scenario_id, generated, mcp) VALUES (true, '2025-10-12T20:52:39.724884+00:00', '019bb25e-e60c-72c3-8812-953686ef2201', '019b3be4-3c3a-7a28-b471-885b59021712', false, false) ON CONFLICT (scenario_id, persona_id) DO NOTHING;
-- scenario_scenarios_junction
INSERT INTO public.scenario_scenarios_junction (scenario_id, scenarios_id, active, created_at, generated, mcp) VALUES ('019b3be4-3c3a-7a28-b471-885b59021712', '019bb25e-e61d-7f22-b0ce-2f8bd6f51c97', true, '2025-08-12T12:52:09.879666+00:00', false, false) ON CONFLICT (scenario_id, scenarios_id) DO NOTHING;

-- Simulation artifact
-- simulation_artifact
INSERT INTO public.simulation_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.984906+00:00', '2025-08-12T12:52:09.984906+00:00', '019b3be4-3cb8-7a8d-b67c-d82a556d461e', false, false) ON CONFLICT (id) DO NOTHING;

-- Simulation junctions
-- simulation_descriptions_junction
INSERT INTO public.simulation_descriptions_junction (simulation_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-7a8d-b67c-d82a556d461e', '019b995c-8e96-7712-8abb-da48b93ef8c4', '2025-08-12T12:52:09.984906+00:00', false, false, true) ON CONFLICT (simulation_id, description_id) DO NOTHING;
-- simulation_flags_junction
INSERT INTO public.simulation_flags_junction (simulation_id, flag_id, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-7a8d-b67c-d82a556d461e', '019b995a-86ef-78e3-8811-f5d0cfd31e3c', '2025-08-12T12:52:09.984906+00:00', false, false, true) ON CONFLICT (simulation_id, flag_id) DO NOTHING;
INSERT INTO public.simulation_flags_junction (simulation_id, flag_id, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-7a8d-b67c-d82a556d461e', '019be334-bfc6-73b3-ac0d-822d6864d660', '2025-08-12T12:52:09.984906+00:00', false, false, true) ON CONFLICT (simulation_id, flag_id) DO NOTHING;
INSERT INTO public.simulation_flags_junction (simulation_id, flag_id, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-7a8d-b67c-d82a556d461e', '019b995a-86ef-71e9-ad2c-6c2040afdffe', '2026-01-22T01:20:11.353715+00:00', false, false, true) ON CONFLICT (simulation_id, flag_id) DO NOTHING;
-- simulation_names_junction
INSERT INTO public.simulation_names_junction (simulation_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-7a8d-b67c-d82a556d461e', '019b995c-8e93-7feb-be32-6f91cbc60bed', '2025-08-12T12:52:09.984906+00:00', false, false, true) ON CONFLICT (simulation_id, name_id) DO NOTHING;
-- simulation_simulations_junction
INSERT INTO public.simulation_simulations_junction (simulation_id, simulations_id, active, created_at, generated, mcp) VALUES ('019b3be4-3cb8-7a8d-b67c-d82a556d461e', '019bb25e-e62c-7899-81e2-c49cae2dbc50', true, '2025-08-12T12:52:09.984906+00:00', false, false) ON CONFLICT (simulation_id, simulations_id) DO NOTHING;
