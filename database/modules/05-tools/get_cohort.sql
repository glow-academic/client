-- Module: get_cohort
-- Category: tool
-- Description: get_cohort MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019521a0-0001-7000-8000-000000000003', 'descriptions_search', 'Search filter for descriptions', 'string', false, '', '2026-02-24T01:53:57.278464+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019524a0-0001-7000-8000-000000000020', 'simulation_search', 'Search filter for simulations', 'string', false, '', '2026-02-24T13:37:34.233100+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019524a0-0001-7000-8000-000000000021', 'simulation_show_selected', 'Show only selected simulations (true/false)', 'string', false, '', '2026-02-24T13:37:34.233100+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019524a0-0001-7000-8000-000000000022', 'profile_search', 'Search filter for profiles', 'string', false, '', '2026-02-24T13:37:34.233100+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019524a0-0001-7000-8000-000000000023', 'profile_show_selected', 'Show only selected profiles (true/false)', 'string', false, '', '2026-02-24T13:37:34.233100+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.artifacts_resource (id, artifact, active, generated, mcp, created_at) VALUES ('019c8d5a-6426-7bd8-b8d2-e129a934f053', 'cohort', true, false, false, '2026-02-24T01:53:57.278464+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019523a0-0030-7000-8000-000000000003', 'get_cohort', '2026-02-24T13:16:34.035984+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('019523a0-0020-7000-8000-000000000003', '2026-02-24T13:16:34.035984+00:00', false, false, true, 'get_cohort', 'Re-fetch cohort configuration context with fresh data.', '{}', 'get', '{019521a0-0001-7000-8000-000000000003,019524a0-0001-7000-8000-000000000020,019524a0-0001-7000-8000-000000000021,019524a0-0001-7000-8000-000000000022,019524a0-0001-7000-8000-000000000023}', '{}', '{}'::text[], '{}'::text[], '{cohort}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019523a0-0010-7000-8000-000000000003', '2026-02-24T13:16:34.035984+00:00', '2026-02-24T13:16:34.035984+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019523a0-0010-7000-8000-000000000003', '019521a0-0001-7000-8000-000000000003', '2026-02-24T13:37:34.233100+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019523a0-0010-7000-8000-000000000003', '019524a0-0001-7000-8000-000000000020', '2026-02-24T13:37:34.233100+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019523a0-0010-7000-8000-000000000003', '019524a0-0001-7000-8000-000000000021', '2026-02-24T13:37:34.233100+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019523a0-0010-7000-8000-000000000003', '019524a0-0001-7000-8000-000000000022', '2026-02-24T13:37:34.233100+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019523a0-0010-7000-8000-000000000003', '019524a0-0001-7000-8000-000000000023', '2026-02-24T13:37:34.233100+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_artifacts_junction
INSERT INTO public.tool_artifacts_junction (tool_id, artifact_id, active, generated, mcp, created_at) VALUES ('019523a0-0010-7000-8000-000000000003', '019c8d5a-6426-7bd8-b8d2-e129a934f053', true, false, false, '2026-02-24T13:16:34.035984+00:00') ON CONFLICT (tool_id, artifact_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('019523a0-0010-7000-8000-000000000003', '019d0000-0001-7000-8000-000000000001', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019523a0-0010-7000-8000-000000000003', '019523a0-0030-7000-8000-000000000003', '2026-02-24T13:16:34.035984+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019523a0-0010-7000-8000-000000000003', '019523a0-0020-7000-8000-000000000003', true, '2026-02-24T13:16:34.035984+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
