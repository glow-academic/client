-- Module: create_attempt_insights
-- Category: tool
-- Description: create_attempt_insights tool (attempt insight generation)
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (created_at, active, generated, mcp, id, name, description, field_type, required, default_value) VALUES ('2026-02-23T17:36:15.969225+00:00', true, false, false, '018f0001-0001-7000-8000-000000000001', 'insight_content', 'The analytical insight text', 'string', true, '') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (created_at, active, generated, mcp, id, name, description, field_type, required, default_value) VALUES ('2026-02-23T17:36:15.969225+00:00', true, false, false, '018f0001-0001-7000-8000-000000000002', 'insight_group_id', 'The group ID to attach the insight to', 'string', true, '') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (created_at, active, generated, mcp, id, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('2026-02-23T17:36:15.969225+00:00', true, false, false, '018f0002-0001-7000-8000-000000000002', 'create_attempt_insights', 'Create an attempt insight entry', '{}', 'create', '{018f0001-0001-7000-8000-000000000001,018f0001-0001-7000-8000-000000000002}', '{}', '{}'::text[], '{attempt_insights}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;
