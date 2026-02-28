-- Module: create_reports_insights
-- Category: tool
-- Description: create_reports_insights MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('005829b4-e8db-4812-bc56-579f772d2b61', 'group_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('b13b7731-a2f2-48b7-95a0-94211664bd5f', '005829b4-e8db-4812-bc56-579f772d2b61', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('1d846155-062d-444d-a84e-d631a3e95100', '005829b4-e8db-4812-bc56-579f772d2b61', 'group_id', '{{ group_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('41c3e2f1-900a-472f-b904-50e02d4263a8', 'content', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('a98a649a-1366-4d3e-bd68-397e953a3694', '41c3e2f1-900a-472f-b904-50e02d4263a8', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('f725edb3-35b8-43c1-8622-3e80034649d3', '41c3e2f1-900a-472f-b904-50e02d4263a8', 'content', '{{ content }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('5ba238d0-509c-480f-a9e4-16723c802222', 'Create a new reports insights entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('d968ec8a-6f75-4508-bc41-5f02dabbc843', 'create_reports_insights', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('78748477-febd-45b0-b7d5-412203e8a86e', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_reports_insights', 'Create a new reports insights entry', '{}', 'create', '{005829b4-e8db-4812-bc56-579f772d2b61,41c3e2f1-900a-472f-b904-50e02d4263a8}', '{1d846155-062d-444d-a84e-d631a3e95100,f725edb3-35b8-43c1-8622-3e80034649d3}', '{}'::text[], '{reports_insights}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('15b6130b-8efc-47ea-bc5d-cf331ce28f8e', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('15b6130b-8efc-47ea-bc5d-cf331ce28f8e', 'b13b7731-a2f2-48b7-95a0-94211664bd5f', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('15b6130b-8efc-47ea-bc5d-cf331ce28f8e', 'a98a649a-1366-4d3e-bd68-397e953a3694', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('15b6130b-8efc-47ea-bc5d-cf331ce28f8e', '005829b4-e8db-4812-bc56-579f772d2b61', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('15b6130b-8efc-47ea-bc5d-cf331ce28f8e', '41c3e2f1-900a-472f-b904-50e02d4263a8', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('15b6130b-8efc-47ea-bc5d-cf331ce28f8e', '1d846155-062d-444d-a84e-d631a3e95100', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('15b6130b-8efc-47ea-bc5d-cf331ce28f8e', 'f725edb3-35b8-43c1-8622-3e80034649d3', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('15b6130b-8efc-47ea-bc5d-cf331ce28f8e', '018f0004-0001-7000-8000-00000000000b', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('15b6130b-8efc-47ea-bc5d-cf331ce28f8e', '5ba238d0-509c-480f-a9e4-16723c802222', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('15b6130b-8efc-47ea-bc5d-cf331ce28f8e', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('15b6130b-8efc-47ea-bc5d-cf331ce28f8e', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('15b6130b-8efc-47ea-bc5d-cf331ce28f8e', 'd968ec8a-6f75-4508-bc41-5f02dabbc843', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('15b6130b-8efc-47ea-bc5d-cf331ce28f8e', '78748477-febd-45b0-b7d5-412203e8a86e', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
