-- Module: quiz
-- Category: field
-- Description: quiz field
-- ============================================================


-- Resource rows
INSERT INTO public.conditional_parameters_resource (id, parameter_id, created_at, updated_at, active, generated, mcp) VALUES ('019c04f5-a15f-7e98-a94e-e505e4e33d48', '019bb25e-e620-7f9a-a3b6-8b7230c1e51c', '2025-12-08T22:19:28.206394+00:00', '2026-01-28T14:15:32.447157+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7871-a4d4-2fe99f06dbb1', 'Short assessments, pop quizzes', '2025-12-03T13:30:24.007753+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-03T13:30:24.007753+00:00', true, false, false, '019bb25e-e5f8-7d13-a0e2-aa266d021fe8', 'quiz', 'Short assessments, pop quizzes', '', '{}', '{019c04f5-a15f-7e98-a94e-e505e4e33d48}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a64-844e-a726af0df5f2', 'quiz', '2025-12-03T13:30:24.007753+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-03 07:30:24.007753-06', '2025-12-03 07:30:24.007753-06', '019b3be4-3255-7f0d-82d4-4784be4819f4', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_conditional_parameters_junction
INSERT INTO public.field_conditional_parameters_junction (field_id, conditional_parameter_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7f0d-82d4-4784be4819f4', '019c04f5-a15f-7e98-a94e-e505e4e33d48', '2025-12-08 16:19:28.206394-06', false, false) ON CONFLICT (field_id, conditional_parameter_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f0d-82d4-4784be4819f4', '019b995c-8e9e-7871-a4d4-2fe99f06dbb1', '2025-12-03 07:30:24.007753-06', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7f0d-82d4-4784be4819f4', '019bb25e-e5f8-7d13-a0e2-aa266d021fe8', '2025-12-03 07:30:24.007753-06', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f0d-82d4-4784be4819f4', '019be334-bfc4-7dd2-bcbd-93f1af18c233', '2025-12-03 07:30:24.007753-06', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f0d-82d4-4784be4819f4', '019b995c-8e9b-7a64-844e-a726af0df5f2', '2025-12-03 07:30:24.007753-06', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- parameter_fields_junction
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, field_resource_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c71-b0e1-5997a42c1977', '019b3be4-3255-7f0d-82d4-4784be4819f4', '019bb25e-e5f8-7d13-a0e2-aa266d021fe8', true, '2025-12-03 07:30:24.007753-06', false, false) ON CONFLICT (parameter_id, field_id) DO NOTHING;
