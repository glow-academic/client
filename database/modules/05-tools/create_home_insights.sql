-- Module: create_home_insights
-- Category: tool
-- Description: create_home_insights MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('dad42670-c90e-4732-8625-a15ceedb493b', 'group_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('469d7981-8647-44f4-8d4d-1e1d95b053ef', 'dad42670-c90e-4732-8625-a15ceedb493b', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('78305f5f-a7e8-45a6-ac5b-6c6c0c394e98', 'dad42670-c90e-4732-8625-a15ceedb493b', 'group_id', '{{ group_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('176f6c23-72b9-47bc-a54b-2f1f984e541f', 'content', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('526e7ff8-9c5a-4656-8d9f-6b63b250d312', '176f6c23-72b9-47bc-a54b-2f1f984e541f', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('70d7e964-25e9-419a-bc20-d5501775af32', '176f6c23-72b9-47bc-a54b-2f1f984e541f', 'content', '{{ content }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('f9f963c0-71f3-41b3-aeb9-48402fe0f1be', 'Create a new home insights entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('330793be-9589-4d11-8831-003cc1cf48fe', 'create_home_insights', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('b6b5e346-4ba0-4118-afc4-c28252554a4d', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_home_insights', 'Create a new home insights entry', '{}', 'create', '{dad42670-c90e-4732-8625-a15ceedb493b,176f6c23-72b9-47bc-a54b-2f1f984e541f}', '{78305f5f-a7e8-45a6-ac5b-6c6c0c394e98,70d7e964-25e9-419a-bc20-d5501775af32}', '{}'::text[], '{home_insights}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('5ecad0ba-652a-405a-85d1-b9b42ceab743', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('5ecad0ba-652a-405a-85d1-b9b42ceab743', '469d7981-8647-44f4-8d4d-1e1d95b053ef', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('5ecad0ba-652a-405a-85d1-b9b42ceab743', '526e7ff8-9c5a-4656-8d9f-6b63b250d312', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('5ecad0ba-652a-405a-85d1-b9b42ceab743', 'dad42670-c90e-4732-8625-a15ceedb493b', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('5ecad0ba-652a-405a-85d1-b9b42ceab743', '176f6c23-72b9-47bc-a54b-2f1f984e541f', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('5ecad0ba-652a-405a-85d1-b9b42ceab743', '78305f5f-a7e8-45a6-ac5b-6c6c0c394e98', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('5ecad0ba-652a-405a-85d1-b9b42ceab743', '70d7e964-25e9-419a-bc20-d5501775af32', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('5ecad0ba-652a-405a-85d1-b9b42ceab743', '018f0004-0001-7000-8000-000000000006', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('5ecad0ba-652a-405a-85d1-b9b42ceab743', 'f9f963c0-71f3-41b3-aeb9-48402fe0f1be', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('5ecad0ba-652a-405a-85d1-b9b42ceab743', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('5ecad0ba-652a-405a-85d1-b9b42ceab743', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('5ecad0ba-652a-405a-85d1-b9b42ceab743', '330793be-9589-4d11-8831-003cc1cf48fe', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('5ecad0ba-652a-405a-85d1-b9b42ceab743', 'b6b5e346-4ba0-4118-afc4-c28252554a4d', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
