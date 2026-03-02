-- Module: create_test_insights
-- Category: tool
-- Description: create_test_insights tool (test insight generation)
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (created_at, active, generated, mcp, id, name, description, field_type, required, default_value) VALUES ('2026-02-26T00:00:00.000000+00:00', true, false, false, '018f0001-0001-7000-8000-000000000003', 'test_insight_content', 'The analytical insight text about test results', 'string', true, '') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (created_at, active, generated, mcp, id, name, description, field_type, required, default_value) VALUES ('2026-02-26T00:00:00.000000+00:00', true, false, false, '018f0001-0001-7000-8000-000000000004', 'test_insight_group_id', 'The group ID to attach the insight to', 'string', true, '') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (created_at, active, generated, mcp, id, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('2026-02-26T00:00:00.000000+00:00', true, false, false, '018f0002-0001-7000-8000-000000000003', 'create_test_insights', 'Create a test insight entry', '{}', 'create', '{018f0001-0001-7000-8000-000000000003,018f0001-0001-7000-8000-000000000004}', '{}', '{}'::text[], '{test_insights}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;
