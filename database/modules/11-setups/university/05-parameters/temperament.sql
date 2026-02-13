-- Module: Temperament
-- Category: parameter
-- Description: Temperament parameter
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e92-7ca0-a8f5-0cdda8d108c9', 'Emotional temperament types for personas (aggressive, passive, confused, happy)', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e91-792c-afd4-89c7a904339c', 'Temperament', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameters_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, persona_parameter, document_parameter, scenario_parameter, video_parameter, field_ids) VALUES ('2025-12-12T13:26:55.660542+00:00', true, false, false, '019bb25e-e621-702e-a7ba-81fd751a9c61', 'Temperament', 'Emotional temperament types for personas (aggressive, passive, confused, happy)', NULL, '{}', false, false, false, false, '{019bb25e-e5f8-7dda-b5c5-45f0ba4336bd,019bb25e-e5f8-7ddd-907f-b62487ee2e2f,019bb25e-e5f8-7de3-be92-08efc9770684,019bb25e-e5f8-7de4-b089-ca19b4ced746}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- parameter_artifact
INSERT INTO public.parameter_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-12T13:26:55.660542+00:00', '2025-12-12T13:26:55.660542+00:00', '019b3be4-36df-7c7c-b05d-a5d004557609', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- parameter_descriptions_junction
INSERT INTO public.parameter_descriptions_junction (parameter_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-36df-7c7c-b05d-a5d004557609', '019b995c-8e92-7ca0-a8f5-0cdda8d108c9', '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (parameter_id, description_id) DO NOTHING;
-- parameter_fields_junction
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, created_at, generated, mcp, active, field_resource_id) VALUES ('019b3be4-36df-7c7c-b05d-a5d004557609', '019b3be4-3255-7fe3-a5a8-ace6b20b6ba7', '2025-12-12T13:26:55.660542+00:00', false, false, true, '019bb25e-e5f8-7de4-b089-ca19b4ced746') ON CONFLICT (parameter_id, field_id) DO NOTHING;
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, created_at, generated, mcp, active, field_resource_id) VALUES ('019b3be4-36df-7c7c-b05d-a5d004557609', '019b3be4-3255-7fe8-a834-22c625c91dd4', '2025-12-12T13:26:55.660542+00:00', false, false, true, '019bb25e-e5f8-7de3-be92-08efc9770684') ON CONFLICT (parameter_id, field_id) DO NOTHING;
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, created_at, generated, mcp, active, field_resource_id) VALUES ('019b3be4-36df-7c7c-b05d-a5d004557609', '019b3be4-3255-7fef-ba99-524dd2c6e9bd', '2025-12-12T13:26:55.660542+00:00', false, false, true, '019bb25e-e5f8-7ddd-907f-b62487ee2e2f') ON CONFLICT (parameter_id, field_id) DO NOTHING;
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, created_at, generated, mcp, active, field_resource_id) VALUES ('019b3be4-36df-7c7c-b05d-a5d004557609', '019b3be4-3255-7ff4-bdda-ee6747f17f98', '2025-12-12T13:26:55.660542+00:00', false, false, true, '019bb25e-e5f8-7dda-b5c5-45f0ba4336bd') ON CONFLICT (parameter_id, field_id) DO NOTHING;
-- parameter_names_junction
INSERT INTO public.parameter_names_junction (parameter_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-36df-7c7c-b05d-a5d004557609', '019b995c-8e91-792c-afd4-89c7a904339c', '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (parameter_id, name_id) DO NOTHING;
-- parameter_parameters_junction
INSERT INTO public.parameter_parameters_junction (parameter_id, parameters_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c7c-b05d-a5d004557609', '019bb25e-e621-702e-a7ba-81fd751a9c61', true, '2025-12-12T13:26:55.660542+00:00', false, false) ON CONFLICT (parameter_id, parameters_id) DO NOTHING;
