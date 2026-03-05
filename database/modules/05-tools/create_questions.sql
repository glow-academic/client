-- Module: create_questions
-- Category: tool
-- Description: create_questions MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-714c-996e-354ec1bfe55c', 'question_text', '', 'string', true, '', '2026-01-05T00:28:02.003807+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('b778e92a-792f-4d50-8a4c-7bc27243a31b', '019bbf87-091e-714c-996e-354ec1bfe55c', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-780f-bf1c-471c78396711', 'allow_multiple', '', 'boolean', true, '', '2026-01-06T15:55:22.215511+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('6d239dff-450a-413f-b6b6-5236ad692079', '019bbf87-091e-780f-bf1c-471c78396711', 1, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-782d-a354-e241b501acf0', 'time', '', 'number', true, '', '2026-01-06T15:55:22.215511+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('2a52e82a-0faa-4d9f-bcb1-6e9b8afd7f8e', '019bbf87-091e-782d-a354-e241b501acf0', 2, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0966-75d9-9f22-1a7168fe0cda', '019bbf87-091e-714c-996e-354ec1bfe55c', 'question_text', '{{ question_text }}', '2026-01-06T15:55:22.215511+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0966-767c-98b2-9124ff0b40cb', '019bbf87-091e-780f-bf1c-471c78396711', 'allow_multiple', '{{ allow_multiple }}', '2026-01-06T15:55:22.215511+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0966-771d-b1fd-cd7999e7fa59', '019bbf87-091e-782d-a354-e241b501acf0', 'time', '{{ question_timestamp }}', '2026-01-06T15:55:22.215511+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d88-7788-b139-d954cfde80cb', 'Create a new questions resource', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d88-76fe-aa46-7e76c96097aa', 'create_questions', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('a51d1d18-44d9-4fd3-a7d3-3db17b652d02', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'create_questions', 'Create a new question resource', '{}', 'create', '{019bbf87-091e-714c-996e-354ec1bfe55c,019bbf87-091e-780f-bf1c-471c78396711,019bbf87-091e-782d-a354-e241b501acf0}', '{019bbf87-0966-75d9-9f22-1a7168fe0cda,019bbf87-0966-767c-98b2-9124ff0b40cb,019bbf87-0966-771d-b1fd-cd7999e7fa59}', '{}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('7113af6e-72ca-4d4c-80bc-75371658a3ad', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('7113af6e-72ca-4d4c-80bc-75371658a3ad', 'b778e92a-792f-4d50-8a4c-7bc27243a31b', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('7113af6e-72ca-4d4c-80bc-75371658a3ad', '6d239dff-450a-413f-b6b6-5236ad692079', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('7113af6e-72ca-4d4c-80bc-75371658a3ad', '2a52e82a-0faa-4d9f-bcb1-6e9b8afd7f8e', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('7113af6e-72ca-4d4c-80bc-75371658a3ad', '019bbf87-091e-714c-996e-354ec1bfe55c', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('7113af6e-72ca-4d4c-80bc-75371658a3ad', '019bbf87-091e-780f-bf1c-471c78396711', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('7113af6e-72ca-4d4c-80bc-75371658a3ad', '019bbf87-091e-782d-a354-e241b501acf0', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('7113af6e-72ca-4d4c-80bc-75371658a3ad', '019bbf87-0966-75d9-9f22-1a7168fe0cda', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('7113af6e-72ca-4d4c-80bc-75371658a3ad', '019bbf87-0966-767c-98b2-9124ff0b40cb', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('7113af6e-72ca-4d4c-80bc-75371658a3ad', '019bbf87-0966-771d-b1fd-cd7999e7fa59', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('7113af6e-72ca-4d4c-80bc-75371658a3ad', '019c82b8-5d88-7788-b139-d954cfde80cb', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('7113af6e-72ca-4d4c-80bc-75371658a3ad', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('7113af6e-72ca-4d4c-80bc-75371658a3ad', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('7113af6e-72ca-4d4c-80bc-75371658a3ad', '019c82b8-5d88-76fe-aa46-7e76c96097aa', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('7113af6e-72ca-4d4c-80bc-75371658a3ad', 'a51d1d18-44d9-4fd3-a7d3-3db17b652d02', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
