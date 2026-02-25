-- Module: Persona Type
-- Category: parameter
-- Description: Persona Type parameter
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e92-7c98-9f52-6ef957bc0045', 'Categorizes personas by their type (Emotion or Neutral)', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e91-7901-88b5-bfdec95b2a4d', 'Persona Type', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameters_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, persona_parameter, document_parameter, scenario_parameter, video_parameter, field_ids) VALUES ('2025-12-12T13:26:55.660542+00:00', true, false, false, '019bb25e-e621-702b-8d5d-5bfb7ed4af04', 'Persona Type', 'Categorizes personas by their type (Emotion or Neutral)', NULL, '{}', true, false, false, false, '{019bb25e-e5f8-7dd0-b701-64d18af393d9,019bb25e-e5f8-7dd6-b648-490037cad081}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- parameter_artifact
INSERT INTO public.parameter_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-12T13:26:55.660542+00:00', '2025-12-12T13:26:55.660542+00:00', '019b3be4-36df-7c79-80fa-7ab7ea171647', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- parameter_descriptions_junction
INSERT INTO public.parameter_descriptions_junction (parameter_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-36df-7c79-80fa-7ab7ea171647', '019b995c-8e92-7c98-9f52-6ef957bc0045', '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (parameter_id, description_id) DO NOTHING;
-- parameter_fields_junction
-- parameter_names_junction
INSERT INTO public.parameter_names_junction (parameter_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-36df-7c79-80fa-7ab7ea171647', '019b995c-8e91-7901-88b5-bfdec95b2a4d', '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (parameter_id, name_id) DO NOTHING;
-- parameter_parameters_junction
INSERT INTO public.parameter_parameters_junction (parameter_id, parameters_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c79-80fa-7ab7ea171647', '019bb25e-e621-702b-8d5d-5bfb7ed4af04', true, '2025-12-12T13:26:55.660542+00:00', false, false) ON CONFLICT (parameter_id, parameters_id) DO NOTHING;
