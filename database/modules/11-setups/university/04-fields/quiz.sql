-- Module: quiz
-- Category: field
-- Description: quiz field
-- ============================================================


-- Resource rows
INSERT INTO public.conditional_parameters_resource (id, parameter_id, created_at, updated_at, active, generated, mcp) VALUES ('019c04f5-a15f-7e98-a94e-e505e4e33d48', '019bb25e-e620-7f9a-a3b6-8b7230c1e51c', '2025-12-08T22:19:28.206394+00:00', '2026-01-28T14:15:32.447157+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7871-a4d4-2fe99f06dbb1', 'Short assessments, pop quizzes', '2025-12-03T13:30:24.007753+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-03T13:30:24.007753+00:00', true, false, false, '019bb25e-e5f8-7d13-a0e2-aa266d021fe8', 'quiz', 'Short assessments, pop quizzes', NULL, '{}', '{019c04f5-a15f-7e98-a94e-e505e4e33d48}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a64-844e-a726af0df5f2', 'quiz', '2025-12-03T13:30:24.007753+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact

-- Junctions
-- field_conditional_parameters_junction
-- field_descriptions_junction
-- field_fields_junction
-- field_flags_junction
-- field_names_junction
