-- Module: create_attempt
-- Category: tool
-- Description: create_attempt MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('6aaad9e1-56e4-4bf2-af8f-e88cd45b8fe0', 'attempts', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('dfa9be52-ed7b-44ce-b917-a6a5594a242d', 'infinite_mode', '', 'boolean', false, 'false', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('f78197ac-7221-4a19-b102-b3035de514f7', 'dfa9be52-ed7b-44ce-b917-a6a5594a242d', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('98b048f8-0d17-4769-a4ea-a471bf6bcda4', 'dfa9be52-ed7b-44ce-b917-a6a5594a242d', 'infinite_mode', '{{ infinite_mode }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('89dfbe7b-dee1-4900-bc15-69aea1af5f1a', 'num_chats', '', 'number', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('fe42aad2-af5e-4f5e-9a98-e074f17b1c33', '89dfbe7b-dee1-4900-bc15-69aea1af5f1a', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('2e747578-b924-4e1f-809b-b8c4a275d8e5', '89dfbe7b-dee1-4900-bc15-69aea1af5f1a', 'num_chats', '{{ num_chats }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('7f02441e-f75c-487b-8ff9-60f7aaf9c4e0', 'user_persona_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('73e2b648-1182-47cc-bdbb-aaca5f304e0c', '7f02441e-f75c-487b-8ff9-60f7aaf9c4e0', 2, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('83873a29-532b-494d-8b6d-c2539e350638', '7f02441e-f75c-487b-8ff9-60f7aaf9c4e0', 'user_persona_id', '{{ user_persona_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('631156b9-37f4-4001-8b04-4d60aa42c21c', 'Create a new attempt entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('244d3754-c06f-4266-9d4c-5c9cac5b81f0', 'create_attempt', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('74352a99-2bec-4f7d-9ecc-51d80657f4f9', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_attempt', 'Create a new attempt entry', '{}', 'create', '{dfa9be52-ed7b-44ce-b917-a6a5594a242d,89dfbe7b-dee1-4900-bc15-69aea1af5f1a,7f02441e-f75c-487b-8ff9-60f7aaf9c4e0}', '{98b048f8-0d17-4769-a4ea-a471bf6bcda4,2e747578-b924-4e1f-809b-b8c4a275d8e5,83873a29-532b-494d-8b6d-c2539e350638}', '{}'::text[], '{attempts}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('0c6823ee-5153-4dc5-a7bb-a9bcc5f61669', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('0c6823ee-5153-4dc5-a7bb-a9bcc5f61669', 'f78197ac-7221-4a19-b102-b3035de514f7', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('0c6823ee-5153-4dc5-a7bb-a9bcc5f61669', 'fe42aad2-af5e-4f5e-9a98-e074f17b1c33', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('0c6823ee-5153-4dc5-a7bb-a9bcc5f61669', '73e2b648-1182-47cc-bdbb-aaca5f304e0c', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('0c6823ee-5153-4dc5-a7bb-a9bcc5f61669', 'dfa9be52-ed7b-44ce-b917-a6a5594a242d', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('0c6823ee-5153-4dc5-a7bb-a9bcc5f61669', '89dfbe7b-dee1-4900-bc15-69aea1af5f1a', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('0c6823ee-5153-4dc5-a7bb-a9bcc5f61669', '7f02441e-f75c-487b-8ff9-60f7aaf9c4e0', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('0c6823ee-5153-4dc5-a7bb-a9bcc5f61669', '98b048f8-0d17-4769-a4ea-a471bf6bcda4', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('0c6823ee-5153-4dc5-a7bb-a9bcc5f61669', '2e747578-b924-4e1f-809b-b8c4a275d8e5', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('0c6823ee-5153-4dc5-a7bb-a9bcc5f61669', '83873a29-532b-494d-8b6d-c2539e350638', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('0c6823ee-5153-4dc5-a7bb-a9bcc5f61669', '6aaad9e1-56e4-4bf2-af8f-e88cd45b8fe0', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('0c6823ee-5153-4dc5-a7bb-a9bcc5f61669', '631156b9-37f4-4001-8b04-4d60aa42c21c', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('0c6823ee-5153-4dc5-a7bb-a9bcc5f61669', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('0c6823ee-5153-4dc5-a7bb-a9bcc5f61669', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('0c6823ee-5153-4dc5-a7bb-a9bcc5f61669', '244d3754-c06f-4266-9d4c-5c9cac5b81f0', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('0c6823ee-5153-4dc5-a7bb-a9bcc5f61669', '74352a99-2bec-4f7d-9ecc-51d80657f4f9', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
