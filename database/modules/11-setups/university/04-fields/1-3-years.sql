-- Module: 1-3 years
-- Category: field
-- Description: 1-3 years field
-- ============================================================


-- Resource rows
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2026-02-19T09:59:35.509148+00:00', true, false, false, 'dd000020-0002-0000-0000-000000000002', '1-3 years', 'Established but still relatively new.', NULL, '{019c3f8c-b97f-70eb-86fb-4f3fae4902f8}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('dd000022-0002-0000-0000-000000000002', '1-3 years', '2026-02-19T09:59:35.509148+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-19T09:59:35.509148+00:00', '2026-02-19T09:59:35.509148+00:00', 'dd000021-0002-0000-0000-000000000002', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('dd000021-0002-0000-0000-000000000002', 'dd000020-0002-0000-0000-000000000002', true, '2026-02-19T09:59:35.509148+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('dd000021-0002-0000-0000-000000000002', 'dd000022-0002-0000-0000-000000000002', '2026-02-19T09:59:35.509148+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
