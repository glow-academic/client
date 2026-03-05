-- Module: create_attempt_message
-- Category: tool
-- Description: create_attempt_message MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('61b58540-2997-4290-8243-f037038a09e2', 'attempt_messages', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('887b8a34-f85b-4a09-9f04-e6f7aaac670c', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('8157ae48-852d-4ba1-a0f0-5c4598baef36', '887b8a34-f85b-4a09-9f04-e6f7aaac670c', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('0a025758-b2e5-4843-8204-9e7e5e8cffc6', '887b8a34-f85b-4a09-9f04-e6f7aaac670c', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('e4dc259e-55eb-4c6e-be2b-2b7eebe4c9c3', 'chat_id', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('a8e66212-0f19-4a83-8ff5-766ca6aca0e8', 'e4dc259e-55eb-4c6e-be2b-2b7eebe4c9c3', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('3ae54980-8d2e-405b-bd45-333fb37b32a9', 'e4dc259e-55eb-4c6e-be2b-2b7eebe4c9c3', 'chat_id', '{{ chat_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('f1b8d23a-00e7-4649-b4a7-a87e367c895f', 'message_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('e71d8da3-5058-4a5a-a721-e628d042f1bb', 'f1b8d23a-00e7-4649-b4a7-a87e367c895f', 2, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('032e2b8f-9d1c-4b26-ad34-6db820bdf4b6', 'f1b8d23a-00e7-4649-b4a7-a87e367c895f', 'message_id', '{{ message_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('40d4097f-8a82-4d26-9377-0ec1d5b245af', 'Create a new attempt message entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('b7af309c-dc7d-4122-b9ab-7a88bc71ce3c', 'create_attempt_message', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('fe98c532-d630-4f38-b3a0-489801b4df41', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_attempt_message', 'Create a new attempt message entry', '{}', 'create', '{887b8a34-f85b-4a09-9f04-e6f7aaac670c,e4dc259e-55eb-4c6e-be2b-2b7eebe4c9c3,f1b8d23a-00e7-4649-b4a7-a87e367c895f}', '{0a025758-b2e5-4843-8204-9e7e5e8cffc6,3ae54980-8d2e-405b-bd45-333fb37b32a9,032e2b8f-9d1c-4b26-ad34-6db820bdf4b6}', '{}'::text[], '{attempt_messages}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('15545b61-5043-4f3c-9dd0-23980b6b7d19', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('15545b61-5043-4f3c-9dd0-23980b6b7d19', '8157ae48-852d-4ba1-a0f0-5c4598baef36', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('15545b61-5043-4f3c-9dd0-23980b6b7d19', 'a8e66212-0f19-4a83-8ff5-766ca6aca0e8', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('15545b61-5043-4f3c-9dd0-23980b6b7d19', 'e71d8da3-5058-4a5a-a721-e628d042f1bb', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('15545b61-5043-4f3c-9dd0-23980b6b7d19', '887b8a34-f85b-4a09-9f04-e6f7aaac670c', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('15545b61-5043-4f3c-9dd0-23980b6b7d19', 'e4dc259e-55eb-4c6e-be2b-2b7eebe4c9c3', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('15545b61-5043-4f3c-9dd0-23980b6b7d19', 'f1b8d23a-00e7-4649-b4a7-a87e367c895f', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('15545b61-5043-4f3c-9dd0-23980b6b7d19', '0a025758-b2e5-4843-8204-9e7e5e8cffc6', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('15545b61-5043-4f3c-9dd0-23980b6b7d19', '3ae54980-8d2e-405b-bd45-333fb37b32a9', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('15545b61-5043-4f3c-9dd0-23980b6b7d19', '032e2b8f-9d1c-4b26-ad34-6db820bdf4b6', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('15545b61-5043-4f3c-9dd0-23980b6b7d19', '61b58540-2997-4290-8243-f037038a09e2', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('15545b61-5043-4f3c-9dd0-23980b6b7d19', '40d4097f-8a82-4d26-9377-0ec1d5b245af', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('15545b61-5043-4f3c-9dd0-23980b6b7d19', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('15545b61-5043-4f3c-9dd0-23980b6b7d19', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('15545b61-5043-4f3c-9dd0-23980b6b7d19', 'b7af309c-dc7d-4122-b9ab-7a88bc71ce3c', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('15545b61-5043-4f3c-9dd0-23980b6b7d19', 'fe98c532-d630-4f38-b3a0-489801b4df41', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
