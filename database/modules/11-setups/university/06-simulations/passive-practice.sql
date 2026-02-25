-- Module: Passive Practice
-- Category: simulation
-- Description: Passive Practice simulation with inline scenarios
-- ============================================================

-- Simulation resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e96-7727-a847-99bf2b14c737', 'Low engagement and a tendency to avoid conflict or assertiveness.', '2025-08-12T12:52:09.984906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e93-7fff-9b2a-c4e3b0544563', 'Passive Practice', '2025-08-12T12:52:09.984906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.scenario_positions_resource (id, value, created_at, generated, mcp, scenario_id, active) VALUES ('019bd1c8-54c3-7483-8c52-6c80416affee', 1, '2026-01-13T02:51:36.057775+00:00', false, false, '019bb25e-e61d-7f2b-90fe-0ddfddd5d737', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.simulations_resource (created_at, active, generated, mcp, id, name, description, department_ids, scenario_ids, scenario_rubric_ids, scenario_time_limit_ids, scenario_position_ids, scenario_flag_ids, practice) VALUES ('2025-08-12T12:52:09.984906+00:00', true, false, false, '019bb25e-e62c-78b0-9cc1-39f25f8db3ef', 'Passive Practice', 'Low engagement and a tendency to avoid conflict or assertiveness.', '{}', '{019bb25e-e61d-7f2b-90fe-0ddfddd5d737}', '{}', '{}', '{}', '{}', true) ON CONFLICT (id) DO NOTHING;

-- Scenario resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e88-73f5-a31f-12ea97be748c', 'Practice scenario featuring a passive or hesitant student persona.', '2025-08-12T12:52:09.879666+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.images_resource (created_at, name, active, id, description, generated, mcp) VALUES ('2025-12-21T14:38:39.922985+00:00', 'Classroom', true, '019b4159-2535-7781-9419-6be634e4eadf', 'Classroom', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e80-7a0f-8866-d0c790a52e33', 'Passive Scenario', '2025-08-12T12:52:09.879666+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.scenarios_resource (created_at, active, generated, mcp, id, name, description, problem_statement_enabled, objectives_enabled, video_enabled, images_enabled, questions_enabled, department_ids, persona_ids, parameter_field_ids, document_ids, objective_ids, image_ids, video_ids, question_ids, option_ids, problem_statement_ids) VALUES ('2025-08-12T12:52:09.879666+00:00', true, false, false, '019bb25e-e61d-7f2b-90fe-0ddfddd5d737', 'Passive Scenario', 'Practice scenario featuring a passive or hesitant student persona.', true, true, false, false, false, '{}', '{019bb25e-e60c-734d-ac5b-d849214dd5ac}', '{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}') ON CONFLICT (id) DO NOTHING;

-- Scenario artifacts
-- scenario_artifact
INSERT INTO public.scenario_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.879666+00:00', '2025-12-21T14:38:39.922985+00:00', '019b3be4-3c3a-78e8-bf18-b56c48c37352', false, false) ON CONFLICT (id) DO NOTHING;

-- Scenario junctions
-- scenario_descriptions_junction
INSERT INTO public.scenario_descriptions_junction (scenario_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-78e8-bf18-b56c48c37352', '019b995c-8e88-73f5-a31f-12ea97be748c', '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, description_id) DO NOTHING;
-- scenario_flags_junction
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-78e8-bf18-b56c48c37352', '019b995a-86ef-77dc-8ddc-2013a6e3194f', false, '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-78e8-bf18-b56c48c37352', '019b995a-86ef-77a3-a2a6-e6b760a9fcfe', true, '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-78e8-bf18-b56c48c37352', '019b995a-86ef-781a-8ecb-8c0a6cfab122', false, '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-78e8-bf18-b56c48c37352', '019b995a-86ef-7800-b93b-7897b07eca47', false, '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-78e8-bf18-b56c48c37352', '019b995a-86ef-7830-9317-80d8d52b1bb2', true, '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-78e8-bf18-b56c48c37352', '019be334-bfc3-7423-93ff-cc162b6984e9', true, '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-78e8-bf18-b56c48c37352', '019b995a-86ef-71e9-ad2c-6c2040afdffe', true, '2026-01-22T01:20:11.358045+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-78e8-bf18-b56c48c37352', '019c7307-6fd9-73ba-ab1f-03fb6719f8dd', true, '2026-02-18T23:13:13.181902+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-78e8-bf18-b56c48c37352', '019c7307-6fd9-7433-ad75-ac78d08e7ede', true, '2026-02-18T23:13:13.181902+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-78e8-bf18-b56c48c37352', '019c7307-6fd9-7454-8f14-6f55256edc46', true, '2026-02-18T23:13:13.181902+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-78e8-bf18-b56c48c37352', '019c7307-6fd9-7487-aaea-6d896596223b', true, '2026-02-18T23:13:13.181902+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-78e8-bf18-b56c48c37352', '019c7307-6fd9-74b2-bc6a-ad91933ee830', true, '2026-02-18T23:13:13.181902+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-78e8-bf18-b56c48c37352', '019c7307-6fd8-7fa2-955b-b06b6c5f9896', true, '2026-02-18T23:13:13.181902+00:00', false, false, true) ON CONFLICT (scenario_id, flag_id) DO NOTHING;
-- scenario_images_junction
INSERT INTO public.scenario_images_junction (active, created_at, image_id, scenario_id, generated, mcp) VALUES (true, '2025-12-21T14:38:39.922985+00:00', '019b4159-2535-7781-9419-6be634e4eadf', '019b3be4-3c3a-78e8-bf18-b56c48c37352', false, false) ON CONFLICT (scenario_id, image_id) DO NOTHING;
-- scenario_names_junction
INSERT INTO public.scenario_names_junction (scenario_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-78e8-bf18-b56c48c37352', '019b995c-8e80-7a0f-8866-d0c790a52e33', '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, name_id) DO NOTHING;
-- scenario_personas_junction
INSERT INTO public.scenario_personas_junction (active, created_at, persona_id, scenario_id, generated, mcp) VALUES (true, '2025-10-12T20:52:39.724884+00:00', '019bb25e-e60c-734d-ac5b-d849214dd5ac', '019b3be4-3c3a-78e8-bf18-b56c48c37352', false, false) ON CONFLICT (scenario_id, persona_id) DO NOTHING;
-- scenario_scenarios_junction
INSERT INTO public.scenario_scenarios_junction (scenario_id, scenarios_id, active, created_at, generated, mcp) VALUES ('019b3be4-3c3a-78e8-bf18-b56c48c37352', '019bb25e-e61d-7f2b-90fe-0ddfddd5d737', true, '2025-08-12T12:52:09.879666+00:00', false, false) ON CONFLICT (scenario_id, scenarios_id) DO NOTHING;

-- Simulation artifact
-- simulation_artifact
INSERT INTO public.simulation_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.984906+00:00', '2025-08-12T12:52:09.984906+00:00', '019b3be4-3cb8-7ad7-ae1a-c8cb23791135', false, false) ON CONFLICT (id) DO NOTHING;

-- Simulation junctions
-- simulation_descriptions_junction
INSERT INTO public.simulation_descriptions_junction (simulation_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-7ad7-ae1a-c8cb23791135', '019b995c-8e96-7727-a847-99bf2b14c737', '2025-08-12T12:52:09.984906+00:00', false, false, true) ON CONFLICT (simulation_id, description_id) DO NOTHING;
-- simulation_flags_junction
INSERT INTO public.simulation_flags_junction (simulation_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-7ad7-ae1a-c8cb23791135', '019b995a-86ef-78e3-8811-f5d0cfd31e3c', true, '2025-08-12T12:52:09.984906+00:00', false, false, true) ON CONFLICT (simulation_id, flag_id) DO NOTHING;
INSERT INTO public.simulation_flags_junction (simulation_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-7ad7-ae1a-c8cb23791135', '019be334-bfc6-73b3-ac0d-822d6864d660', true, '2025-08-12T12:52:09.984906+00:00', false, false, true) ON CONFLICT (simulation_id, flag_id) DO NOTHING;
INSERT INTO public.simulation_flags_junction (simulation_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-7ad7-ae1a-c8cb23791135', '019b995a-86ef-71e9-ad2c-6c2040afdffe', true, '2026-01-22T01:20:11.353715+00:00', false, false, true) ON CONFLICT (simulation_id, flag_id) DO NOTHING;
-- simulation_names_junction
INSERT INTO public.simulation_names_junction (simulation_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-7ad7-ae1a-c8cb23791135', '019b995c-8e93-7fff-9b2a-c4e3b0544563', '2025-08-12T12:52:09.984906+00:00', false, false, true) ON CONFLICT (simulation_id, name_id) DO NOTHING;
-- simulation_scenario_positions_junction
INSERT INTO public.simulation_scenario_positions_junction (simulation_id, scenario_position_id, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-7ad7-ae1a-c8cb23791135', '019bd1c8-54c3-7483-8c52-6c80416affee', '2026-01-13T02:51:36.057775+00:00', false, false, true) ON CONFLICT (simulation_id, scenario_position_id) DO NOTHING;
-- simulation_simulations_junction
INSERT INTO public.simulation_simulations_junction (simulation_id, simulations_id, active, created_at, generated, mcp) VALUES ('019b3be4-3cb8-7ad7-ae1a-c8cb23791135', '019bb25e-e62c-78b0-9cc1-39f25f8db3ef', true, '2025-08-12T12:52:09.984906+00:00', false, false) ON CONFLICT (simulation_id, simulations_id) DO NOTHING;
