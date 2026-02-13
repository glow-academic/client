-- Module: Intensity
-- Category: parameter
-- Description: Intensity parameter
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e92-7c91-92ef-bbd71c5640a4', 'How emotionally charged or urgent the situation feels', '2025-08-12T12:52:09.866818+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e91-791d-b05f-a171a0c225d6', 'Intensity', '2025-08-12T12:52:09.866818+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameters_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, persona_parameter, document_parameter, scenario_parameter, video_parameter, field_ids) VALUES ('2025-08-12T12:52:09.866818+00:00', true, false, false, '019bb25e-e621-7037-bc24-32292586d2d2', 'Intensity', 'How emotionally charged or urgent the situation feels', NULL, '{}', false, false, false, false, '{019bb25e-e5f8-7dea-be6e-3ba417f090e5,019bb25e-e5f8-7def-b7a9-f587cd3075d0,019bb25e-e5f8-7df1-9a0e-6a65a69e75d5,019bb25e-e5f8-7df7-886f-39fc7dd8ddeb,019bb25e-e5f8-7df8-9280-e8be30cd3a0e,019bb25e-e5f8-7dfe-80eb-f1a07c2d4f85,019bb25e-e5f8-7e01-90e4-9a8120acb076,019bb25e-e5f8-7e05-8724-d06378756d1d,019bb25e-e5f8-7e09-9ae0-23cdc02687d3,019bb25e-e5f8-7e0f-939f-41d5799c4bb3}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- parameter_artifact
INSERT INTO public.parameter_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.866818+00:00', '2025-12-13T18:43:03.006697+00:00', '019b3be4-36df-7c8a-a963-00f5f6203b40', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- parameter_descriptions_junction
INSERT INTO public.parameter_descriptions_junction (parameter_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-36df-7c8a-a963-00f5f6203b40', '019b995c-8e92-7c91-92ef-bbd71c5640a4', '2025-08-12T12:52:09.866818+00:00', false, false, true) ON CONFLICT (parameter_id, description_id) DO NOTHING;
-- parameter_fields_junction
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, created_at, generated, mcp, active, field_resource_id) VALUES ('019b3be4-36df-7c8a-a963-00f5f6203b40', '019b3be4-3255-7f8b-a79c-ce7fedf50d0e', '2025-08-12T12:52:09.872240+00:00', false, false, true, '019bb25e-e5f8-7e0f-939f-41d5799c4bb3') ON CONFLICT (parameter_id, field_id) DO NOTHING;
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, created_at, generated, mcp, active, field_resource_id) VALUES ('019b3be4-36df-7c8a-a963-00f5f6203b40', '019b3be4-3255-7f90-a069-928b5b6d5cba', '2025-08-12T12:52:09.872240+00:00', false, false, true, '019bb25e-e5f8-7e09-9ae0-23cdc02687d3') ON CONFLICT (parameter_id, field_id) DO NOTHING;
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, created_at, generated, mcp, active, field_resource_id) VALUES ('019b3be4-36df-7c8a-a963-00f5f6203b40', '019b3be4-3255-7f9b-9557-8f5520e3978f', '2025-08-12T12:52:09.872240+00:00', false, false, true, '019bb25e-e5f8-7e05-8724-d06378756d1d') ON CONFLICT (parameter_id, field_id) DO NOTHING;
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, created_at, generated, mcp, active, field_resource_id) VALUES ('019b3be4-36df-7c8a-a963-00f5f6203b40', '019b3be4-3255-7f9c-875c-b4b0ad69bda3', '2025-08-12T12:52:09.872240+00:00', false, false, true, '019bb25e-e5f8-7e01-90e4-9a8120acb076') ON CONFLICT (parameter_id, field_id) DO NOTHING;
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, created_at, generated, mcp, active, field_resource_id) VALUES ('019b3be4-36df-7c8a-a963-00f5f6203b40', '019b3be4-3255-7fa7-b257-52e79bf08459', '2025-08-12T12:52:09.872240+00:00', false, false, true, '019bb25e-e5f8-7dfe-80eb-f1a07c2d4f85') ON CONFLICT (parameter_id, field_id) DO NOTHING;
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, created_at, generated, mcp, active, field_resource_id) VALUES ('019b3be4-36df-7c8a-a963-00f5f6203b40', '019b3be4-3255-7fac-86b9-909c3a6281ee', '2025-08-12T12:52:09.872240+00:00', false, false, true, '019bb25e-e5f8-7df8-9280-e8be30cd3a0e') ON CONFLICT (parameter_id, field_id) DO NOTHING;
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, created_at, generated, mcp, active, field_resource_id) VALUES ('019b3be4-36df-7c8a-a963-00f5f6203b40', '019b3be4-3255-7fb6-963f-3581cfe5da84', '2025-08-12T12:52:09.872240+00:00', false, false, true, '019bb25e-e5f8-7df7-886f-39fc7dd8ddeb') ON CONFLICT (parameter_id, field_id) DO NOTHING;
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, created_at, generated, mcp, active, field_resource_id) VALUES ('019b3be4-36df-7c8a-a963-00f5f6203b40', '019b3be4-3255-7fbc-ac49-a405a72c4e7a', '2025-08-12T12:52:09.872240+00:00', false, false, true, '019bb25e-e5f8-7df1-9a0e-6a65a69e75d5') ON CONFLICT (parameter_id, field_id) DO NOTHING;
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, created_at, generated, mcp, active, field_resource_id) VALUES ('019b3be4-36df-7c8a-a963-00f5f6203b40', '019b3be4-3255-7fc3-b56b-ac521ae02aa0', '2025-08-12T12:52:09.872240+00:00', false, false, true, '019bb25e-e5f8-7def-b7a9-f587cd3075d0') ON CONFLICT (parameter_id, field_id) DO NOTHING;
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, created_at, generated, mcp, active, field_resource_id) VALUES ('019b3be4-36df-7c8a-a963-00f5f6203b40', '019b3be4-3255-7fca-9975-2a79d2177b6d', '2025-08-12T12:52:09.872240+00:00', false, false, true, '019bb25e-e5f8-7dea-be6e-3ba417f090e5') ON CONFLICT (parameter_id, field_id) DO NOTHING;
-- parameter_names_junction
INSERT INTO public.parameter_names_junction (parameter_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-36df-7c8a-a963-00f5f6203b40', '019b995c-8e91-791d-b05f-a171a0c225d6', '2025-08-12T12:52:09.866818+00:00', false, false, true) ON CONFLICT (parameter_id, name_id) DO NOTHING;
-- parameter_parameters_junction
INSERT INTO public.parameter_parameters_junction (parameter_id, parameters_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c8a-a963-00f5f6203b40', '019bb25e-e621-7037-bc24-32292586d2d2', true, '2025-08-12T12:52:09.866818+00:00', false, false) ON CONFLICT (parameter_id, parameters_id) DO NOTHING;
