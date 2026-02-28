-- Module: create_attempt_message
-- Category: tool
-- Description: create_attempt_message MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('da45ea09-e8a8-4fd3-b405-6041eb58319b', 'attempt_messages', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('9a3ac922-2e73-45e7-9b11-41ef28ecf7d6', 'chat_id', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('96cc4850-dacf-44ce-8afb-3529dc4384eb', '9a3ac922-2e73-45e7-9b11-41ef28ecf7d6', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('bb17086f-ad8f-4d8d-87d3-9e35546c0db7', '9a3ac922-2e73-45e7-9b11-41ef28ecf7d6', 'chat_id', '{{ chat_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('eaa3d6c0-6a80-4104-8ca5-cd4335c722c6', 'message_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('fb71a22c-2791-46ad-b92c-b1373f7194e0', 'eaa3d6c0-6a80-4104-8ca5-cd4335c722c6', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('59cc4aba-681c-4d57-985c-e2b7d143cb82', 'eaa3d6c0-6a80-4104-8ca5-cd4335c722c6', 'message_id', '{{ message_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('0af3d096-8f86-4bd4-b5a6-a11fa88c3ed6', 'Create a new attempt message entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('38913c8c-19d3-4dec-8499-0fe13969868b', 'create_attempt_message', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('581216a3-1503-47fc-acbb-9744bcb43042', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_attempt_message', 'Create a new attempt message entry', '{}', 'create', '{9a3ac922-2e73-45e7-9b11-41ef28ecf7d6,eaa3d6c0-6a80-4104-8ca5-cd4335c722c6}', '{bb17086f-ad8f-4d8d-87d3-9e35546c0db7,59cc4aba-681c-4d57-985c-e2b7d143cb82}', '{}'::text[], '{attempt_messages}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('071af978-0cda-43a3-953b-b028713a2f54', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('071af978-0cda-43a3-953b-b028713a2f54', '96cc4850-dacf-44ce-8afb-3529dc4384eb', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('071af978-0cda-43a3-953b-b028713a2f54', 'fb71a22c-2791-46ad-b92c-b1373f7194e0', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('071af978-0cda-43a3-953b-b028713a2f54', '9a3ac922-2e73-45e7-9b11-41ef28ecf7d6', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('071af978-0cda-43a3-953b-b028713a2f54', 'eaa3d6c0-6a80-4104-8ca5-cd4335c722c6', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('071af978-0cda-43a3-953b-b028713a2f54', 'bb17086f-ad8f-4d8d-87d3-9e35546c0db7', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('071af978-0cda-43a3-953b-b028713a2f54', '59cc4aba-681c-4d57-985c-e2b7d143cb82', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('071af978-0cda-43a3-953b-b028713a2f54', 'da45ea09-e8a8-4fd3-b405-6041eb58319b', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('071af978-0cda-43a3-953b-b028713a2f54', '0af3d096-8f86-4bd4-b5a6-a11fa88c3ed6', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('071af978-0cda-43a3-953b-b028713a2f54', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('071af978-0cda-43a3-953b-b028713a2f54', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('071af978-0cda-43a3-953b-b028713a2f54', '38913c8c-19d3-4dec-8499-0fe13969868b', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('071af978-0cda-43a3-953b-b028713a2f54', '581216a3-1503-47fc-acbb-9744bcb43042', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
