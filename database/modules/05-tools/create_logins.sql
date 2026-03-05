-- Module: create_logins
-- Category: tool
-- Description: create_logins MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('f4fabdc1-3cc4-44c5-897f-bcadf7e5f62e', 'logins', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('8ae71430-5842-4b4b-b003-f54d721a7430', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('7dce70fb-1332-432c-a918-979dfccf2c19', '8ae71430-5842-4b4b-b003-f54d721a7430', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('011c888e-d084-42dd-b4c9-6bcc07a6bd87', '8ae71430-5842-4b4b-b003-f54d721a7430', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('69cc9fd3-f380-4818-bab5-575ddb7d12d5', 'last_login', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('15fe7264-74eb-463c-b4d3-1d380e0e011d', '69cc9fd3-f380-4818-bab5-575ddb7d12d5', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('b0df166a-7a29-4b92-9588-011e7940c57c', '69cc9fd3-f380-4818-bab5-575ddb7d12d5', 'last_login', '{{ last_login }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('d6b4b151-0c0b-4437-b666-68529c1eb2e8', 'Create a new logins entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('bb9c7f43-4a7a-46ba-bbb1-cc2251be88b7', 'create_logins', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('77b7b730-6396-48bb-8e0c-fe188c17b7d7', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_logins', 'Create a new logins entry', '{}', 'create', '{8ae71430-5842-4b4b-b003-f54d721a7430,69cc9fd3-f380-4818-bab5-575ddb7d12d5}', '{011c888e-d084-42dd-b4c9-6bcc07a6bd87,b0df166a-7a29-4b92-9588-011e7940c57c}', '{}'::text[], '{logins}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('b0c6d072-8af3-4abd-b09c-1158a59f6031', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('b0c6d072-8af3-4abd-b09c-1158a59f6031', '7dce70fb-1332-432c-a918-979dfccf2c19', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('b0c6d072-8af3-4abd-b09c-1158a59f6031', '15fe7264-74eb-463c-b4d3-1d380e0e011d', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('b0c6d072-8af3-4abd-b09c-1158a59f6031', '8ae71430-5842-4b4b-b003-f54d721a7430', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('b0c6d072-8af3-4abd-b09c-1158a59f6031', '69cc9fd3-f380-4818-bab5-575ddb7d12d5', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('b0c6d072-8af3-4abd-b09c-1158a59f6031', '011c888e-d084-42dd-b4c9-6bcc07a6bd87', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('b0c6d072-8af3-4abd-b09c-1158a59f6031', 'b0df166a-7a29-4b92-9588-011e7940c57c', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('b0c6d072-8af3-4abd-b09c-1158a59f6031', 'f4fabdc1-3cc4-44c5-897f-bcadf7e5f62e', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('b0c6d072-8af3-4abd-b09c-1158a59f6031', 'd6b4b151-0c0b-4437-b666-68529c1eb2e8', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('b0c6d072-8af3-4abd-b09c-1158a59f6031', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('b0c6d072-8af3-4abd-b09c-1158a59f6031', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('b0c6d072-8af3-4abd-b09c-1158a59f6031', 'bb9c7f43-4a7a-46ba-bbb1-cc2251be88b7', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('b0c6d072-8af3-4abd-b09c-1158a59f6031', '77b7b730-6396-48bb-8e0c-fe188c17b7d7', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
