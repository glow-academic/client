-- Module: create_test_archive
-- Category: tool
-- Description: create_test_archive MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('46998f52-b528-40e5-b5f6-c3792ced9186', 'test_archives', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('34495b11-3b2d-4682-b837-406c7e141ac0', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('e7d7deaa-650b-47ee-9298-eaa8876e7a3d', '34495b11-3b2d-4682-b837-406c7e141ac0', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('076d2734-9be6-4656-b8c7-0635b76ed3a3', '34495b11-3b2d-4682-b837-406c7e141ac0', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('e1e1bba1-2a8f-4673-81fe-f5972271b6c4', 'test_id', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('aa1b2b77-bce9-4e60-9970-7e4ba87f3567', 'e1e1bba1-2a8f-4673-81fe-f5972271b6c4', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('b4e53693-c4e1-4bd3-9ab3-e7929b483192', 'e1e1bba1-2a8f-4673-81fe-f5972271b6c4', 'test_id', '{{ test_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('907c735c-3755-4556-8ff9-79e0d2940bcb', 'archived', '', 'boolean', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('d3751883-e45e-41fd-b278-1b6bf4aa8509', '907c735c-3755-4556-8ff9-79e0d2940bcb', 2, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('c0a27cdf-bb75-4741-b9e0-a352d3087a3a', '907c735c-3755-4556-8ff9-79e0d2940bcb', 'archived', '{{ archived }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('2c99a623-6001-41db-a731-18298c9e8927', 'Create a new test archive entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('71534db2-7d18-4f7e-97cf-32b0c6ba2c71', 'create_test_archive', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('9f3fbfb5-101a-4542-b26f-4602aba706d3', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_test_archive', 'Create a new test archive entry', '{}', 'create', '{34495b11-3b2d-4682-b837-406c7e141ac0,e1e1bba1-2a8f-4673-81fe-f5972271b6c4,907c735c-3755-4556-8ff9-79e0d2940bcb}', '{076d2734-9be6-4656-b8c7-0635b76ed3a3,b4e53693-c4e1-4bd3-9ab3-e7929b483192,c0a27cdf-bb75-4741-b9e0-a352d3087a3a}', '{}'::text[], '{test_archives}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('77126e2c-2714-4256-8d90-b965c6b4e19a', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('77126e2c-2714-4256-8d90-b965c6b4e19a', 'e7d7deaa-650b-47ee-9298-eaa8876e7a3d', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('77126e2c-2714-4256-8d90-b965c6b4e19a', 'aa1b2b77-bce9-4e60-9970-7e4ba87f3567', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('77126e2c-2714-4256-8d90-b965c6b4e19a', 'd3751883-e45e-41fd-b278-1b6bf4aa8509', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('77126e2c-2714-4256-8d90-b965c6b4e19a', '34495b11-3b2d-4682-b837-406c7e141ac0', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('77126e2c-2714-4256-8d90-b965c6b4e19a', 'e1e1bba1-2a8f-4673-81fe-f5972271b6c4', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('77126e2c-2714-4256-8d90-b965c6b4e19a', '907c735c-3755-4556-8ff9-79e0d2940bcb', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('77126e2c-2714-4256-8d90-b965c6b4e19a', '076d2734-9be6-4656-b8c7-0635b76ed3a3', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('77126e2c-2714-4256-8d90-b965c6b4e19a', 'b4e53693-c4e1-4bd3-9ab3-e7929b483192', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('77126e2c-2714-4256-8d90-b965c6b4e19a', 'c0a27cdf-bb75-4741-b9e0-a352d3087a3a', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entries_id, active, created_at, generated, mcp) VALUES ('77126e2c-2714-4256-8d90-b965c6b4e19a', '46998f52-b528-40e5-b5f6-c3792ced9186', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entries_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, descriptions_id, created_at, generated, mcp, active) VALUES ('77126e2c-2714-4256-8d90-b965c6b4e19a', '2c99a623-6001-41db-a731-18298c9e8927', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, descriptions_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flags_id, created_at, generated, mcp, active) VALUES ('77126e2c-2714-4256-8d90-b965c6b4e19a', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flags_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operations_id, created_at, active, generated, mcp) VALUES ('77126e2c-2714-4256-8d90-b965c6b4e19a', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operations_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, names_id, created_at, generated, mcp, active) VALUES ('77126e2c-2714-4256-8d90-b965c6b4e19a', '71534db2-7d18-4f7e-97cf-32b0c6ba2c71', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, names_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('77126e2c-2714-4256-8d90-b965c6b4e19a', '9f3fbfb5-101a-4542-b26f-4602aba706d3', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
