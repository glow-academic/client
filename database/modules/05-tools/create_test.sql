-- Module: create_test
-- Category: tool
-- Description: create_test MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('82aafaf6-10c5-4735-bb22-d1ed2062decf', 'tests', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('32617d8e-32b3-46dc-97a6-44d4a121c446', 'infinite_mode', '', 'boolean', false, 'false', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('852f7cec-4c35-4e7e-8c3d-484c5565c4bd', '32617d8e-32b3-46dc-97a6-44d4a121c446', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('ef7d5b29-c8cb-425d-a9b5-99d5671dbe61', '32617d8e-32b3-46dc-97a6-44d4a121c446', 'infinite_mode', '{{ infinite_mode }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('6c94c04c-11e8-40f6-aad5-85c0e6cef8bb', 'benchmark_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('00c7177f-3925-432b-8e00-7acfb5a80c31', '6c94c04c-11e8-40f6-aad5-85c0e6cef8bb', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('25996cde-1923-4968-9621-85ec473d52b3', '6c94c04c-11e8-40f6-aad5-85c0e6cef8bb', 'benchmark_id', '{{ benchmark_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('c8d75b04-9886-40cc-a550-87027f28509f', 'Create a new test entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('ff037864-7e01-4df8-9e6c-973b7739f2e2', 'create_test', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('6db64329-a877-4e2b-8219-79ce92bde1a1', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_test', 'Create a new test entry', '{}', 'create', '{32617d8e-32b3-46dc-97a6-44d4a121c446,6c94c04c-11e8-40f6-aad5-85c0e6cef8bb}', '{ef7d5b29-c8cb-425d-a9b5-99d5671dbe61,25996cde-1923-4968-9621-85ec473d52b3}', '{}'::text[], '{tests}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('12a930b8-0bb2-4381-b587-091f385e15df', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('12a930b8-0bb2-4381-b587-091f385e15df', '852f7cec-4c35-4e7e-8c3d-484c5565c4bd', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('12a930b8-0bb2-4381-b587-091f385e15df', '00c7177f-3925-432b-8e00-7acfb5a80c31', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('12a930b8-0bb2-4381-b587-091f385e15df', '32617d8e-32b3-46dc-97a6-44d4a121c446', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('12a930b8-0bb2-4381-b587-091f385e15df', '6c94c04c-11e8-40f6-aad5-85c0e6cef8bb', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('12a930b8-0bb2-4381-b587-091f385e15df', 'ef7d5b29-c8cb-425d-a9b5-99d5671dbe61', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('12a930b8-0bb2-4381-b587-091f385e15df', '25996cde-1923-4968-9621-85ec473d52b3', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('12a930b8-0bb2-4381-b587-091f385e15df', '82aafaf6-10c5-4735-bb22-d1ed2062decf', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('12a930b8-0bb2-4381-b587-091f385e15df', 'c8d75b04-9886-40cc-a550-87027f28509f', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('12a930b8-0bb2-4381-b587-091f385e15df', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('12a930b8-0bb2-4381-b587-091f385e15df', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('12a930b8-0bb2-4381-b587-091f385e15df', 'ff037864-7e01-4df8-9e6c-973b7739f2e2', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('12a930b8-0bb2-4381-b587-091f385e15df', '6db64329-a877-4e2b-8219-79ce92bde1a1', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
