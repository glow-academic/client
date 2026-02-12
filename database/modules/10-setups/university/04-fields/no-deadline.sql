-- Module: No deadline
-- Category: field
-- Description: No deadline field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-777a-9ae6-376d10385faf', 'There is no specific deadline. The situation is relaxed and stress-free.', '2025-08-12T12:52:09.877101+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.877101+00:00', true, false, false, '019bb25e-e5f8-7d96-a1d3-fd6bd8c776ba', 'No deadline', 'There is no specific deadline. The situation is relaxed and stress-free.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7aeb-af19-0a5c60fae873', 'No deadline', '2025-08-12T12:52:09.877101+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.877101+00:00', '2025-08-12T12:52:09.877101+00:00', '019b3be4-3255-7b1c-bbf5-d279d27d6e51', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7b1c-bbf5-d279d27d6e51', '019b995c-8e9e-777a-9ae6-376d10385faf', '2025-08-12T12:52:09.877101+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7b1c-bbf5-d279d27d6e51', '019bb25e-e5f8-7d96-a1d3-fd6bd8c776ba', true, '2025-08-12T12:52:09.877101+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7b1c-bbf5-d279d27d6e51', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.877101+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7b1c-bbf5-d279d27d6e51', '019b995c-8e9b-7aeb-af19-0a5c60fae873', '2025-08-12T12:52:09.877101+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
