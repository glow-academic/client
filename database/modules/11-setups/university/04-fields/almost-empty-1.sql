-- Module: Almost Empty (1)
-- Category: field
-- Description: Almost Empty (1) field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-785e-b347-eac70c95272f', 'There are almost no students present; the room is quiet and you can get help immediately.', '2025-08-12T12:52:09.869197+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.869197+00:00', true, false, false, '019bb25e-e5f8-7d8b-9d8a-f467c26a681d', 'Almost Empty (1)', 'There are almost no students present; the room is quiet and you can get help immediately.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-799e-a15e-2e42d1fc4f37', 'Almost Empty (1)', '2025-08-12T12:52:09.869197+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact

-- Junctions
-- field_descriptions_junction
-- field_fields_junction
-- field_flags_junction
-- field_names_junction
