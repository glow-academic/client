-- Module: Crowdedness
-- Category: parameter
-- Description: Crowdedness parameter
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e92-7cba-84ab-302164ccbe9e', 'How many students are present in the room', '2025-08-12T12:52:09.866818+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e91-792a-a0b5-47ba8a80164d', 'Crowdedness', '2025-08-12T12:52:09.866818+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameters_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, persona_parameter, document_parameter, scenario_parameter, video_parameter, field_ids) VALUES ('2025-08-12T12:52:09.866818+00:00', true, false, false, '019bb25e-e621-700f-b494-72649843abfc', 'Crowdedness', 'How many students are present in the room', '', '{}', false, false, true, false, '{019bb25e-e5f8-7d6d-8546-2d286f9becbe,019bb25e-e5f8-7d72-9424-f3298926911a,019bb25e-e5f8-7d74-9400-96485f9608ae,019bb25e-e5f8-7d78-a23f-f4249502a96f,019bb25e-e5f8-7d7c-b9e1-01ded9af627f,019bb25e-e5f8-7d82-98f3-a088341077c2,019bb25e-e5f8-7d87-a4b1-bcd3fc820916,019bb25e-e5f8-7d8b-9d8a-f467c26a681d,019bb25e-e5f8-7d8e-98e2-39c536d21210,019bb25e-e5f8-7d92-a3bf-60eae43b4e2f}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- parameter_artifact
INSERT INTO public.parameter_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.866818+00:00', '2025-12-08T22:19:28.202560+00:00', '019b3be4-36df-7c4b-93fa-5876061f1e89', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- parameter_descriptions_junction
INSERT INTO public.parameter_descriptions_junction (parameter_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-36df-7c4b-93fa-5876061f1e89', '019b995c-8e92-7cba-84ab-302164ccbe9e', '2025-08-12T12:52:09.866818+00:00', false, false, true) ON CONFLICT (parameter_id, description_id) DO NOTHING;
-- parameter_fields_junction
-- parameter_names_junction
INSERT INTO public.parameter_names_junction (parameter_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-36df-7c4b-93fa-5876061f1e89', '019b995c-8e91-792a-a0b5-47ba8a80164d', '2025-08-12T12:52:09.866818+00:00', false, false, true) ON CONFLICT (parameter_id, name_id) DO NOTHING;
-- parameter_parameters_junction
INSERT INTO public.parameter_parameters_junction (parameter_id, parameters_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c4b-93fa-5876061f1e89', '019bb25e-e621-700f-b494-72649843abfc', true, '2025-08-12T12:52:09.866818+00:00', false, false) ON CONFLICT (parameter_id, parameters_id) DO NOTHING;
