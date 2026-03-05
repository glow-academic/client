-- Module: Busy (6)
-- Category: field
-- Description: Busy (6) field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-780c-89d2-52965872892b', 'The room is active with many students; expect a noticeable wait.', '2025-08-12T12:52:09.869197+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:09.869197+00:00', true, false, false, '019bb25e-e5f8-7d78-a23f-f4249502a96f', 'Busy (6)', 'The room is active with many students; expect a noticeable wait.', '', '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a1f-a909-bffe91e9ee0e', 'Busy (6)', '2025-08-12T12:52:09.869197+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12 07:52:09.869197-05', '2025-08-12 07:52:09.869197-05', '019b3be4-3255-7f6d-8702-a849bcc6241a', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f6d-8702-a849bcc6241a', '019b995c-8e9e-780c-89d2-52965872892b', '2025-08-12 07:52:09.869197-05', false, false, true) ON CONFLICT (field_id, descriptions_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7f6d-8702-a849bcc6241a', '019bb25e-e5f8-7d78-a23f-f4249502a96f', true, '2025-08-12 07:52:09.869197-05', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f6d-8702-a849bcc6241a', '019be334-bfc4-7dd2-bcbd-93f1af18c233', '2025-08-12 07:52:09.869197-05', false, false, true) ON CONFLICT (field_id, flags_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, names_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7f6d-8702-a849bcc6241a', '019b995c-8e9b-7a1f-a909-bffe91e9ee0e', '2025-08-12 07:52:09.869197-05', false, false, true) ON CONFLICT (field_id, names_id) DO NOTHING;
-- parameter_fields_junction
INSERT INTO public.parameter_fields_junction (parameter_id, field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-36df-7c4b-93fa-5876061f1e89', '019b3be4-3255-7f6d-8702-a849bcc6241a', '019bb25e-e5f8-7d78-a23f-f4249502a96f', true, '2025-08-12 07:52:09.869197-05', false, false) ON CONFLICT (parameter_id, field_id) DO NOTHING;
