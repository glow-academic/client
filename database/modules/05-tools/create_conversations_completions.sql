-- Module: create_conversations_completions
-- Category: tool
-- Description: create_conversations_completions MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('507c6e33-916d-4ae2-ac86-44b75ba309da', 'conversations_completions', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('9114bb55-81bf-467a-808b-68c52d811966', 'conversation_id', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('c34358e4-8df8-4637-b29a-3b81cde1cdc5', '9114bb55-81bf-467a-808b-68c52d811966', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('c0f083e8-53bf-4d23-b91c-54b8bf9683f5', '9114bb55-81bf-467a-808b-68c52d811966', 'conversation_id', '{{ conversation_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('821a96ca-94cd-4122-bf6f-1aa3e21d74bd', 'end_reason', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('cf4b80ed-716e-4e96-b886-2314344e3d1e', '821a96ca-94cd-4122-bf6f-1aa3e21d74bd', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('d6113364-784c-4036-8dfd-a86f2e193827', '821a96ca-94cd-4122-bf6f-1aa3e21d74bd', 'end_reason', '{{ end_reason }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('79cddfbb-4db6-45a3-a4a9-4af57177a217', 'Create a new conversations completions entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('7e86d0fe-a11e-4dbe-8f9c-7bbdea1d8063', 'create_conversations_completions', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('0862abe9-cee5-4b20-9ec2-46289ec37d2e', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_conversations_completions', 'Create a new conversations completions entry', '{}', 'create', '{9114bb55-81bf-467a-808b-68c52d811966,821a96ca-94cd-4122-bf6f-1aa3e21d74bd}', '{c0f083e8-53bf-4d23-b91c-54b8bf9683f5,d6113364-784c-4036-8dfd-a86f2e193827}', '{}'::text[], '{conversations_completions}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('f3d84449-c2da-47a7-a902-a88feaa5f8d1', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('f3d84449-c2da-47a7-a902-a88feaa5f8d1', 'c34358e4-8df8-4637-b29a-3b81cde1cdc5', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('f3d84449-c2da-47a7-a902-a88feaa5f8d1', 'cf4b80ed-716e-4e96-b886-2314344e3d1e', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('f3d84449-c2da-47a7-a902-a88feaa5f8d1', '9114bb55-81bf-467a-808b-68c52d811966', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('f3d84449-c2da-47a7-a902-a88feaa5f8d1', '821a96ca-94cd-4122-bf6f-1aa3e21d74bd', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('f3d84449-c2da-47a7-a902-a88feaa5f8d1', 'c0f083e8-53bf-4d23-b91c-54b8bf9683f5', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('f3d84449-c2da-47a7-a902-a88feaa5f8d1', 'd6113364-784c-4036-8dfd-a86f2e193827', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('f3d84449-c2da-47a7-a902-a88feaa5f8d1', '507c6e33-916d-4ae2-ac86-44b75ba309da', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('f3d84449-c2da-47a7-a902-a88feaa5f8d1', '79cddfbb-4db6-45a3-a4a9-4af57177a217', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('f3d84449-c2da-47a7-a902-a88feaa5f8d1', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('f3d84449-c2da-47a7-a902-a88feaa5f8d1', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('f3d84449-c2da-47a7-a902-a88feaa5f8d1', '7e86d0fe-a11e-4dbe-8f9c-7bbdea1d8063', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('f3d84449-c2da-47a7-a902-a88feaa5f8d1', '0862abe9-cee5-4b20-9ec2-46289ec37d2e', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
