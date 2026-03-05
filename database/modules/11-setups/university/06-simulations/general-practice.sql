-- Module: General Practice
-- Category: simulation
-- Description: General Practice simulation with inline scenarios
-- ============================================================

-- Simulation resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e96-7734-bde8-42600e28f00a', 'A flexible simulation for open-ended practice with any persona.', '2025-08-12T12:52:09.984906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e93-7fe5-bd42-3eb6e1517d0a', 'General Practice', '2025-08-12T12:52:09.984906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.simulations_resource (created_at, active, generated, mcp, id, name, description, department_ids, scenario_ids, scenario_rubric_ids, scenario_time_limit_ids, scenario_position_ids, scenario_flag_ids, practice) VALUES ('2025-08-12T12:52:09.984906+00:00', true, false, false, '019bb25e-e62c-78a4-a556-64cb01be3d92', 'General Practice', 'A flexible simulation for open-ended practice with any persona.', '{}', '{019bb25e-e61d-7efa-8819-7dcb0cf829f8}', '{}', '{}', '{}', '{}', true) ON CONFLICT (id) DO NOTHING;

-- Scenario resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e88-7411-9ca3-b6320b225573', 'General purpose scenario for flexible practice across various situations.', '2025-08-12T12:52:09.879666+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e80-7a56-b755-f6330dbf98a9', 'General Scenario', '2025-08-12T12:52:09.879666+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.scenarios_resource (created_at, active, generated, mcp, id, name, description, problem_statement_enabled, objectives_enabled, video_enabled, images_enabled, questions_enabled, department_ids, persona_ids, parameter_field_ids, document_ids, objective_ids, image_ids, video_ids, question_ids, option_ids, problem_statement_ids) VALUES ('2025-08-12T12:52:09.879666+00:00', true, false, false, '019bb25e-e61d-7efa-8819-7dcb0cf829f8', 'General Scenario', 'General purpose scenario for flexible practice across various situations.', true, true, false, true, false, '{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}') ON CONFLICT (id) DO NOTHING;

-- Scenario artifacts
-- scenario_artifact
INSERT INTO public.scenario_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.879666+00:00', '2025-08-12T12:52:09.879666+00:00', '019b3be4-3c3a-7921-87f3-166765531ad9', false, false) ON CONFLICT (id) DO NOTHING;

