-- Module: Time
-- Category: parameter
-- Description: Time parameter
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e92-7cb5-8a0c-08c6b38afc0d', 'When the scenario occurs', '2025-08-12T12:52:09.866818+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e91-7911-a568-4eb359b14b14', 'Time', '2025-08-12T12:52:09.866818+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameters_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, persona_parameter, document_parameter, scenario_parameter, video_parameter, field_ids) VALUES ('2025-08-12T12:52:09.866818+00:00', true, false, false, '019bb25e-e621-7023-a8a1-e0f52a01224d', 'Time', 'When the scenario occurs', '', '{}', false, false, true, true, '{019bb25e-e5f8-7da8-b4cb-70247c1822cd,019bb25e-e5f8-7dad-ad24-8aef6b327a68,019bb25e-e5f8-7db1-9803-293380427820,019bb25e-e5f8-7db6-846c-6ae8e0b2fd91,019bb25e-e5f8-7db9-8a23-d98360e7fca0,019bb25e-e5f8-7dbe-843e-5cc6e2bb7241,019bb25e-e5f8-7dc3-a9bb-2de7e73428a2,019bb25e-e5f8-7dc6-aac8-1aec8f456e02,019bb25e-e5f8-7dc8-9778-53b360889fc4}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- parameter_artifact
INSERT INTO public.parameter_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.866818+00:00', '2025-12-08T22:19:28.202560+00:00', '019b3be4-36df-7c6b-bf97-4e28b5fd13bb', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- parameter_descriptions_junction
INSERT INTO public.parameter_descriptions_junction (parameter_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019b3be4-36df-7c6b-bf97-4e28b5fd13bb', '019b995c-8e92-7cb5-8a0c-08c6b38afc0d', '2025-08-12T12:52:09.866818+00:00', false, false, true) ON CONFLICT (parameter_id, descriptions_id) DO NOTHING;
-- parameter_fields_junction
-- parameter_names_junction
INSERT INTO public.parameter_names_junction (parameter_id, names_id, created_at, generated, mcp, active) VALUES ('019b3be4-36df-7c6b-bf97-4e28b5fd13bb', '019b995c-8e91-7911-a568-4eb359b14b14', '2025-08-12T12:52:09.866818+00:00', false, false, true) ON CONFLICT (parameter_id, names_id) DO NOTHING;
-- parameter_parameters_junction
INSERT INTO public.parameter_parameters_junction (parameter_id, parameters_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c6b-bf97-4e28b5fd13bb', '019bb25e-e621-7023-a8a1-e0f52a01224d', true, '2025-08-12T12:52:09.866818+00:00', false, false) ON CONFLICT (parameter_id, parameters_id) DO NOTHING;
