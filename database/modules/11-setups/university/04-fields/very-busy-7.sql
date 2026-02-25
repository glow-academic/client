-- Module: Very Busy (7)
-- Category: field
-- Description: Very Busy (7) field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7877-84a1-74dbf105b693', 'There is a line of students waiting for help; the room feels crowded.', '2025-08-12T12:52:09.869197+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.869197+00:00', true, false, false, '019bb25e-e5f8-7d74-9400-96485f9608ae', 'Very Busy (7)', 'There is a line of students waiting for help; the room feels crowded.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7aa9-89ba-87e78ab26a48', 'Very Busy (7)', '2025-08-12T12:52:09.869197+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact

-- Junctions
-- field_descriptions_junction
-- field_fields_junction
-- field_flags_junction
-- field_names_junction
