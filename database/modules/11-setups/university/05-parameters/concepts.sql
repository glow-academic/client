-- Module: Concepts
-- Category: parameter
-- Description: Concepts parameter
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e92-7ca4-8f69-ab6610020016', 'FERPA-related concepts for policy selection', '2025-12-02T23:06:38.169734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e91-790e-b970-3d8bab00ace2', 'Concepts', '2025-12-02T23:06:38.169734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameters_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, persona_parameter, document_parameter, scenario_parameter, video_parameter, field_ids) VALUES ('2025-12-02T23:06:38.169734+00:00', true, false, false, '019bb25e-e621-7018-96b0-6fa0d0ec3d1d', 'Concepts', 'FERPA-related concepts for policy selection', NULL, '{}', false, false, false, true, '{019bb25e-e5f8-7ce8-825f-6d1d8ddcc6b9,019bb25e-e5f8-7cee-88ca-ae96d7297994,019bb25e-e5f8-7cf0-8ebd-24767ba27236,019bb25e-e5f8-7cf7-9bf8-831afbf7b736,019bb25e-e5f8-7cfa-ab87-8b2a98bf6d9f}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- parameter_artifact
INSERT INTO public.parameter_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-02T23:06:38.169734+00:00', '2025-12-08T22:19:28.202560+00:00', '019b3be4-36df-7c5d-9629-7aedbc8f5928', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- parameter_descriptions_junction
INSERT INTO public.parameter_descriptions_junction (parameter_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-36df-7c5d-9629-7aedbc8f5928', '019b995c-8e92-7ca4-8f69-ab6610020016', '2025-12-02T23:06:38.169734+00:00', false, false, true) ON CONFLICT (parameter_id, description_id) DO NOTHING;
-- parameter_fields_junction
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, created_at, generated, mcp, active, field_resource_id) VALUES ('019b3be4-36df-7c5d-9629-7aedbc8f5928', '019b3be4-3255-7eb8-aa10-9d53e18ba183', '2025-12-02T23:06:38.169734+00:00', false, false, true, '019bb25e-e5f8-7cfa-ab87-8b2a98bf6d9f') ON CONFLICT (parameter_id, field_id) DO NOTHING;
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, created_at, generated, mcp, active, field_resource_id) VALUES ('019b3be4-36df-7c5d-9629-7aedbc8f5928', '019b3be4-3255-7ec1-9d9b-654ea70cca34', '2025-12-02T23:06:38.169734+00:00', false, false, true, '019bb25e-e5f8-7cf7-9bf8-831afbf7b736') ON CONFLICT (parameter_id, field_id) DO NOTHING;
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, created_at, generated, mcp, active, field_resource_id) VALUES ('019b3be4-36df-7c5d-9629-7aedbc8f5928', '019b3be4-3255-7ec8-a739-8edccd5a6915', '2025-12-02T23:06:38.169734+00:00', false, false, true, '019bb25e-e5f8-7cf0-8ebd-24767ba27236') ON CONFLICT (parameter_id, field_id) DO NOTHING;
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, created_at, generated, mcp, active, field_resource_id) VALUES ('019b3be4-36df-7c5d-9629-7aedbc8f5928', '019b3be4-3255-7ed3-91d9-f6b1e35cf709', '2025-12-02T23:06:38.169734+00:00', false, false, true, '019bb25e-e5f8-7cee-88ca-ae96d7297994') ON CONFLICT (parameter_id, field_id) DO NOTHING;
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, created_at, generated, mcp, active, field_resource_id) VALUES ('019b3be4-36df-7c5d-9629-7aedbc8f5928', '019b3be4-3255-7ed6-b953-cc0f5a8973d6', '2025-12-02T23:06:38.169734+00:00', false, false, true, '019bb25e-e5f8-7ce8-825f-6d1d8ddcc6b9') ON CONFLICT (parameter_id, field_id) DO NOTHING;
-- parameter_names_junction
INSERT INTO public.parameter_names_junction (parameter_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-36df-7c5d-9629-7aedbc8f5928', '019b995c-8e91-790e-b970-3d8bab00ace2', '2025-12-02T23:06:38.169734+00:00', false, false, true) ON CONFLICT (parameter_id, name_id) DO NOTHING;
-- parameter_parameters_junction
INSERT INTO public.parameter_parameters_junction (parameter_id, parameters_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c5d-9629-7aedbc8f5928', '019bb25e-e621-7018-96b0-6fa0d0ec3d1d', true, '2025-12-02T23:06:38.169734+00:00', false, false) ON CONFLICT (parameter_id, parameters_id) DO NOTHING;
