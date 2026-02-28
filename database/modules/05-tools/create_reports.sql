-- Module: create_reports
-- Category: tool
-- Description: create_reports MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('b473cb30-1693-4cb5-9e40-2320858b304a', 'reports', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('50b394aa-f947-4dfd-89ca-a56dde36c4ac', 'upload_id', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('d07ca7f2-ec8a-4689-9a5b-d5b19cf9bbb6', '50b394aa-f947-4dfd-89ca-a56dde36c4ac', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('368b027b-d5e7-467a-91b9-030df4565798', '50b394aa-f947-4dfd-89ca-a56dde36c4ac', 'upload_id', '{{ upload_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('39cd541b-8d8a-4097-a108-a257d8cad48a', 'Create a new reports entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('355289df-d00d-41ca-b5c1-119e5d79ca1a', 'create_reports', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('693b54d1-0836-4cf7-bf51-675d0c62f76c', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_reports', 'Create a new reports entry', '{}', 'create', '{50b394aa-f947-4dfd-89ca-a56dde36c4ac}', '{368b027b-d5e7-467a-91b9-030df4565798}', '{}'::text[], '{reports}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('a29919d9-276c-4464-b010-e5bba9b4678a', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('a29919d9-276c-4464-b010-e5bba9b4678a', 'd07ca7f2-ec8a-4689-9a5b-d5b19cf9bbb6', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('a29919d9-276c-4464-b010-e5bba9b4678a', '50b394aa-f947-4dfd-89ca-a56dde36c4ac', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('a29919d9-276c-4464-b010-e5bba9b4678a', '368b027b-d5e7-467a-91b9-030df4565798', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('a29919d9-276c-4464-b010-e5bba9b4678a', 'b473cb30-1693-4cb5-9e40-2320858b304a', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('a29919d9-276c-4464-b010-e5bba9b4678a', '39cd541b-8d8a-4097-a108-a257d8cad48a', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('a29919d9-276c-4464-b010-e5bba9b4678a', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('a29919d9-276c-4464-b010-e5bba9b4678a', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('a29919d9-276c-4464-b010-e5bba9b4678a', '355289df-d00d-41ca-b5c1-119e5d79ca1a', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('a29919d9-276c-4464-b010-e5bba9b4678a', '693b54d1-0836-4cf7-bf51-675d0c62f76c', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
