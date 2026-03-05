-- Module: create_options
-- Category: tool
-- Description: create_options MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-7799-8255-23920ae8e5d4', 'option_text', '', 'string', true, '', '2026-01-06T15:55:22.215511+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-76f8-95f8-79d588e32b5b', '019bbf87-091e-7799-8255-23920ae8e5d4', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-77b5-92b4-feb05ac43179', 'is_correct', '', 'boolean', true, '', '2026-01-06T15:55:22.215511+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-76ff-a92c-aab9bacc7086', '019bbf87-091e-77b5-92b4-feb05ac43179', 1, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0969-730a-a621-2bf047d7f1ac', '019bbf87-091e-7799-8255-23920ae8e5d4', 'option_text', '', '2026-01-06T15:55:22.215511+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0969-73a6-b096-1b124b50944a', '019bbf87-091e-77b5-92b4-feb05ac43179', 'is_correct', '', '2026-01-06T15:55:22.215511+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-75f6-a1d1-b118a72f3b90', 'Create options for questions. Options can be reused across multiple questions.', '2026-01-06T03:14:37.673953+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-756c-b920-779fb0231d5f', 'create_options', '2026-01-06T03:14:37.673953+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('019bebc4-d436-7bd2-b670-e4c1b24b1a9c', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_options', 'Create options for questions. Options can be reused across multiple questions.', '{}', 'create', '{019bbf87-091e-77b5-92b4-feb05ac43179,019bbf87-091e-7799-8255-23920ae8e5d4}', '{019bbf87-0969-730a-a621-2bf047d7f1ac,019bbf87-0969-73a6-b096-1b124b50944a}', '{options}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b914c-a3ea-713a-887e-99bcbfb9559a', '2026-01-06T03:14:37.673953+00:00', '2026-01-06T03:14:37.673953+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019b914c-a3ea-713a-887e-99bcbfb9559a', '019c4e6b-2c29-76f8-95f8-79d588e32b5b', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019b914c-a3ea-713a-887e-99bcbfb9559a', '019c4e6b-2c29-76ff-a92c-aab9bacc7086', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b914c-a3ea-713a-887e-99bcbfb9559a', '019bbf87-091e-77b5-92b4-feb05ac43179', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b914c-a3ea-713a-887e-99bcbfb9559a', '019bbf87-091e-7799-8255-23920ae8e5d4', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b914c-a3ea-713a-887e-99bcbfb9559a', '019bbf87-0969-730a-a621-2bf047d7f1ac', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b914c-a3ea-713a-887e-99bcbfb9559a', '019bbf87-0969-73a6-b096-1b124b50944a', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b914c-a3ea-713a-887e-99bcbfb9559a', '019bbabc-5a2f-75f6-a1d1-b118a72f3b90', '2026-01-06T03:14:37.673953+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_resources_junction
INSERT INTO public.tool_resources_junction (tool_id, resource_id, active, created_at, generated, mcp) VALUES ('019b914c-a3ea-713a-887e-99bcbfb9559a', '019bbeb4-5112-71e5-8c71-64f004201157', true, '2026-01-06T03:14:37.673953+00:00', false, false) ON CONFLICT (tool_id, resource_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('019b914c-a3ea-713a-887e-99bcbfb9559a', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-01-06T03:14:37.673953+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('019b914c-a3ea-713a-887e-99bcbfb9559a', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b914c-a3ea-713a-887e-99bcbfb9559a', '019bbabc-5a2f-756c-b920-779fb0231d5f', '2026-01-06T03:14:37.673953+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b914c-a3ea-713a-887e-99bcbfb9559a', '019bebc4-d436-7bd2-b670-e4c1b24b1a9c', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
