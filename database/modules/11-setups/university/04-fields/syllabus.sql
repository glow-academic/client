-- Module: syllabus
-- Category: field
-- Description: syllabus field
-- ============================================================


-- Resource rows
INSERT INTO public.conditional_parameters_resource (id, parameter_id, created_at, updated_at, active, generated, mcp) VALUES ('019c04f5-a15f-7e98-a94e-e505e4e33d48', '019bb25e-e620-7f9a-a3b6-8b7230c1e51c', '2025-12-08T22:19:28.206394+00:00', '2026-01-28T14:15:32.447157+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7720-9ce6-38f7a5bb2081', 'Course syllabus, course outline', '2025-12-03T13:30:24.007753+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-03T13:30:24.007753+00:00', true, false, false, '019bb25e-e5f8-7d00-a623-09370b0a5ba8', 'syllabus', 'Course syllabus, course outline', '', '{}', '{019c04f5-a15f-7e98-a94e-e505e4e33d48}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79e7-8c99-ce85b1a8882b', 'syllabus', '2025-12-03T13:30:24.007753+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-03 07:30:24.007753-06', '2025-12-03 07:30:24.007753-06', '019b3be4-3255-7f2e-869a-dfbd35f14e3a', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_conditional_parameters_junction
INSERT INTO public.field_conditional_parameters_junction (field_id, conditional_parameters_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7f2e-869a-dfbd35f14e3a', '019c04f5-a15f-7e98-a94e-e505e4e33d48', true, '2025-12-08 16:19:28.206394-06', false, false) ON CONFLICT (field_id, conditional_parameters_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f2e-869a-dfbd35f14e3a', '019b995c-8e9e-7720-9ce6-38f7a5bb2081', '2025-12-03 07:30:24.007753-06', false, false, true) ON CONFLICT (field_id, descriptions_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7f2e-869a-dfbd35f14e3a', '019bb25e-e5f8-7d00-a623-09370b0a5ba8', true, '2025-12-03 07:30:24.007753-06', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f2e-869a-dfbd35f14e3a', '019be334-bfc4-7dd2-bcbd-93f1af18c233', '2025-12-03 07:30:24.007753-06', false, false, true) ON CONFLICT (field_id, flags_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, names_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f2e-869a-dfbd35f14e3a', '019b995c-8e9b-79e7-8c99-ce85b1a8882b', '2025-12-03 07:30:24.007753-06', false, false, true) ON CONFLICT (field_id, names_id) DO NOTHING;
-- parameter_fields_junction
INSERT INTO public.parameter_fields_junction (parameter_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c71-b0e1-5997a42c1977', '019bb25e-e5f8-7d00-a623-09370b0a5ba8', true, '2025-12-03 07:30:24.007753-06', false, false) ON CONFLICT (parameter_id, fields_id) DO NOTHING;
