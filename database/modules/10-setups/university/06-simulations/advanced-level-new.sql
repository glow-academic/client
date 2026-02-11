-- Module: Advanced Level (New)
-- Category: simulation
-- Description: Advanced Level (New) simulation with inline scenarios
-- ============================================================

-- Simulation resource rows
INSERT INTO public.departments_resource (created_at, active, generated, mcp, id, group_id, name, description, department_ids, setting_ids) VALUES ('2025-10-08T14:16:28.317660+00:00', true, false, false, '019bb25e-e624-73da-8cef-166028a1065a', '019ba0cd-761e-7fa9-a598-42ff212aa69a', 'Purdue CS', 'Innovative base of knowledge in the emerging field of computing', '{}', '{019b3be4-3c61-76ff-befb-69b082df2acd}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e96-772d-a275-211f1ba37a98', 'New to Purdue', '2025-08-12T16:33:53.782000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e93-7fbf-a9f3-fec4c508f4aa', 'Advanced Level (New)', '2025-08-12T16:35:30.399000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.simulations_resource (created_at, active, generated, mcp, id, name, description, department_ids, scenario_ids) VALUES ('2025-08-12T16:35:30.399000+00:00', true, false, false, '019bb25e-e62c-788f-a2eb-4dacd499474a', 'Advanced Level (New)', 'New to Purdue', '{}', '{}') ON CONFLICT (id) DO NOTHING;

-- Simulation artifact
-- simulation_artifact
INSERT INTO public.simulation_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T16:35:30.399000+00:00', '2025-08-12T16:36:31.266000+00:00', '019b3be4-3cb8-77d0-aadb-dd1bfb1036e5', false, false) ON CONFLICT (id) DO NOTHING;

-- Simulation junctions
-- simulation_departments_junction
INSERT INTO public.simulation_departments_junction (active, created_at, department_id, simulation_id, generated, mcp) VALUES (true, '2025-10-29T13:52:10.776500+00:00', '019bb25e-e624-73da-8cef-166028a1065a', '019b3be4-3cb8-77d0-aadb-dd1bfb1036e5', false, false) ON CONFLICT (simulation_id, department_id) DO NOTHING;
-- simulation_descriptions_junction
INSERT INTO public.simulation_descriptions_junction (simulation_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-77d0-aadb-dd1bfb1036e5', '019b995c-8e96-772d-a275-211f1ba37a98', '2025-08-12T16:35:30.399000+00:00', false, false, true) ON CONFLICT (simulation_id, description_id) DO NOTHING;
-- simulation_flags_junction
INSERT INTO public.simulation_flags_junction (simulation_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-77d0-aadb-dd1bfb1036e5', '019b995a-86ef-78e3-8811-f5d0cfd31e3c', false, '2025-08-12T16:35:30.399000+00:00', false, false, true) ON CONFLICT (simulation_id, flag_id) DO NOTHING;
INSERT INTO public.simulation_flags_junction (simulation_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-77d0-aadb-dd1bfb1036e5', '019be334-bfc6-73b3-ac0d-822d6864d660', true, '2025-08-12T16:35:30.399000+00:00', false, false, true) ON CONFLICT (simulation_id, flag_id) DO NOTHING;
INSERT INTO public.simulation_flags_junction (simulation_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-77d0-aadb-dd1bfb1036e5', '019b995a-86ef-71e9-ad2c-6c2040afdffe', true, '2026-01-22T01:20:11.353715+00:00', false, false, true) ON CONFLICT (simulation_id, flag_id) DO NOTHING;
-- simulation_names_junction
INSERT INTO public.simulation_names_junction (simulation_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3cb8-77d0-aadb-dd1bfb1036e5', '019b995c-8e93-7fbf-a9f3-fec4c508f4aa', '2025-08-12T16:35:30.399000+00:00', false, false, true) ON CONFLICT (simulation_id, name_id) DO NOTHING;
-- simulation_simulations_junction
INSERT INTO public.simulation_simulations_junction (simulation_id, simulations_id, active, created_at, generated, mcp) VALUES ('019b3be4-3cb8-77d0-aadb-dd1bfb1036e5', '019bb25e-e62c-788f-a2eb-4dacd499474a', true, '2025-08-12T16:35:30.399000+00:00', false, false) ON CONFLICT (simulation_id, simulations_id) DO NOTHING;