-- Scenario junctions
-- scenario_descriptions_junction
INSERT INTO public.scenario_descriptions_junction (scenario_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7921-87f3-166765531ad9', '019b995c-8e88-7411-9ca3-b6320b225573', '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, descriptions_id) DO NOTHING;
-- scenario_flags_junction
INSERT INTO public.scenario_flags_junction (scenario_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7921-87f3-166765531ad9', '019b995a-86ef-77dc-8ddc-2013a6e3194f', '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, flags_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7921-87f3-166765531ad9', '019b995a-86ef-77a3-a2a6-e6b760a9fcfe', '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, flags_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7921-87f3-166765531ad9', '019b995a-86ef-781a-8ecb-8c0a6cfab122', '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, flags_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7921-87f3-166765531ad9', '019b995a-86ef-7800-b93b-7897b07eca47', '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, flags_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7921-87f3-166765531ad9', '019b995a-86ef-7830-9317-80d8d52b1bb2', '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, flags_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7921-87f3-166765531ad9', '019be334-bfc3-7423-93ff-cc162b6984e9', '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, flags_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7921-87f3-166765531ad9', '019b995a-86ef-71e9-ad2c-6c2040afdffe', '2026-01-22T01:20:11.358045+00:00', false, false, true) ON CONFLICT (scenario_id, flags_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7921-87f3-166765531ad9', '019c7307-6fd9-7454-8f14-6f55256edc46', '2026-02-18T23:13:13.181902+00:00', false, false, true) ON CONFLICT (scenario_id, flags_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7921-87f3-166765531ad9', '019c7307-6fd9-7433-ad75-ac78d08e7ede', '2026-02-18T23:13:13.181902+00:00', false, false, true) ON CONFLICT (scenario_id, flags_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7921-87f3-166765531ad9', '019c7307-6fd9-73ba-ab1f-03fb6719f8dd', '2026-02-18T23:13:13.181902+00:00', false, false, true) ON CONFLICT (scenario_id, flags_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7921-87f3-166765531ad9', '019c7307-6fd8-7fa2-955b-b06b6c5f9896', '2026-02-18T23:13:13.181902+00:00', false, false, true) ON CONFLICT (scenario_id, flags_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7921-87f3-166765531ad9', '019c7307-6fd9-74b2-bc6a-ad91933ee830', '2026-02-18T23:13:13.181902+00:00', false, false, true) ON CONFLICT (scenario_id, flags_id) DO NOTHING;
INSERT INTO public.scenario_flags_junction (scenario_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7921-87f3-166765531ad9', '019c7307-6fd9-7487-aaea-6d896596223b', '2026-02-18T23:13:13.181902+00:00', false, false, true) ON CONFLICT (scenario_id, flags_id) DO NOTHING;
-- scenario_names_junction
INSERT INTO public.scenario_names_junction (scenario_id, names_id, created_at, generated, mcp, active) VALUES ('019b3be4-3c3a-7921-87f3-166765531ad9', '019b995c-8e80-7a56-b755-f6330dbf98a9', '2025-08-12T12:52:09.879666+00:00', false, false, true) ON CONFLICT (scenario_id, names_id) DO NOTHING;
-- scenario_scenarios_junction
INSERT INTO public.scenario_scenarios_junction (scenario_id, scenarios_id, active, created_at, generated, mcp) VALUES ('019b3be4-3c3a-7921-87f3-166765531ad9', '019bb25e-e61d-7efa-8819-7dcb0cf829f8', true, '2025-08-12T12:52:09.879666+00:00', false, false) ON CONFLICT (scenario_id, scenarios_id) DO NOTHING;

-- Simulation artifact
-- simulation_artifact
INSERT INTO public.simulation_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.984906+00:00', '2025-08-12T12:52:09.984906+00:00', '019b3be4-3cb8-7ab9-b0fb-1469d28aaefa', false, false) ON CONFLICT (id) DO NOTHING;

-- Simulation junctions
-- simulation_descriptions_junction
INSERT INTO public.simulation_descriptions_junction (simulation_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-7ab9-b0fb-1469d28aaefa', '019b995c-8e96-7734-bde8-42600e28f00a', '2025-08-12T12:52:09.984906+00:00', false, false, true) ON CONFLICT (simulation_id, descriptions_id) DO NOTHING;
-- simulation_flags_junction
INSERT INTO public.simulation_flags_junction (simulation_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-7ab9-b0fb-1469d28aaefa', '019b995a-86ef-78e3-8811-f5d0cfd31e3c', '2025-08-12T12:52:09.984906+00:00', false, false, true) ON CONFLICT (simulation_id, flags_id) DO NOTHING;
INSERT INTO public.simulation_flags_junction (simulation_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-7ab9-b0fb-1469d28aaefa', '019be334-bfc6-73b3-ac0d-822d6864d660', '2025-08-12T12:52:09.984906+00:00', false, false, true) ON CONFLICT (simulation_id, flags_id) DO NOTHING;
INSERT INTO public.simulation_flags_junction (simulation_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-7ab9-b0fb-1469d28aaefa', '019b995a-86ef-71e9-ad2c-6c2040afdffe', '2026-01-22T01:20:11.353715+00:00', false, false, true) ON CONFLICT (simulation_id, flags_id) DO NOTHING;
-- simulation_names_junction
INSERT INTO public.simulation_names_junction (simulation_id, names_id, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-7ab9-b0fb-1469d28aaefa', '019b995c-8e93-7fe5-bd42-3eb6e1517d0a', '2025-08-12T12:52:09.984906+00:00', false, false, true) ON CONFLICT (simulation_id, names_id) DO NOTHING;
-- simulation_scenario_rubrics_junction
-- simulation_simulations_junction
INSERT INTO public.simulation_simulations_junction (simulation_id, simulations_id, active, created_at, generated, mcp) VALUES ('019b3be4-3cb8-7ab9-b0fb-1469d28aaefa', '019bb25e-e62c-78a4-a556-64cb01be3d92', true, '2025-08-12T12:52:09.984906+00:00', false, false) ON CONFLICT (simulation_id, simulations_id) DO NOTHING;
