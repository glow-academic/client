-- Module: midterm
-- Category: field
-- Description: midterm field
-- ============================================================


-- Resource rows
INSERT INTO public.conditional_parameters_resource (id, parameter_id, created_at, updated_at, active, generated, mcp) VALUES ('019c04f5-a15f-7e98-a94e-e505e4e33d48', '019bb25e-e620-7f9a-a3b6-8b7230c1e51c', '2025-12-08T22:19:28.206394+00:00', '2026-01-28T14:15:32.447157+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-77ee-9e5c-ac7ca864887f', 'Midterm exams, major tests', '2025-12-03T13:30:24.007753+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-03T13:30:24.007753+00:00', true, false, false, '019bb25e-e5f8-7d0d-9207-6520a302d236', 'midterm', 'Midterm exams, major tests', NULL, '{}', '{019c04f5-a15f-7e98-a94e-e505e4e33d48}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a63-ad61-acc2b699ef97', 'midterm', '2025-12-03T13:30:24.007753+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact

-- Junctions
-- field_conditional_parameters_junction
-- field_descriptions_junction
-- field_fields_junction
-- field_flags_junction
-- field_names_junction
