-- Module: create_dashboard_insights
-- Category: tool
-- Description: create_dashboard_insights MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('9d2658be-e307-43b1-83b8-2ac81b2dec9b', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('0abbf83c-3f1b-48c7-a188-cf97eb48018c', '9d2658be-e307-43b1-83b8-2ac81b2dec9b', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('4cc270dd-befb-4b64-a00c-c75a4687d6f9', '9d2658be-e307-43b1-83b8-2ac81b2dec9b', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('814aa54b-b797-4047-b238-dd710fcbcc49', 'group_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('b2de7443-e99a-44d5-8ec8-0caea486f2c9', '814aa54b-b797-4047-b238-dd710fcbcc49', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('8ced6fa8-0f16-41e6-ae7b-51ffb977042b', '814aa54b-b797-4047-b238-dd710fcbcc49', 'group_id', '{{ group_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('56179ce5-38e8-4b19-8c59-2a1d8596d8ea', 'content', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('f8dde513-95ad-4530-aa82-160c8c532b6d', '56179ce5-38e8-4b19-8c59-2a1d8596d8ea', 2, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('b59a9d5c-2e77-4075-8411-fc79883c948e', '56179ce5-38e8-4b19-8c59-2a1d8596d8ea', 'content', '{{ content }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('b065efc1-a29e-4198-996d-ba2166cca7ca', 'Create a new dashboard insights entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('f651fc92-8a8e-4e3d-9801-2bc727136858', 'create_dashboard_insights', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('822f8c26-f3bf-44c9-a8a9-cb94c388fc23', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_dashboard_insights', 'Create a new dashboard insights entry', '{}', 'create', '{9d2658be-e307-43b1-83b8-2ac81b2dec9b,814aa54b-b797-4047-b238-dd710fcbcc49,56179ce5-38e8-4b19-8c59-2a1d8596d8ea}', '{4cc270dd-befb-4b64-a00c-c75a4687d6f9,8ced6fa8-0f16-41e6-ae7b-51ffb977042b,b59a9d5c-2e77-4075-8411-fc79883c948e}', '{}'::text[], '{dashboard_insights}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('c8d54c0a-e3b2-4625-93a4-5cf9946310ab', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('c8d54c0a-e3b2-4625-93a4-5cf9946310ab', '0abbf83c-3f1b-48c7-a188-cf97eb48018c', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('c8d54c0a-e3b2-4625-93a4-5cf9946310ab', 'b2de7443-e99a-44d5-8ec8-0caea486f2c9', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('c8d54c0a-e3b2-4625-93a4-5cf9946310ab', 'f8dde513-95ad-4530-aa82-160c8c532b6d', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('c8d54c0a-e3b2-4625-93a4-5cf9946310ab', '9d2658be-e307-43b1-83b8-2ac81b2dec9b', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('c8d54c0a-e3b2-4625-93a4-5cf9946310ab', '814aa54b-b797-4047-b238-dd710fcbcc49', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('c8d54c0a-e3b2-4625-93a4-5cf9946310ab', '56179ce5-38e8-4b19-8c59-2a1d8596d8ea', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('c8d54c0a-e3b2-4625-93a4-5cf9946310ab', '4cc270dd-befb-4b64-a00c-c75a4687d6f9', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('c8d54c0a-e3b2-4625-93a4-5cf9946310ab', '8ced6fa8-0f16-41e6-ae7b-51ffb977042b', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('c8d54c0a-e3b2-4625-93a4-5cf9946310ab', 'b59a9d5c-2e77-4075-8411-fc79883c948e', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('c8d54c0a-e3b2-4625-93a4-5cf9946310ab', '018f0004-0001-7000-8000-000000000004', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('c8d54c0a-e3b2-4625-93a4-5cf9946310ab', 'b065efc1-a29e-4198-996d-ba2166cca7ca', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('c8d54c0a-e3b2-4625-93a4-5cf9946310ab', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('c8d54c0a-e3b2-4625-93a4-5cf9946310ab', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('c8d54c0a-e3b2-4625-93a4-5cf9946310ab', 'f651fc92-8a8e-4e3d-9801-2bc727136858', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('c8d54c0a-e3b2-4625-93a4-5cf9946310ab', '822f8c26-f3bf-44c9-a8a9-cb94c388fc23', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
