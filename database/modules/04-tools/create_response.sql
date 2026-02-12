-- Module: create_response
-- Category: tool
-- Description: create_response MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7700-a698-1cfe1914f23c', '019bbf87-091e-784e-8a7c-562ef0c4725d', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7707-8fbf-e57e1544c5ea', '019bbf87-091e-786e-bbff-3e50b51a7cd1', 1, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-78e7-b6f3-3662dd69cf19', 'Create a response linking a question to an option. Responses represent user selections in quizzes.', '2026-01-06T03:53:12.392779+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-7858-8b1a-51d774212a65', 'create_response', '2026-01-06T03:53:12.392779+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7bd9-a072-6590e24dbc21', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_response', 'Create a response linking a question to an option. Responses represent user selections in quizzes.', '{}', false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b916f-f5c8-7e4e-8412-3e3fb1a9ce5c', '2026-01-06T03:53:12.392779+00:00', '2026-01-06T03:53:12.392779+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019b916f-f5c8-7e4e-8412-3e3fb1a9ce5c', '019c4e6b-2c29-7700-a698-1cfe1914f23c', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019b916f-f5c8-7e4e-8412-3e3fb1a9ce5c', '019c4e6b-2c29-7707-8fbf-e57e1544c5ea', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b916f-f5c8-7e4e-8412-3e3fb1a9ce5c', '019bbf87-091e-784e-8a7c-562ef0c4725d', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b916f-f5c8-7e4e-8412-3e3fb1a9ce5c', '019bbf87-091e-786e-bbff-3e50b51a7cd1', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b916f-f5c8-7e4e-8412-3e3fb1a9ce5c', '019bbf87-0968-7995-8f2b-285611270c53', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b916f-f5c8-7e4e-8412-3e3fb1a9ce5c', '019bbf87-0968-7a39-8b5d-8ab0e285f6f6', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b916f-f5c8-7e4e-8412-3e3fb1a9ce5c', '019bbabc-5a2f-78e7-b6f3-3662dd69cf19', '2026-01-06T03:53:12.392779+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b916f-f5c8-7e4e-8412-3e3fb1a9ce5c', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-06T03:53:12.392779+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b916f-f5c8-7e4e-8412-3e3fb1a9ce5c', '019bbabc-5a2f-7858-8b1a-51d774212a65', '2026-01-06T03:53:12.392779+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b916f-f5c8-7e4e-8412-3e3fb1a9ce5c', '019bebc4-d436-7bd9-a072-6590e24dbc21', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
