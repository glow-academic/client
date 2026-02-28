-- Module: create_test_insights
-- Category: tool
-- Description: create_test_insights MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('555ea35e-c5b6-4f77-9ffd-afdf1fe3658b', 'group_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('f79f0d37-09b4-4a97-a780-51d422b905df', '555ea35e-c5b6-4f77-9ffd-afdf1fe3658b', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('6b4bc49f-70c8-4b4e-aaad-05220a901991', '555ea35e-c5b6-4f77-9ffd-afdf1fe3658b', 'group_id', '{{ group_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('c351b34a-2036-418c-baba-774846357728', 'content', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('b1a19a8e-6cef-4f26-84fa-484cc27bd8e7', 'c351b34a-2036-418c-baba-774846357728', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('dd813685-591a-4917-acb7-0df5670abf9a', 'c351b34a-2036-418c-baba-774846357728', 'content', '{{ content }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('a063dade-9eef-4ca5-91ee-92c711425d2b', 'Create a new test insights entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('691bfcef-1060-404b-97e6-b55fd1ee5c09', 'create_test_insights', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('0eda1584-6b13-4623-8058-7ca31f5d5a56', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_test_insights', 'Create a new test insights entry', '{}', 'create', '{555ea35e-c5b6-4f77-9ffd-afdf1fe3658b,c351b34a-2036-418c-baba-774846357728}', '{6b4bc49f-70c8-4b4e-aaad-05220a901991,dd813685-591a-4917-acb7-0df5670abf9a}', '{}'::text[], '{test_insights}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('c1f211ae-c023-426f-a163-797ce4f09b2f', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('c1f211ae-c023-426f-a163-797ce4f09b2f', 'f79f0d37-09b4-4a97-a780-51d422b905df', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('c1f211ae-c023-426f-a163-797ce4f09b2f', 'b1a19a8e-6cef-4f26-84fa-484cc27bd8e7', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('c1f211ae-c023-426f-a163-797ce4f09b2f', '555ea35e-c5b6-4f77-9ffd-afdf1fe3658b', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('c1f211ae-c023-426f-a163-797ce4f09b2f', 'c351b34a-2036-418c-baba-774846357728', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('c1f211ae-c023-426f-a163-797ce4f09b2f', '6b4bc49f-70c8-4b4e-aaad-05220a901991', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('c1f211ae-c023-426f-a163-797ce4f09b2f', 'dd813685-591a-4917-acb7-0df5670abf9a', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('c1f211ae-c023-426f-a163-797ce4f09b2f', '018f0004-0001-7000-8000-00000000000d', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('c1f211ae-c023-426f-a163-797ce4f09b2f', 'a063dade-9eef-4ca5-91ee-92c711425d2b', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('c1f211ae-c023-426f-a163-797ce4f09b2f', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('c1f211ae-c023-426f-a163-797ce4f09b2f', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('c1f211ae-c023-426f-a163-797ce4f09b2f', '691bfcef-1060-404b-97e6-b55fd1ee5c09', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('c1f211ae-c023-426f-a163-797ce4f09b2f', '0eda1584-6b13-4623-8058-7ca31f5d5a56', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
