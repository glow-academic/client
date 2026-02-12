-- Module: Student
-- Category: field
-- Description: Student field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-77c4-8695-c65b225ab8fb', 'Represents a typical student perspective', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-12T13:26:55.660542+00:00', true, false, false, '019bb25e-e5f8-7e1f-a573-7804151ff56d', 'Student', 'Represents a typical student perspective', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e99-7840-a4ac-852e6bcecfaf', 'Student', '2025-12-12T13:26:55.656189+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-12T13:26:55.660542+00:00', '2025-12-12T13:26:55.660542+00:00', '019b3be4-3256-7002-8465-fd30eac11b96', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3256-7002-8465-fd30eac11b96', '019b995c-8e9e-77c4-8695-c65b225ab8fb', '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3256-7002-8465-fd30eac11b96', '019bb25e-e5f8-7e1f-a573-7804151ff56d', true, '2025-12-12T13:26:55.660542+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3256-7002-8465-fd30eac11b96', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3256-7002-8465-fd30eac11b96', '019b995c-8e99-7840-a4ac-852e6bcecfaf', '2025-12-12T13:26:55.660542+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
