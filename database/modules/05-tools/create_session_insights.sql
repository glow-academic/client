-- Module: create_session_insights
-- Category: tool
-- Description: create_session_insights MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('86079edf-1a2f-46ce-93e7-165564b55296', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('1fb9505b-a37e-4948-bd2d-dadc874a389f', '86079edf-1a2f-46ce-93e7-165564b55296', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('72124e64-f26c-4405-82f4-08ed53bcef53', '86079edf-1a2f-46ce-93e7-165564b55296', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('8d40ad26-c483-40a0-ba62-4bf2cb9b9756', 'group_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('f4ef7784-ab8d-43ee-98d3-0b51662927d9', '8d40ad26-c483-40a0-ba62-4bf2cb9b9756', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('5ea9815c-db50-4723-a8ad-b624768ca11f', '8d40ad26-c483-40a0-ba62-4bf2cb9b9756', 'group_id', '{{ group_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('82e2a621-74e8-4d74-811e-280edc254fa6', 'content', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('bec4d99f-ad5a-43e6-8604-3d11e6939b2f', '82e2a621-74e8-4d74-811e-280edc254fa6', 2, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('a4bc72af-a71d-4a15-adb6-dd5a9e50bc10', '82e2a621-74e8-4d74-811e-280edc254fa6', 'content', '{{ content }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('6bbc0926-c807-4404-bdb1-967af296e8f0', 'Create a new session insights entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('f3df4f01-79a4-4d4f-bed3-d73849e88e31', 'create_session_insights', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('9fe45f05-bac6-4d88-9f3a-a767fcf41208', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_session_insights', 'Create a new session insights entry', '{}', 'create', '{86079edf-1a2f-46ce-93e7-165564b55296,8d40ad26-c483-40a0-ba62-4bf2cb9b9756,82e2a621-74e8-4d74-811e-280edc254fa6}', '{72124e64-f26c-4405-82f4-08ed53bcef53,5ea9815c-db50-4723-a8ad-b624768ca11f,a4bc72af-a71d-4a15-adb6-dd5a9e50bc10}', '{}'::text[], '{session_insights}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('ad267cd5-dc38-428f-8fed-937ffe636183', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('ad267cd5-dc38-428f-8fed-937ffe636183', '1fb9505b-a37e-4948-bd2d-dadc874a389f', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('ad267cd5-dc38-428f-8fed-937ffe636183', 'f4ef7784-ab8d-43ee-98d3-0b51662927d9', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('ad267cd5-dc38-428f-8fed-937ffe636183', 'bec4d99f-ad5a-43e6-8604-3d11e6939b2f', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('ad267cd5-dc38-428f-8fed-937ffe636183', '86079edf-1a2f-46ce-93e7-165564b55296', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('ad267cd5-dc38-428f-8fed-937ffe636183', '8d40ad26-c483-40a0-ba62-4bf2cb9b9756', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('ad267cd5-dc38-428f-8fed-937ffe636183', '82e2a621-74e8-4d74-811e-280edc254fa6', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('ad267cd5-dc38-428f-8fed-937ffe636183', '72124e64-f26c-4405-82f4-08ed53bcef53', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('ad267cd5-dc38-428f-8fed-937ffe636183', '5ea9815c-db50-4723-a8ad-b624768ca11f', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('ad267cd5-dc38-428f-8fed-937ffe636183', 'a4bc72af-a71d-4a15-adb6-dd5a9e50bc10', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('ad267cd5-dc38-428f-8fed-937ffe636183', '018f0004-0001-7000-8000-00000000000c', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('ad267cd5-dc38-428f-8fed-937ffe636183', '6bbc0926-c807-4404-bdb1-967af296e8f0', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('ad267cd5-dc38-428f-8fed-937ffe636183', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('ad267cd5-dc38-428f-8fed-937ffe636183', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('ad267cd5-dc38-428f-8fed-937ffe636183', 'f3df4f01-79a4-4d4f-bed3-d73849e88e31', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('ad267cd5-dc38-428f-8fed-937ffe636183', '9fe45f05-bac6-4d88-9f3a-a767fcf41208', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
