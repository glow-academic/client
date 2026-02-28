-- Module: create_practice_insights
-- Category: tool
-- Description: create_practice_insights MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('83511c96-ae04-4dd7-90b7-d2f5a11b88fd', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('b654aaf3-95fe-4204-978c-7e5fb6bdbac3', '83511c96-ae04-4dd7-90b7-d2f5a11b88fd', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('58dfc028-ec24-4799-b342-25c76cab68c0', '83511c96-ae04-4dd7-90b7-d2f5a11b88fd', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('e64209e3-9ac0-448e-958b-ec77c2bc1303', 'group_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('fb9f21f1-cdb8-4066-80aa-3b1207b9eba1', 'e64209e3-9ac0-448e-958b-ec77c2bc1303', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('6405965a-b346-438d-a765-cff494d53877', 'e64209e3-9ac0-448e-958b-ec77c2bc1303', 'group_id', '{{ group_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('b971bcc4-6c3c-49b5-9e7d-b3072c05b71f', 'content', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('7bf68b18-f939-46c2-8083-5a8886f2486a', 'b971bcc4-6c3c-49b5-9e7d-b3072c05b71f', 2, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('d2a188dd-e5ef-4f65-84dc-b45e02df75c3', 'b971bcc4-6c3c-49b5-9e7d-b3072c05b71f', 'content', '{{ content }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('9f936e1f-c312-4a0c-82c5-64e14095565a', 'Create a new practice insights entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('5c8e1f05-e5ac-46d0-a080-168ce227b87d', 'create_practice_insights', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('45277e82-9781-4b83-9e2c-39ee9ae60458', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_practice_insights', 'Create a new practice insights entry', '{}', 'create', '{83511c96-ae04-4dd7-90b7-d2f5a11b88fd,e64209e3-9ac0-448e-958b-ec77c2bc1303,b971bcc4-6c3c-49b5-9e7d-b3072c05b71f}', '{58dfc028-ec24-4799-b342-25c76cab68c0,6405965a-b346-438d-a765-cff494d53877,d2a188dd-e5ef-4f65-84dc-b45e02df75c3}', '{}'::text[], '{practice_insights}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('8bc5beae-77cd-474f-8e0f-2197afd9c26f', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('8bc5beae-77cd-474f-8e0f-2197afd9c26f', 'b654aaf3-95fe-4204-978c-7e5fb6bdbac3', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('8bc5beae-77cd-474f-8e0f-2197afd9c26f', 'fb9f21f1-cdb8-4066-80aa-3b1207b9eba1', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('8bc5beae-77cd-474f-8e0f-2197afd9c26f', '7bf68b18-f939-46c2-8083-5a8886f2486a', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('8bc5beae-77cd-474f-8e0f-2197afd9c26f', '83511c96-ae04-4dd7-90b7-d2f5a11b88fd', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('8bc5beae-77cd-474f-8e0f-2197afd9c26f', 'e64209e3-9ac0-448e-958b-ec77c2bc1303', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('8bc5beae-77cd-474f-8e0f-2197afd9c26f', 'b971bcc4-6c3c-49b5-9e7d-b3072c05b71f', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('8bc5beae-77cd-474f-8e0f-2197afd9c26f', '58dfc028-ec24-4799-b342-25c76cab68c0', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('8bc5beae-77cd-474f-8e0f-2197afd9c26f', '6405965a-b346-438d-a765-cff494d53877', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('8bc5beae-77cd-474f-8e0f-2197afd9c26f', 'd2a188dd-e5ef-4f65-84dc-b45e02df75c3', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('8bc5beae-77cd-474f-8e0f-2197afd9c26f', '018f0004-0001-7000-8000-000000000008', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('8bc5beae-77cd-474f-8e0f-2197afd9c26f', '9f936e1f-c312-4a0c-82c5-64e14095565a', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('8bc5beae-77cd-474f-8e0f-2197afd9c26f', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('8bc5beae-77cd-474f-8e0f-2197afd9c26f', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('8bc5beae-77cd-474f-8e0f-2197afd9c26f', '5c8e1f05-e5ac-46d0-a080-168ce227b87d', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('8bc5beae-77cd-474f-8e0f-2197afd9c26f', '45277e82-9781-4b83-9e2c-39ee9ae60458', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
