-- Module: list_scenario
-- Category: tool
-- Description: list_scenario MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019521b0-0005-7000-8000-000000000001', 'search', 'Text search filter for scenario names', 'string', false, '', '2026-02-24T01:53:57.278464+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019521b0-0005-7000-8000-000000000002', 'persona_ids', 'Comma-separated persona IDs to filter by', 'string', false, '', '2026-02-24T01:53:57.278464+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019521b0-0005-7000-8000-000000000003', 'simulation_ids', 'Comma-separated simulation IDs to filter by', 'string', false, '', '2026-02-24T01:53:57.278464+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019521b0-0005-7000-8000-000000000004', 'department_ids', 'Comma-separated department IDs to filter by', 'string', false, '', '2026-02-24T01:53:57.278464+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019521b0-0005-7000-8000-000000000005', 'page_size', 'Number of results per page', 'string', false, '', '2026-02-24T01:53:57.278464+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019521b0-0005-7000-8000-000000000006', 'page_offset', 'Page offset for pagination', 'string', false, '', '2026-02-24T01:53:57.278464+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019521b0-0034-7000-8000-000000000001', 'list_scenario', '2026-02-24T01:53:57.278464+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('019521b0-0024-7000-8000-000000000001', '2026-02-24T01:53:57.278464+00:00', false, false, true, 'list_scenario', 'List scenarios with optional search and filters. Returns scenarios with permissions (can_edit, can_delete, can_duplicate), persona/simulation/department filter options, and pagination support.', '{}', 'list', '{019521b0-0005-7000-8000-000000000001,019521b0-0005-7000-8000-000000000002,019521b0-0005-7000-8000-000000000003,019521b0-0005-7000-8000-000000000004,019521b0-0005-7000-8000-000000000005,019521b0-0005-7000-8000-000000000006}', '{}', '{}'::text[], '{}'::text[], '{scenario}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019521b0-0014-7000-8000-000000000001', '2026-02-24T01:53:57.278464+00:00', '2026-02-24T01:53:57.278464+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019521b0-0014-7000-8000-000000000001', '019521b0-0005-7000-8000-000000000001', '2026-02-24T01:53:57.278464+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019521b0-0014-7000-8000-000000000001', '019521b0-0005-7000-8000-000000000002', '2026-02-24T01:53:57.278464+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019521b0-0014-7000-8000-000000000001', '019521b0-0005-7000-8000-000000000003', '2026-02-24T01:53:57.278464+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019521b0-0014-7000-8000-000000000001', '019521b0-0005-7000-8000-000000000004', '2026-02-24T01:53:57.278464+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019521b0-0014-7000-8000-000000000001', '019521b0-0005-7000-8000-000000000005', '2026-02-24T01:53:57.278464+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019521b0-0014-7000-8000-000000000001', '019521b0-0005-7000-8000-000000000006', '2026-02-24T01:53:57.278464+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_artifacts_junction
INSERT INTO public.tool_artifacts_junction (tool_id, artifacts_id, active, generated, mcp, created_at) VALUES ('019521b0-0014-7000-8000-000000000001', '019c8d5a-6426-7b8a-ac19-312e6337caef', true, false, false, '2026-02-24T01:53:57.278464+00:00') ON CONFLICT (tool_id, artifacts_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operations_id, created_at, active, generated, mcp) VALUES ('019521b0-0014-7000-8000-000000000001', '019d0000-0001-7000-8000-000000000006', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operations_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, names_id, created_at, generated, mcp, active) VALUES ('019521b0-0014-7000-8000-000000000001', '019521b0-0034-7000-8000-000000000001', '2026-02-24T01:53:57.278464+00:00', false, false, true) ON CONFLICT (tool_id, names_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019521b0-0014-7000-8000-000000000001', '019521b0-0024-7000-8000-000000000001', true, '2026-02-24T01:53:57.278464+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
