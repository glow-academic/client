-- Module: get_simulation
-- Category: tool
-- Description: get_simulation MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019524a0-0001-7000-8000-000000000010', 'scenario_search', 'Search filter for scenarios', 'string', false, '', '2026-02-24T13:37:34.233100+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019524a0-0001-7000-8000-000000000011', 'filter_scenario_ids', 'Comma-separated scenario IDs to filter by', 'string', false, '', '2026-02-24T13:37:34.233100+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.artifacts_resource (id, artifact, active, generated, mcp, created_at) VALUES ('019c8d5a-6426-7bac-94b4-cfe788bd85b7', 'simulation', true, false, false, '2026-02-24T01:53:57.278464+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019523a0-0030-7000-8000-000000000002', 'get_simulation', '2026-02-24T13:16:34.035984+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('019523a0-0020-7000-8000-000000000002', '2026-02-24T13:16:34.035984+00:00', false, false, true, 'get_simulation', 'Re-fetch simulation configuration context with fresh data.', '{}', 'get', '{019524a0-0001-7000-8000-000000000010,019524a0-0001-7000-8000-000000000011}', '{}', '{}'::text[], '{}'::text[], '{simulation}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019523a0-0010-7000-8000-000000000002', '2026-02-24T13:16:34.035984+00:00', '2026-02-24T13:16:34.035984+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019523a0-0010-7000-8000-000000000002', '019524a0-0001-7000-8000-000000000010', '2026-02-24T13:37:34.233100+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019523a0-0010-7000-8000-000000000002', '019524a0-0001-7000-8000-000000000011', '2026-02-24T13:37:34.233100+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_artifacts_junction
INSERT INTO public.tool_artifacts_junction (tool_id, artifacts_id, active, generated, mcp, created_at) VALUES ('019523a0-0010-7000-8000-000000000002', '019c8d5a-6426-7bac-94b4-cfe788bd85b7', true, false, false, '2026-02-24T13:16:34.035984+00:00') ON CONFLICT (tool_id, artifacts_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operations_id, created_at, active, generated, mcp) VALUES ('019523a0-0010-7000-8000-000000000002', '019d0000-0001-7000-8000-000000000001', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operations_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, names_id, created_at, generated, mcp, active) VALUES ('019523a0-0010-7000-8000-000000000002', '019523a0-0030-7000-8000-000000000002', '2026-02-24T13:16:34.035984+00:00', false, false, true) ON CONFLICT (tool_id, names_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019523a0-0010-7000-8000-000000000002', '019523a0-0020-7000-8000-000000000002', true, '2026-02-24T13:16:34.035984+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
