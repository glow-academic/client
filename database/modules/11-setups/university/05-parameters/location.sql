-- Module: Location
-- Category: parameter
-- Description: Location parameter
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e92-7cad-8fa7-30580c9ec244', 'Where the interaction is taking place', '2025-08-12T12:52:10.013081+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e91-791a-a45b-c5c780d41db0', 'Location', '2025-08-12T12:52:10.013081+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameters_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, persona_parameter, document_parameter, scenario_parameter, video_parameter, field_ids) VALUES ('2025-08-12T12:52:10.013081+00:00', true, false, false, '019bb25e-e621-701f-86f5-ee5cdc68a584', 'Location', 'Where the interaction is taking place', NULL, '{}', false, false, true, true, '{019bb25e-e5f8-7d2f-b8bb-b6f7a0c2a1c4,019bb25e-e5f8-7d30-bcb8-46fcc520225a,019bb25e-e5f8-7d37-be12-589f245af871,019bb25e-e5f8-7d3a-9658-532b7ac976cd,019bb25e-e5f8-7d3d-8eee-efd2c83da86f,019bb25e-e5f8-7d43-8b29-c328f173b660,019bb25e-e5f8-7d45-9159-e9c511591ad8,019bb25e-e5f8-7d4a-8c27-a3231f31d512,019bb25e-e5f8-7d4d-a2be-5640bc74f115,019bb25e-e5f8-7d52-82ca-9a97f81a8690,019bb25e-e5f8-7d56-b92a-5223bc06fd2c,019bb25e-e5f8-7d5b-954d-ff8fb5fc297c,019bb25e-e5f8-7d5f-8670-f85c1a4ebf93,019bb25e-e5f8-7d61-878f-223e4ac96b88,019bb25e-e5f8-7d66-9e5a-6094e4b77a60,019bb25e-e5f8-7d6a-b8a9-4b3d2d56e8ed,019bb25e-e5f8-7dcd-8f4e-a986b0a7ebba,019bb25e-e5f8-7e13-968e-8aad75ea70de}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- parameter_artifact
INSERT INTO public.parameter_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:10.013081+00:00', '2025-12-08T22:19:28.202560+00:00', '019b3be4-36df-7c64-a57f-0e212bfec083', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- parameter_descriptions_junction
INSERT INTO public.parameter_descriptions_junction (parameter_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-36df-7c64-a57f-0e212bfec083', '019b995c-8e92-7cad-8fa7-30580c9ec244', '2025-08-12T12:52:10.013081+00:00', false, false, true) ON CONFLICT (parameter_id, description_id) DO NOTHING;
-- parameter_fields_junction
-- parameter_names_junction
INSERT INTO public.parameter_names_junction (parameter_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-36df-7c64-a57f-0e212bfec083', '019b995c-8e91-791a-a45b-c5c780d41db0', '2025-08-12T12:52:10.013081+00:00', false, false, true) ON CONFLICT (parameter_id, name_id) DO NOTHING;
-- parameter_parameters_junction
INSERT INTO public.parameter_parameters_junction (parameter_id, parameters_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c64-a57f-0e212bfec083', '019bb25e-e621-701f-86f5-ee5cdc68a584', true, '2025-08-12T12:52:10.013081+00:00', false, false) ON CONFLICT (parameter_id, parameters_id) DO NOTHING;
