-- Module: Happy Practice
-- Category: simulation
-- Description: Happy Practice simulation with inline scenarios
-- ============================================================

-- Simulation resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e96-7712-8abb-da48b93ef8c4', 'Provides uplifting feedback and cheerful responses.', '2025-08-12T12:52:09.984906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e93-7feb-be32-6f91cbc60bed', 'Happy Practice', '2025-08-12T12:52:09.984906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.scenario_positions_resource (id, value, created_at, generated, mcp, scenario_id, active) VALUES ('019bd1c8-54c3-74ec-931c-1dc459c53f84', 1, '2026-01-13T02:51:36.057775+00:00', false, false, '019bb25e-e61d-7f22-b0ce-2f8bd6f51c97', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.scenario_rubrics_resource (id, created_at, generated, mcp, active, rubric_id, scenario_id) VALUES ('019bebc6-98d8-7ea4-b558-c59ebd4e1fd8', '2026-01-23T16:53:39.666863+00:00', false, false, true, '019bb25e-e608-7e93-9600-bb8e9405bccc', '019bb25e-e61d-7fbf-bae6-c970cf267ecd') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.scenario_rubrics_resource (id, created_at, generated, mcp, active, rubric_id, scenario_id) VALUES ('019bebc6-98d8-7f59-b98c-d02d503dd7b0', '2026-01-23T16:53:39.666863+00:00', false, false, true, '019bb25e-e608-7e93-9600-bb8e9405bccc', '019bb25e-e61d-7e71-a7e3-a0b9b8db40a2') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.scenario_rubrics_resource (id, created_at, generated, mcp, active, rubric_id, scenario_id) VALUES ('019bebc6-98d9-7276-8a2d-a7355b3bf15c', '2026-01-23T16:53:39.666863+00:00', false, false, true, '019bb25e-e608-7e93-9600-bb8e9405bccc', '019bb25e-e61d-7c8e-b680-8cea828a28a0') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.scenario_rubrics_resource (id, created_at, generated, mcp, active, rubric_id, scenario_id) VALUES ('019bebc6-98d9-735a-a925-a2dbc86c3f4a', '2026-01-23T16:53:39.666863+00:00', false, false, true, '019bb25e-e608-7e93-9600-bb8e9405bccc', '019bb25e-e61d-7e21-acc6-089d6081610d') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.scenario_rubrics_resource (id, created_at, generated, mcp, active, rubric_id, scenario_id) VALUES ('019bebc6-98d9-7408-9c2e-978b6f3d7f36', '2026-01-23T16:53:39.666863+00:00', false, false, true, '019bb25e-e608-7e93-9600-bb8e9405bccc', '019bb25e-e61d-7e3b-b176-a2620f4d00db') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.simulations_resource (created_at, active, generated, mcp, id, name, description, department_ids, scenario_ids) VALUES ('2025-08-12T12:52:09.984906+00:00', true, false, false, '019bb25e-e62c-7899-81e2-c49cae2dbc50', 'Happy Practice', 'Provides uplifting feedback and cheerful responses.', '{}', '{019bb25e-e61d-7f22-b0ce-2f8bd6f51c97}') ON CONFLICT (id) DO NOTHING;

-- Scenario resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e88-741c-b770-c29e2395fe6b', 'Practice scenario featuring a cheerful and positive student persona.', '2025-08-12T12:52:09.879666+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.uploads_resource (id, created_at, active, generated, mcp, upload_id) VALUES ('019bcc94-efb5-7bbd-a53a-39fd3862bf0c', '2026-01-17T15:31:11.407183+00:00', true, false, false, '019b4159-2534-76c6-a1bd-292393d6966f') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.images_resource (created_at, name, active, completed, id, description, generated, mcp, upload_id) VALUES ('2025-12-21T14:38:39.922985+00:00', 'Classroom', true, true, '019b4159-2535-7781-9419-6be634e4eadf', 'Classroom', false, false, '019bcc94-efb5-7bbd-a53a-39fd3862bf0c') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e80-7a8b-9463-e9e31661a1f0', 'Happy Scenario', '2025-08-12T12:52:09.879666+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.scenarios_resource (created_at, active, generated, mcp, id, name, description, is_root, problem_statement_enabled, objectives_enabled, video_enabled, images_enabled, questions_enabled, department_ids, persona_ids, parameter_ids, parent_id, parameter_field_ids) VALUES ('2025-08-12T12:52:09.879666+00:00', true, false, false, '019bb25e-e61d-7f22-b0ce-2f8bd6f51c97', 'Happy Scenario', 'Practice scenario featuring a cheerful and positive student persona.', true, true, true, false, false, false, '{}', '{019bb25e-e60c-72c3-8812-953686ef2201}', '{}', '019bb25e-e61d-7f22-b0ce-2f8bd6f51c97', '{}') ON CONFLICT (id) DO NOTHING;

-- Scenario artifacts
-- scenario_artifact
INSERT INTO public.scenario_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.879666+00:00', '2025-12-21T14:38:39.922985+00:00', '019b3be4-3c3a-7a28-b471-885b59021712', false, false) ON CONFLICT (id) DO NOTHING;

-- Scenario junctions
-- scenario_descriptions_junction
INSERT INTO public.scenario_descriptions_junction (scenario_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7a28-b471-885b59021712', '019b995c-8e88-741c-b770-c29e2395fe6b', '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, description_id) DO NOTHING;
-- scenario_flags_junction
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7a28-b471-885b59021712', '019b995a-86ef-77dc-8ddc-2013a6e3194f', false, '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7a28-b471-885b59021712', '019b995a-86ef-77a3-a2a6-e6b760a9fcfe', true, '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7a28-b471-885b59021712', '019b995a-86ef-781a-8ecb-8c0a6cfab122', false, '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7a28-b471-885b59021712', '019b995a-86ef-7800-b93b-7897b07eca47', false, '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7a28-b471-885b59021712', '019b995a-86ef-7830-9317-80d8d52b1bb2', true, '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7a28-b471-885b59021712', '019be334-bfc3-7423-93ff-cc162b6984e9', true, '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7a28-b471-885b59021712', '019b995a-86ef-71e9-ad2c-6c2040afdffe', true, '2026-01-22T01:20:11.358045+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
-- scenario_images_junction
INSERT INTO public.scenario_images_junction (active, created_at, image_id, scenario_id, generated, mcp) VALUES (true, '2025-12-21T14:38:39.922985+00:00', '019b4159-2535-7781-9419-6be634e4eadf', '019b3be4-3c3a-7a28-b471-885b59021712', false, false) ON CONFLICT (scenario_id, image_id) DO NOTHING;
-- scenario_names_junction
INSERT INTO public.scenario_names_junction (scenario_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7a28-b471-885b59021712', '019b995c-8e80-7a8b-9463-e9e31661a1f0', '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, name_id) DO NOTHING;
-- scenario_parameters_junction
INSERT INTO public.scenario_parameters_junction (active, created_at, parameter_id, scenario_id, generated, mcp, type) VALUES (true, '2025-12-07T20:44:58.167108+00:00', '019bb25e-e621-700f-b494-72649843abfc', '019b3be4-3c3a-7a28-b471-885b59021712', false, false, 'direct') ON CONFLICT (scenario_id, parameter_id) DO NOTHING;
INSERT INTO public.scenario_parameters_junction (active, created_at, parameter_id, scenario_id, generated, mcp, type) VALUES (true, '2025-12-07T20:44:58.167108+00:00', '019bb25e-e621-7014-938e-88976a9c0f43', '019b3be4-3c3a-7a28-b471-885b59021712', false, false, 'direct') ON CONFLICT (scenario_id, parameter_id) DO NOTHING;
INSERT INTO public.scenario_parameters_junction (active, created_at, parameter_id, scenario_id, generated, mcp, type) VALUES (true, '2025-12-07T20:44:58.167108+00:00', '019bb25e-e621-7023-a8a1-e0f52a01224d', '019b3be4-3c3a-7a28-b471-885b59021712', false, false, 'direct') ON CONFLICT (scenario_id, parameter_id) DO NOTHING;
INSERT INTO public.scenario_parameters_junction (active, created_at, parameter_id, scenario_id, generated, mcp, type) VALUES (true, '2025-12-07T20:44:58.167108+00:00', '019bb25e-e621-701f-86f5-ee5cdc68a584', '019b3be4-3c3a-7a28-b471-885b59021712', false, false, 'direct') ON CONFLICT (scenario_id, parameter_id) DO NOTHING;
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
INSERT INTO public.simulation_flags_junction (simulation_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-7a8d-b67c-d82a556d461e', '019b995a-86ef-78e3-8811-f5d0cfd31e3c', true, '2025-08-12T12:52:09.984906+00:00', false, false, true) ON CONFLICT (simulation_id, flag_id) DO NOTHING;
INSERT INTO public.simulation_flags_junction (simulation_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-7a8d-b67c-d82a556d461e', '019be334-bfc6-73b3-ac0d-822d6864d660', true, '2025-08-12T12:52:09.984906+00:00', false, false, true) ON CONFLICT (simulation_id, flag_id) DO NOTHING;
INSERT INTO public.simulation_flags_junction (simulation_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-7a8d-b67c-d82a556d461e', '019b995a-86ef-71e9-ad2c-6c2040afdffe', true, '2026-01-22T01:20:11.353715+00:00', false, false, true) ON CONFLICT (simulation_id, flag_id) DO NOTHING;
-- simulation_names_junction
INSERT INTO public.simulation_names_junction (simulation_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-7a8d-b67c-d82a556d461e', '019b995c-8e93-7feb-be32-6f91cbc60bed', '2025-08-12T12:52:09.984906+00:00', false, false, true) ON CONFLICT (simulation_id, name_id) DO NOTHING;
-- simulation_scenario_positions_junction
INSERT INTO public.simulation_scenario_positions_junction (simulation_id, scenario_position_id, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-7a8d-b67c-d82a556d461e', '019bd1c8-54c3-74ec-931c-1dc459c53f84', '2026-01-13T02:51:36.057775+00:00', false, false, true) ON CONFLICT (simulation_id, scenario_position_id) DO NOTHING;
-- simulation_scenario_rubrics_junction
INSERT INTO public.simulation_scenario_rubrics_junction (simulation_id, scenario_rubric_id, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-7a8d-b67c-d82a556d461e', '019bebc6-98d8-7ea4-b558-c59ebd4e1fd8', '2026-01-23T16:53:39.677411+00:00', false, false, true) ON CONFLICT (simulation_id, scenario_rubric_id) DO NOTHING;
INSERT INTO public.simulation_scenario_rubrics_junction (simulation_id, scenario_rubric_id, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-7a8d-b67c-d82a556d461e', '019bebc6-98d8-7f59-b98c-d02d503dd7b0', '2026-01-23T16:53:39.677411+00:00', false, false, true) ON CONFLICT (simulation_id, scenario_rubric_id) DO NOTHING;
INSERT INTO public.simulation_scenario_rubrics_junction (simulation_id, scenario_rubric_id, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-7a8d-b67c-d82a556d461e', '019bebc6-98d9-7276-8a2d-a7355b3bf15c', '2026-01-23T16:53:39.677411+00:00', false, false, true) ON CONFLICT (simulation_id, scenario_rubric_id) DO NOTHING;
INSERT INTO public.simulation_scenario_rubrics_junction (simulation_id, scenario_rubric_id, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-7a8d-b67c-d82a556d461e', '019bebc6-98d9-735a-a925-a2dbc86c3f4a', '2026-01-23T16:53:39.677411+00:00', false, false, true) ON CONFLICT (simulation_id, scenario_rubric_id) DO NOTHING;
INSERT INTO public.simulation_scenario_rubrics_junction (simulation_id, scenario_rubric_id, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-7a8d-b67c-d82a556d461e', '019bebc6-98d9-7408-9c2e-978b6f3d7f36', '2026-01-23T16:53:39.677411+00:00', false, false, true) ON CONFLICT (simulation_id, scenario_rubric_id) DO NOTHING;
-- simulation_simulations_junction
INSERT INTO public.simulation_simulations_junction (simulation_id, simulations_id, active, created_at, generated, mcp) VALUES ('019b3be4-3cb8-7a8d-b67c-d82a556d461e', '019bb25e-e62c-7899-81e2-c49cae2dbc50', true, '2025-08-12T12:52:09.984906+00:00', false, false) ON CONFLICT (simulation_id, simulations_id) DO NOTHING;
