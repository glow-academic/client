-- Module: CS 381
-- Category: field
-- Description: CS 381 field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7897-b32c-6ed9a7e67cbf', 'Techniques for analyzing the time and space requirements of algorithms. Application of these techniques to sorting, searching, pattern-matching, graph problems, and other selected problems. Brief introduction to the intractable (NP-hard) problems.', '2025-08-12T12:52:10.017187+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:10.017187+00:00', true, false, false, '019bb25e-e5f8-7d22-9d6f-d0976eea78ec', 'CS 381', 'Techniques for analyzing the time and space requirements of algorithms. Application of these techniques to sorting, searching, pattern-matching, graph problems, and other selected problems. Brief introduction to the intractable (NP-hard) problems.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-79ab-85b6-45f1a64011ac', 'CS 381', '2025-08-12T12:52:10.017187+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12 07:52:10.017187-05', '2025-08-12 07:52:10.017187-05', '019b3be4-3255-7da8-8b3a-21da5b688b2f', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_departments_junction
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7da8-8b3a-21da5b688b2f', '019b995c-8e9e-7897-b32c-6ed9a7e67cbf', '2025-08-12 07:52:10.017187-05', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7da8-8b3a-21da5b688b2f', '019bb25e-e5f8-7d22-9d6f-d0976eea78ec', true, '2025-08-12 07:52:10.017187-05', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7da8-8b3a-21da5b688b2f', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12 07:52:10.017187-05', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7da8-8b3a-21da5b688b2f', '019b995c-8e9b-79ab-85b6-45f1a64011ac', '2025-08-12 07:52:10.017187-05', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
-- parameter_fields_junction
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, field_resource_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c04-8324-b7909cc1366e', '019b3be4-3255-7da8-8b3a-21da5b688b2f', '019bb25e-e5f8-7d22-9d6f-d0976eea78ec', true, '2025-08-12 07:52:10.017187-05', false, false) ON CONFLICT (parameter_id, field_id) DO NOTHING;
