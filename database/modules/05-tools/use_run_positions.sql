-- Module: use_run_positions
-- Category: tool
-- Description: use_run_positions MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('3f8275d5-da10-4351-bae9-465313516649', 'run_position_id', '', 'string', true, '', '2026-02-21T22:16:39.602906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('d7ab4d9f-433d-4eef-a0b7-6ea22699fe63', '3f8275d5-da10-4351-bae9-465313516649', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('a55dbf53-b737-406e-a338-ea1aef26096a', '3f8275d5-da10-4351-bae9-465313516649', 'id', '{{ run_position_id }}', '2026-02-21T22:16:39.604747+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d8a-7c59-a5a3-b8bc6b5e0a0e', 'Use an existing run positions resource instead of creating a new one', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d8a-7bd4-bf5a-83765247eb1d', 'use_run_positions', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('88115f24-f7ca-45cd-a431-ef9b381a96d0', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'use_run_positions', 'Use an existing run position by its ID', '{}', 'link', '{3f8275d5-da10-4351-bae9-465313516649}', '{a55dbf53-b737-406e-a338-ea1aef26096a}', '{}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('6321ad07-a435-4a43-9158-f313cad3d4aa', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('6321ad07-a435-4a43-9158-f313cad3d4aa', 'd7ab4d9f-433d-4eef-a0b7-6ea22699fe63', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('6321ad07-a435-4a43-9158-f313cad3d4aa', '3f8275d5-da10-4351-bae9-465313516649', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('6321ad07-a435-4a43-9158-f313cad3d4aa', 'a55dbf53-b737-406e-a338-ea1aef26096a', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('6321ad07-a435-4a43-9158-f313cad3d4aa', '019c82b8-5d8a-7c59-a5a3-b8bc6b5e0a0e', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('6321ad07-a435-4a43-9158-f313cad3d4aa', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('6321ad07-a435-4a43-9158-f313cad3d4aa', '019d0000-0001-7000-8000-000000000003', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('6321ad07-a435-4a43-9158-f313cad3d4aa', '019c82b8-5d8a-7bd4-bf5a-83765247eb1d', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('6321ad07-a435-4a43-9158-f313cad3d4aa', '88115f24-f7ca-45cd-a431-ef9b381a96d0', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
