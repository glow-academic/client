-- Module: create_activity_insights
-- Category: tool
-- Description: create_activity_insights MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('c70b6170-bd20-43f6-af58-831c391ad84f', 'group_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('0c6e9fd4-7a33-42c0-881b-ee64240b5896', 'c70b6170-bd20-43f6-af58-831c391ad84f', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('4c562103-efd0-4473-9573-9ab31a1c3885', 'c70b6170-bd20-43f6-af58-831c391ad84f', 'group_id', '{{ group_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('8148f105-417a-43be-beb0-b6220d94e7ae', 'content', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('02768395-d125-4c34-ac57-693cd81235b6', '8148f105-417a-43be-beb0-b6220d94e7ae', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('55c66a2b-c474-40d7-8e8d-6900ce955b45', '8148f105-417a-43be-beb0-b6220d94e7ae', 'content', '{{ content }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('d343f860-95ab-4485-8e2b-884649ee6780', 'Create a new activity insights entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('01755911-8c4a-49fe-9d09-d710d987059e', 'create_activity_insights', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('38143645-0c9f-471b-873b-7315b7fb019b', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_activity_insights', 'Create a new activity insights entry', '{}', 'create', '{c70b6170-bd20-43f6-af58-831c391ad84f,8148f105-417a-43be-beb0-b6220d94e7ae}', '{4c562103-efd0-4473-9573-9ab31a1c3885,55c66a2b-c474-40d7-8e8d-6900ce955b45}', '{}'::text[], '{activity_insights}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('ecc067e3-4f71-4a24-8415-7aa86c697e91', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('ecc067e3-4f71-4a24-8415-7aa86c697e91', '0c6e9fd4-7a33-42c0-881b-ee64240b5896', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('ecc067e3-4f71-4a24-8415-7aa86c697e91', '02768395-d125-4c34-ac57-693cd81235b6', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('ecc067e3-4f71-4a24-8415-7aa86c697e91', 'c70b6170-bd20-43f6-af58-831c391ad84f', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('ecc067e3-4f71-4a24-8415-7aa86c697e91', '8148f105-417a-43be-beb0-b6220d94e7ae', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('ecc067e3-4f71-4a24-8415-7aa86c697e91', '4c562103-efd0-4473-9573-9ab31a1c3885', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('ecc067e3-4f71-4a24-8415-7aa86c697e91', '55c66a2b-c474-40d7-8e8d-6900ce955b45', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('ecc067e3-4f71-4a24-8415-7aa86c697e91', '018f0004-0001-7000-8000-000000000001', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('ecc067e3-4f71-4a24-8415-7aa86c697e91', 'd343f860-95ab-4485-8e2b-884649ee6780', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('ecc067e3-4f71-4a24-8415-7aa86c697e91', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('ecc067e3-4f71-4a24-8415-7aa86c697e91', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('ecc067e3-4f71-4a24-8415-7aa86c697e91', '01755911-8c4a-49fe-9d09-d710d987059e', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('ecc067e3-4f71-4a24-8415-7aa86c697e91', '38143645-0c9f-471b-873b-7315b7fb019b', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
