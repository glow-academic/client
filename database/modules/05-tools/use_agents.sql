-- Module: use_agents
-- Category: tool
-- Description: use_agents MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-7363-a53b-59c0c5d9656b', 'agent_id', '', 'string', true, '', '2026-01-13T02:51:36.014392+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4f27-1767-7bba-8bbb-21302f3426ba', '019bbf87-091f-7363-a53b-59c0c5d9656b', 0, '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c4f27-175c-7b5e-9ebc-a2af6925ae0c', 'Use an existing agent resource instead of creating a new one', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c4f27-175b-7fd7-8fdb-e935f473098b', 'use_agents', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('019c4f27-1758-7c66-af1b-4c6c05170ccb', '2026-02-12T00:01:27.881501+00:00', false, false, true, 'use_agents', 'Use an existing agent resource instead of creating a new one', '{}', 'link', '{019bbf87-091f-7363-a53b-59c0c5d9656b}', '{019bbf87-0966-7185-b960-c6c580ea7096}', '{agents}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c4f27-1759-7168-8b7d-783e21c0946f', '2026-02-12T00:01:27.881501+00:00', '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c4f27-1759-7168-8b7d-783e21c0946f', '019c4f27-1767-7bba-8bbb-21302f3426ba', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c4f27-1759-7168-8b7d-783e21c0946f', '019bbf87-091f-7363-a53b-59c0c5d9656b', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019c4f27-1759-7168-8b7d-783e21c0946f', '019c4f27-175c-7b5e-9ebc-a2af6925ae0c', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, descriptions_id) DO NOTHING;
-- tool_resources_junction
INSERT INTO public.tool_resources_junction (tool_id, resources_id, active, created_at, generated, mcp) VALUES ('019c4f27-1759-7168-8b7d-783e21c0946f', '019bbeb4-5109-7671-b1cc-ed9a018d7c13', true, '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (tool_id, resources_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flags_id, created_at, generated, mcp, active) VALUES ('019c4f27-1759-7168-8b7d-783e21c0946f', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, flags_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operations_id, created_at, active, generated, mcp) VALUES ('019c4f27-1759-7168-8b7d-783e21c0946f', '019d0000-0001-7000-8000-000000000003', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operations_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, names_id, created_at, generated, mcp, active) VALUES ('019c4f27-1759-7168-8b7d-783e21c0946f', '019c4f27-175b-7fd7-8fdb-e935f473098b', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, names_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c4f27-1759-7168-8b7d-783e21c0946f', '019c4f27-1758-7c66-af1b-4c6c05170ccb', true, '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
