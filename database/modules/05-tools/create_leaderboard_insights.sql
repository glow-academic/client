-- Module: create_leaderboard_insights
-- Category: tool
-- Description: create_leaderboard_insights MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('0ffb0afd-93b0-49aa-ba1b-8e84521fa889', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('711cb221-f041-4fd7-93cf-2adca1b5cf1d', '0ffb0afd-93b0-49aa-ba1b-8e84521fa889', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('8157fd81-2258-43a7-871b-483e9af6122b', '0ffb0afd-93b0-49aa-ba1b-8e84521fa889', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('30f48acf-ed5c-4ffd-8f71-a6d4d3842536', 'group_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('b5a8c389-b1b9-4cd9-8544-08ffc4c8c0f9', '30f48acf-ed5c-4ffd-8f71-a6d4d3842536', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('2fd808d8-13dd-4b79-b77a-542bfc88f5aa', '30f48acf-ed5c-4ffd-8f71-a6d4d3842536', 'group_id', '{{ group_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('55f671f7-aaec-4df5-9b0c-66194263583f', 'content', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('69e0c56f-7772-433d-be21-cd5de480213d', '55f671f7-aaec-4df5-9b0c-66194263583f', 2, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('410aeaaa-a6e3-47e8-aa56-c20870ccc7c2', '55f671f7-aaec-4df5-9b0c-66194263583f', 'content', '{{ content }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('912b38c9-abe8-41e0-9893-912b8a16812b', 'Create a new leaderboard insights entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('8caabb39-a02d-4967-83d4-45e687a450f3', 'create_leaderboard_insights', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('6013878d-91ef-44a4-9ddf-1d3b1e657c51', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_leaderboard_insights', 'Create a new leaderboard insights entry', '{}', 'create', '{0ffb0afd-93b0-49aa-ba1b-8e84521fa889,30f48acf-ed5c-4ffd-8f71-a6d4d3842536,55f671f7-aaec-4df5-9b0c-66194263583f}', '{8157fd81-2258-43a7-871b-483e9af6122b,2fd808d8-13dd-4b79-b77a-542bfc88f5aa,410aeaaa-a6e3-47e8-aa56-c20870ccc7c2}', '{}'::text[], '{leaderboard_insights}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('defc26a4-469e-4f90-b415-f19bb944ed04', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('defc26a4-469e-4f90-b415-f19bb944ed04', '711cb221-f041-4fd7-93cf-2adca1b5cf1d', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('defc26a4-469e-4f90-b415-f19bb944ed04', 'b5a8c389-b1b9-4cd9-8544-08ffc4c8c0f9', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('defc26a4-469e-4f90-b415-f19bb944ed04', '69e0c56f-7772-433d-be21-cd5de480213d', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('defc26a4-469e-4f90-b415-f19bb944ed04', '0ffb0afd-93b0-49aa-ba1b-8e84521fa889', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('defc26a4-469e-4f90-b415-f19bb944ed04', '30f48acf-ed5c-4ffd-8f71-a6d4d3842536', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('defc26a4-469e-4f90-b415-f19bb944ed04', '55f671f7-aaec-4df5-9b0c-66194263583f', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('defc26a4-469e-4f90-b415-f19bb944ed04', '8157fd81-2258-43a7-871b-483e9af6122b', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('defc26a4-469e-4f90-b415-f19bb944ed04', '2fd808d8-13dd-4b79-b77a-542bfc88f5aa', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('defc26a4-469e-4f90-b415-f19bb944ed04', '410aeaaa-a6e3-47e8-aa56-c20870ccc7c2', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('defc26a4-469e-4f90-b415-f19bb944ed04', '018f0004-0001-7000-8000-000000000007', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('defc26a4-469e-4f90-b415-f19bb944ed04', '912b38c9-abe8-41e0-9893-912b8a16812b', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('defc26a4-469e-4f90-b415-f19bb944ed04', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('defc26a4-469e-4f90-b415-f19bb944ed04', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('defc26a4-469e-4f90-b415-f19bb944ed04', '8caabb39-a02d-4967-83d4-45e687a450f3', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('defc26a4-469e-4f90-b415-f19bb944ed04', '6013878d-91ef-44a4-9ddf-1d3b1e657c51', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
