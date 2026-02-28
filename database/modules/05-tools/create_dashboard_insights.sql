-- Module: create_dashboard_insights
-- Category: tool
-- Description: create_dashboard_insights MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('d1465597-d098-4614-b3d9-7da778fcd9a3', 'group_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('8a93cba1-f7eb-456a-9304-7388b93b68e4', 'd1465597-d098-4614-b3d9-7da778fcd9a3', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('b3373e4d-b036-45b7-ad66-31db086b58d0', 'd1465597-d098-4614-b3d9-7da778fcd9a3', 'group_id', '{{ group_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('01562dd4-08ed-43c8-acac-735fa132a0d1', 'content', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('118d7a3a-75f0-4acc-80bf-2cc5cd573b8d', '01562dd4-08ed-43c8-acac-735fa132a0d1', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('dec31357-3eeb-4d70-b6b7-a353f63eab66', '01562dd4-08ed-43c8-acac-735fa132a0d1', 'content', '{{ content }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('b2d2ac57-3c55-4d64-ab84-e45a71933a03', 'Create a new dashboard insights entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('c90132fc-65d5-453a-aae3-17d257f0b638', 'create_dashboard_insights', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('48ea24d2-9527-4dfd-ab92-58ed186453d8', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_dashboard_insights', 'Create a new dashboard insights entry', '{}', 'create', '{d1465597-d098-4614-b3d9-7da778fcd9a3,01562dd4-08ed-43c8-acac-735fa132a0d1}', '{b3373e4d-b036-45b7-ad66-31db086b58d0,dec31357-3eeb-4d70-b6b7-a353f63eab66}', '{}'::text[], '{dashboard_insights}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('4c11af83-6430-4052-86cb-5a76e047f609', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('4c11af83-6430-4052-86cb-5a76e047f609', '8a93cba1-f7eb-456a-9304-7388b93b68e4', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('4c11af83-6430-4052-86cb-5a76e047f609', '118d7a3a-75f0-4acc-80bf-2cc5cd573b8d', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('4c11af83-6430-4052-86cb-5a76e047f609', 'd1465597-d098-4614-b3d9-7da778fcd9a3', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('4c11af83-6430-4052-86cb-5a76e047f609', '01562dd4-08ed-43c8-acac-735fa132a0d1', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('4c11af83-6430-4052-86cb-5a76e047f609', 'b3373e4d-b036-45b7-ad66-31db086b58d0', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('4c11af83-6430-4052-86cb-5a76e047f609', 'dec31357-3eeb-4d70-b6b7-a353f63eab66', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('4c11af83-6430-4052-86cb-5a76e047f609', '018f0004-0001-7000-8000-000000000004', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('4c11af83-6430-4052-86cb-5a76e047f609', 'b2d2ac57-3c55-4d64-ab84-e45a71933a03', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('4c11af83-6430-4052-86cb-5a76e047f609', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('4c11af83-6430-4052-86cb-5a76e047f609', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('4c11af83-6430-4052-86cb-5a76e047f609', 'c90132fc-65d5-453a-aae3-17d257f0b638', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('4c11af83-6430-4052-86cb-5a76e047f609', '48ea24d2-9527-4dfd-ab92-58ed186453d8', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
