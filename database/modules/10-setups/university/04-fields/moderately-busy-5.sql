-- Module: Moderately Busy (5)
-- Category: field
-- Description: Moderately Busy (5) field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7855-ae28-f440d1562d90', 'A moderate number of students; you may have to wait a bit for help.', '2025-08-12T12:52:09.869197+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.869197+00:00', true, false, false, '019bb25e-e5f8-7d7c-b9e1-01ded9af627f', 'Moderately Busy (5)', 'A moderate number of students; you may have to wait a bit for help.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7abc-9401-b7c4f982b20d', 'Moderately Busy (5)', '2025-08-12T12:52:09.869197+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.869197+00:00', '2025-08-12T12:52:09.869197+00:00', '019b3be4-3255-7f67-a232-c5bebdfe5d83', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f67-a232-c5bebdfe5d83', '019b995c-8e9e-7855-ae28-f440d1562d90', '2025-08-12T12:52:09.869197+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7f67-a232-c5bebdfe5d83', '019bb25e-e5f8-7d7c-b9e1-01ded9af627f', true, '2025-08-12T12:52:09.869197+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f67-a232-c5bebdfe5d83', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:09.869197+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f67-a232-c5bebdfe5d83', '019b995c-8e9b-7abc-9401-b7c4f982b20d', '2025-08-12T12:52:09.869197+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
