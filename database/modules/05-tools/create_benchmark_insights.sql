-- Module: create_benchmark_insights
-- Category: tool
-- Description: create_benchmark_insights tool (benchmark insight generation)
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (created_at, active, generated, mcp, id, name, description, field_type, required, default_value) VALUES ('2026-02-26T00:00:00.000000+00:00', true, false, false, '018f0001-0001-7000-8000-000000000005', 'benchmark_insight_content', 'The analytical insight text about benchmark results', 'string', true, '') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (created_at, active, generated, mcp, id, name, description, field_type, required, default_value) VALUES ('2026-02-26T00:00:00.000000+00:00', true, false, false, '018f0001-0001-7000-8000-000000000006', 'benchmark_insight_group_id', 'The group ID to attach the insight to', 'string', true, '') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (created_at, active, generated, mcp, id, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('2026-02-26T00:00:00.000000+00:00', true, false, false, '018f0002-0001-7000-8000-000000000004', 'create_benchmark_insights', 'Create a benchmark insight entry', '{}', 'create', '{018f0001-0001-7000-8000-000000000005,018f0001-0001-7000-8000-000000000006}', '{}', '{}'::text[], '{benchmark_insights}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;
