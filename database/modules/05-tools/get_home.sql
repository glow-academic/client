-- Module: get_home
-- Category: tool
-- Description: get_home MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019522a0-0001-7000-8000-000000000001', 'history_sort_by', 'Sort history by field (e.g. created_at)', 'string', false, '', '2026-02-24T11:27:01.778199+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019522a0-0001-7000-8000-000000000002', 'history_sort_order', 'Sort order: asc or desc', 'string', false, '', '2026-02-24T11:27:01.778199+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019522a0-0001-7000-8000-000000000003', 'history_page', 'Page number for paginated history', 'string', false, '', '2026-02-24T11:27:01.778199+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019522a0-0001-7000-8000-000000000004', 'history_page_size', 'Number of items per page', 'string', false, '', '2026-02-24T11:27:01.778199+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019522a0-0001-7000-8000-000000000005', 'history_simulation_search', 'Search filter for simulations in history', 'string', false, '', '2026-02-24T11:27:01.778199+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019522a0-0001-7000-8000-000000000006', 'history_scenario_search', 'Search filter for scenarios in history', 'string', false, '', '2026-02-24T11:27:01.778199+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019522a0-0001-7000-8000-000000000007', 'history_show_archived', 'Show archived entries (true/false)', 'string', false, '', '2026-02-24T11:27:01.778199+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019522a0-0001-7000-8000-000000000008', 'history_infinite_mode', 'Enable infinite scrolling mode (true/false)', 'string', false, '', '2026-02-24T11:27:01.778199+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.artifacts_resource (id, artifact, active, generated, mcp, created_at) VALUES ('019c8d5a-6426-7cd5-86df-0a7fb1beafac', 'home', true, false, false, '2026-02-24T01:53:57.278464+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019522a0-0030-7000-8000-00000000000a', 'get_home', '2026-02-24T11:27:01.778199+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('019522a0-0020-7000-8000-00000000000a', '2026-02-24T11:27:01.778199+00:00', false, false, true, 'get_home', 'Re-fetch home context with optional history filters.', '{}', 'get', '{019522a0-0001-7000-8000-000000000001,019522a0-0001-7000-8000-000000000002,019522a0-0001-7000-8000-000000000003,019522a0-0001-7000-8000-000000000004,019522a0-0001-7000-8000-000000000005,019522a0-0001-7000-8000-000000000006,019522a0-0001-7000-8000-000000000007,019522a0-0001-7000-8000-000000000008}', '{}', '{}'::text[], '{}'::text[], '{home}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019522a0-0010-7000-8000-00000000000a', '2026-02-24T11:27:01.778199+00:00', '2026-02-24T11:27:01.778199+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019522a0-0010-7000-8000-00000000000a', '019522a0-0001-7000-8000-000000000001', '2026-02-24T11:27:01.778199+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019522a0-0010-7000-8000-00000000000a', '019522a0-0001-7000-8000-000000000002', '2026-02-24T11:27:01.778199+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019522a0-0010-7000-8000-00000000000a', '019522a0-0001-7000-8000-000000000003', '2026-02-24T11:27:01.778199+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019522a0-0010-7000-8000-00000000000a', '019522a0-0001-7000-8000-000000000004', '2026-02-24T11:27:01.778199+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019522a0-0010-7000-8000-00000000000a', '019522a0-0001-7000-8000-000000000005', '2026-02-24T11:27:01.778199+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019522a0-0010-7000-8000-00000000000a', '019522a0-0001-7000-8000-000000000006', '2026-02-24T11:27:01.778199+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019522a0-0010-7000-8000-00000000000a', '019522a0-0001-7000-8000-000000000007', '2026-02-24T11:27:01.778199+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019522a0-0010-7000-8000-00000000000a', '019522a0-0001-7000-8000-000000000008', '2026-02-24T11:27:01.778199+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_artifacts_junction
INSERT INTO public.tool_artifacts_junction (tool_id, artifacts_id, active, generated, mcp, created_at) VALUES ('019522a0-0010-7000-8000-00000000000a', '019c8d5a-6426-7cd5-86df-0a7fb1beafac', true, false, false, '2026-02-24T11:27:01.778199+00:00') ON CONFLICT (tool_id, artifacts_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operations_id, created_at, active, generated, mcp) VALUES ('019522a0-0010-7000-8000-00000000000a', '019d0000-0001-7000-8000-000000000001', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operations_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, names_id, created_at, generated, mcp, active) VALUES ('019522a0-0010-7000-8000-00000000000a', '019522a0-0030-7000-8000-00000000000a', '2026-02-24T11:27:01.778199+00:00', false, false, true) ON CONFLICT (tool_id, names_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019522a0-0010-7000-8000-00000000000a', '019522a0-0020-7000-8000-00000000000a', true, '2026-02-24T11:27:01.778199+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
