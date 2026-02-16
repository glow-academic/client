-- Module: create_question
-- Category: tool
-- Description: create_question MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-714c-996e-354ec1bfe55c', 'question_text', '', 'string', true, '', '2026-01-05T00:28:02.003807+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-76c3-a524-05e8bbed47b4', '019bbf87-091e-714c-996e-354ec1bfe55c', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-780f-bf1c-471c78396711', 'allow_multiple', '', 'boolean', true, '', '2026-01-06T15:55:22.215511+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-76c5-8440-220cb3b32a1c', '019bbf87-091e-780f-bf1c-471c78396711', 1, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-782d-a354-e241b501acf0', 'time', '', 'number', true, '', '2026-01-06T15:55:22.215511+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-76ca-a75f-8e1a0bbd3b10', '019bbf87-091e-782d-a354-e241b501acf0', 2, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0966-75d9-9f22-1a7168fe0cda', '019bbf87-091e-714c-996e-354ec1bfe55c', 'question_text', '{{ question_text }}', '2026-01-06T15:55:22.215511+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0966-767c-98b2-9124ff0b40cb', '019bbf87-091e-780f-bf1c-471c78396711', 'allow_multiple', '{{ allow_multiple }}', '2026-01-06T15:55:22.215511+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0966-771d-b1fd-cd7999e7fa59', '019bbf87-091e-782d-a354-e241b501acf0', 'time', '{{ question_timestamp }}', '2026-01-06T15:55:22.215511+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-77e1-8793-470ee1640456', 'Create a question for this scenario. Call this tool multiple times to create multiple questions. Each question should have question_text, allow_multiple (bool), and options (list of dicts with option_text, type, is_correct).', '2025-12-29T19:41:03.614243+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-775a-a1ae-0812ed786ea0', 'create_question', '2025-12-29T19:41:03.614243+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids) VALUES ('019bebc4-d436-7b9b-b92c-009fbdb67144', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_question', 'Create a question for this scenario. Call this tool multiple times to create multiple questions. Each question should have question_text, allow_multiple (bool), and options (list of dicts with option_text, type, is_correct).', '{}', false, '{019bbf87-091e-714c-996e-354ec1bfe55c,019bbf87-091e-782d-a354-e241b501acf0,019bbf87-091e-780f-bf1c-471c78396711}', '{019bbf87-0966-75d9-9f22-1a7168fe0cda,019bbf87-0966-767c-98b2-9124ff0b40cb,019bbf87-0966-771d-b1fd-cd7999e7fa59}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b6ba0-df00-7ee6-bc44-ff4838882638', '2025-12-29T19:41:03.614243+00:00', '2025-12-30T15:04:40.818969+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019b6ba0-df00-7ee6-bc44-ff4838882638', '019c4e6b-2c29-76c3-a524-05e8bbed47b4', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019b6ba0-df00-7ee6-bc44-ff4838882638', '019c4e6b-2c29-76c5-8440-220cb3b32a1c', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019b6ba0-df00-7ee6-bc44-ff4838882638', '019c4e6b-2c29-76ca-a75f-8e1a0bbd3b10', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7ee6-bc44-ff4838882638', '019bbf87-091e-714c-996e-354ec1bfe55c', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7ee6-bc44-ff4838882638', '019bbf87-091e-782d-a354-e241b501acf0', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7ee6-bc44-ff4838882638', '019bbf87-091e-780f-bf1c-471c78396711', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7ee6-bc44-ff4838882638', '019bbf87-0966-75d9-9f22-1a7168fe0cda', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7ee6-bc44-ff4838882638', '019bbf87-0966-767c-98b2-9124ff0b40cb', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7ee6-bc44-ff4838882638', '019bbf87-0966-771d-b1fd-cd7999e7fa59', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7ee6-bc44-ff4838882638', '019bbabc-5a2f-77e1-8793-470ee1640456', '2025-12-29T19:41:03.614243+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b6ba0-df00-7ee6-bc44-ff4838882638', '019bbeb4-5113-75c6-a321-30581b6e8b9c', true, '2025-12-29T19:41:03.614243+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7ee6-bc44-ff4838882638', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2025-12-29T19:41:03.614243+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7ee6-bc44-ff4838882638', '019bbabc-5a2f-775a-a1ae-0812ed786ea0', '2025-12-29T19:41:03.614243+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b6ba0-df00-7ee6-bc44-ff4838882638', '019bebc4-d436-7b9b-b92c-009fbdb67144', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
