-- Module: create_tools
-- Category: tool
-- Description: create_tools MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-7940-9825-c757e353ed6d', 'id', '', 'string', true, '', '2026-01-07T07:25:51.781825+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('c9f7df88-deff-448c-ab25-a306bc12e1ea', '019bbf87-091e-7940-9825-c757e353ed6d', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d87-7b6d-ba2a-2982de61e03d', 'Create a new tools resource', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a33-707c-a1b8-8f96094da038', 'create_tools', '2026-01-13T13:03:30.752087+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('d9247def-16e8-4fff-b27e-a8af318a5dd9', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'create_tools', 'Create a new tool binding', '{}', 'create', '{019bbf87-091e-7940-9825-c757e353ed6d}', '{}', '{}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('bb5e9c43-b1c4-4f1f-9d7a-9a97dc6f032b', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('bb5e9c43-b1c4-4f1f-9d7a-9a97dc6f032b', 'c9f7df88-deff-448c-ab25-a306bc12e1ea', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('bb5e9c43-b1c4-4f1f-9d7a-9a97dc6f032b', '019bbf87-091e-7940-9825-c757e353ed6d', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('bb5e9c43-b1c4-4f1f-9d7a-9a97dc6f032b', '019c82b8-5d87-7b6d-ba2a-2982de61e03d', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('bb5e9c43-b1c4-4f1f-9d7a-9a97dc6f032b', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('bb5e9c43-b1c4-4f1f-9d7a-9a97dc6f032b', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('bb5e9c43-b1c4-4f1f-9d7a-9a97dc6f032b', '019bbabc-5a33-707c-a1b8-8f96094da038', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('bb5e9c43-b1c4-4f1f-9d7a-9a97dc6f032b', 'd9247def-16e8-4fff-b27e-a8af318a5dd9', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
