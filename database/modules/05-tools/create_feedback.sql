-- Module: create_feedback
-- Category: tool
-- Description: create_feedback MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019c16d8-a123-7f0c-8e49-144fd344a1e3', 'feedback_grade_id', 'The ID of the grade to add feedback to', 'string', true, '', '2026-02-01T01:37:01.720364+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-79b9-92c0-f6671077ec90', '019c16d8-a123-7f0c-8e49-144fd344a1e3', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019c16d8-a123-7f65-ace0-006c414bed9c', 'feedback_text', 'The feedback text', 'string', true, '', '2026-02-01T01:37:01.720364+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-79bc-909c-57f6a594e374', '019c16d8-a123-7f65-ace0-006c414bed9c', 1, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019c16d8-a123-7f93-b0ed-eccc63b7067c', 'feedback_total', 'The total score', 'number', true, '', '2026-02-01T01:37:01.720364+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-79c3-ad39-0aec589ee2e8', '019c16d8-a123-7f93-b0ed-eccc63b7067c', 2, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019c24ff-49ec-7d9d-94b3-4935c374ee23', '019c16d8-a123-7f0c-8e49-144fd344a1e3', 'grade_id', '{{ feedback_grade_id }}', '2026-02-03T19:33:56.326236+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019c24ff-49ed-72ca-b5bf-2e3e55e3844d', '019c16d8-a123-7f65-ace0-006c414bed9c', 'feedback', '{{ feedback_text }}', '2026-02-03T19:33:56.326236+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019c24ff-49ed-752a-b110-0827ea43d37c', '019c16d8-a123-7f93-b0ed-eccc63b7067c', 'total', '{{ feedback_total }}', '2026-02-03T19:33:56.326236+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c16d8-a126-7433-8d42-692180a7ea4a', 'Create feedback for a grade in the simulation', '2026-02-01T01:37:01.720364+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a2e-79b9-85e5-ef4376a017e1', 'create_feedback', '2025-12-29T19:41:03.614243+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource, entry, artifact) VALUES ('019bebc4-d436-7ba4-963e-758c7971447d', '2026-01-17T17:58:56.053417+00:00', false, false, true, 'create_feedback', 'Create a grade for the conversation on a specific standard group. Score should be an integer from 1-5 based on the rubric criteria. Provide brief feedback explaining the score with specific examples.', '{}', true, '{019c16d8-a123-7f0c-8e49-144fd344a1e3,019c16d8-a123-7f65-ace0-006c414bed9c,019c16d8-a123-7f93-b0ed-eccc63b7067c}', '{019c24ff-49ec-7d9d-94b3-4935c374ee23,019c24ff-49ed-72ca-b5bf-2e3e55e3844d,019c24ff-49ed-752a-b110-0827ea43d37c}', NULL, 'feedbacks', NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c16d8-a126-715d-9699-0140b7afddad', '2026-02-01T01:37:01.720364+00:00', '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c16d8-a126-715d-9699-0140b7afddad', '019c4e6b-2c29-79b9-92c0-f6671077ec90', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c16d8-a126-715d-9699-0140b7afddad', '019c4e6b-2c29-79bc-909c-57f6a594e374', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c16d8-a126-715d-9699-0140b7afddad', '019c4e6b-2c29-79c3-ad39-0aec589ee2e8', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a126-715d-9699-0140b7afddad', '019c16d8-a123-7f0c-8e49-144fd344a1e3', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a126-715d-9699-0140b7afddad', '019c16d8-a123-7f65-ace0-006c414bed9c', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a126-715d-9699-0140b7afddad', '019c16d8-a123-7f93-b0ed-eccc63b7067c', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a126-715d-9699-0140b7afddad', '019c24ff-49ec-7d9d-94b3-4935c374ee23', '2026-02-03T19:33:56.326236+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a126-715d-9699-0140b7afddad', '019c24ff-49ed-72ca-b5bf-2e3e55e3844d', '2026-02-03T19:33:56.326236+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a126-715d-9699-0140b7afddad', '019c24ff-49ed-752a-b110-0827ea43d37c', '2026-02-03T19:33:56.326236+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('019c16d8-a126-715d-9699-0140b7afddad', 'a0647fd3-bedd-4e72-8d96-4c7e76e9e602', true, '2026-02-19T14:14:23.735542+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019c16d8-a126-715d-9699-0140b7afddad', '019c16d8-a126-7433-8d42-692180a7ea4a', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c16d8-a126-715d-9699-0140b7afddad', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c16d8-a126-715d-9699-0140b7afddad', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c16d8-a126-715d-9699-0140b7afddad', '019bbabc-5a2e-79b9-85e5-ef4376a017e1', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c16d8-a126-715d-9699-0140b7afddad', '019bebc4-d436-7ba4-963e-758c7971447d', true, '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
