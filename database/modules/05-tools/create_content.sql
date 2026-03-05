-- Module: create_content
-- Category: tool
-- Description: create_content MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-768f-9c96-37941363873a', 'content', 'The text content of the assistant response message', 'string', true, '', '2026-01-06T15:55:22.222790+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-79a5-9fbb-75fc27332236', '019bbf87-091e-768f-9c96-37941363873a', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019c0a2d-fc3b-7e62-bcb0-75124c777dcd', 'persona_id', 'The personas_entry_id of the persona speaking (see Personas section in context above for available persona_id values)', 'string', true, '', '2026-01-29T14:35:11.795021+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-79aa-90b2-d0166aa97470', '019c0a2d-fc3b-7e62-bcb0-75124c777dcd', 1, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-7a33-aa90-781a6dc10b10', 'message_id', 'The assistant message ID from the Current Assistant Message context above', 'string', true, '', '2026-01-08T04:35:07.612931+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-79ac-ace0-bc8ed56f4425', '019bbf87-091e-7a33-aa90-781a6dc10b10', 2, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-096a-76f9-8b4d-4516886a1626', '019bbf87-091e-7a33-aa90-781a6dc10b10', 'message_id', '{{ message_id }}', '2026-01-08T04:35:07.612931+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0966-7327-b2a1-f5fbde584a12', '019bbf87-091e-768f-9c96-37941363873a', 'content', '{{ content }}', '2026-01-06T15:55:22.222222+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019c26f6-fecc-7f2a-a62f-d5fe00b4837e', '019c0a2d-fc3b-7e62-bcb0-75124c777dcd', 'persona_id', '{{ persona_id }}', '2026-02-04T04:44:07.231669+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c16d8-a11f-7e44-971a-0effdcbb56a8', 'Create a content block for a message in the simulation', '2026-02-01T01:37:01.720364+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a33-72b9-961a-a389f7bc9bc6', 'create_content', '2025-12-22T23:03:23.445951+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('019bebc4-d436-7b60-9f57-f7c03f636fac', '2026-01-17T17:57:40.541181+00:00', false, false, true, 'create_content', 'Make a persona speak by calling this tool with the persona_id (personas_entry_id from the Personas context) and the message content.', '{}', 'create', '{019bbf87-091e-7a33-aa90-781a6dc10b10,019bbf87-091e-768f-9c96-37941363873a,019c0a2d-fc3b-7e62-bcb0-75124c777dcd}', '{019bbf87-096a-76f9-8b4d-4516886a1626,019bbf87-0966-7327-b2a1-f5fbde584a12,019c26f6-fecc-7f2a-a62f-d5fe00b4837e}', '{}'::text[], '{contents}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c16d8-a11e-776a-9db7-908c92e97660', '2026-02-01T01:37:01.720364+00:00', '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c16d8-a11e-776a-9db7-908c92e97660', '019c4e6b-2c29-79a5-9fbb-75fc27332236', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c16d8-a11e-776a-9db7-908c92e97660', '019c4e6b-2c29-79aa-90b2-d0166aa97470', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c16d8-a11e-776a-9db7-908c92e97660', '019c4e6b-2c29-79ac-ace0-bc8ed56f4425', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a11e-776a-9db7-908c92e97660', '019bbf87-091e-7a33-aa90-781a6dc10b10', '2026-02-04T03:14:18.138015+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a11e-776a-9db7-908c92e97660', '019bbf87-091e-768f-9c96-37941363873a', '2026-02-04T03:14:18.138015+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a11e-776a-9db7-908c92e97660', '019c0a2d-fc3b-7e62-bcb0-75124c777dcd', '2026-02-04T04:44:07.231669+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a11e-776a-9db7-908c92e97660', '019bbf87-096a-76f9-8b4d-4516886a1626', '2026-02-04T03:14:18.138015+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a11e-776a-9db7-908c92e97660', '019bbf87-0966-7327-b2a1-f5fbde584a12', '2026-02-04T03:14:18.138015+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a11e-776a-9db7-908c92e97660', '019c26f6-fecc-7f2a-a62f-d5fe00b4837e', '2026-02-04T04:44:07.231669+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('019c16d8-a11e-776a-9db7-908c92e97660', 'd13d22c6-10af-40c1-8bad-82ad27625f0b', true, '2026-02-19T14:14:23.730665+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019c16d8-a11e-776a-9db7-908c92e97660', '019c16d8-a11f-7e44-971a-0effdcbb56a8', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('019c16d8-a11e-776a-9db7-908c92e97660', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('019c16d8-a11e-776a-9db7-908c92e97660', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c16d8-a11e-776a-9db7-908c92e97660', '019bbabc-5a33-72b9-961a-a389f7bc9bc6', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c16d8-a11e-776a-9db7-908c92e97660', '019bebc4-d436-7b60-9f57-f7c03f636fac', true, '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
