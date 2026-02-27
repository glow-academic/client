-- Module: use_auth_values
-- Category: tool
-- Description: use_auth_values MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('8d791c32-d854-4ab9-b690-a62e75fb699f', 'auth_value_id', '', 'string', true, '', '2026-02-21T22:16:39.602906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('b571fffd-e869-4854-ae4c-f6f542d9589c', '8d791c32-d854-4ab9-b690-a62e75fb699f', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('74695e49-c809-404c-b08c-edb5943ba550', '8d791c32-d854-4ab9-b690-a62e75fb699f', 'id', '{{ auth_value_id }}', '2026-02-21T22:16:39.604747+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d8b-7f7f-855f-60b97dcefc4f', 'Use an existing auth values resource instead of creating a new one', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d8b-7efd-81bf-23fba49722c9', 'use_auth_values', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('e149e3fe-bd77-4b58-b15f-d796c1dee9e1', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'use_auth_values', 'Use an existing auth value by its ID', '{}', 'link', '{8d791c32-d854-4ab9-b690-a62e75fb699f}', '{74695e49-c809-404c-b08c-edb5943ba550}', '{}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('77c54043-a722-48a1-a7b7-9695621fa4a5', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('77c54043-a722-48a1-a7b7-9695621fa4a5', 'b571fffd-e869-4854-ae4c-f6f542d9589c', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('77c54043-a722-48a1-a7b7-9695621fa4a5', '8d791c32-d854-4ab9-b690-a62e75fb699f', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('77c54043-a722-48a1-a7b7-9695621fa4a5', '74695e49-c809-404c-b08c-edb5943ba550', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('77c54043-a722-48a1-a7b7-9695621fa4a5', '019c82b8-5d8b-7f7f-855f-60b97dcefc4f', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('77c54043-a722-48a1-a7b7-9695621fa4a5', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('77c54043-a722-48a1-a7b7-9695621fa4a5', '019d0000-0001-7000-8000-000000000003', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('77c54043-a722-48a1-a7b7-9695621fa4a5', '019c82b8-5d8b-7efd-81bf-23fba49722c9', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('77c54043-a722-48a1-a7b7-9695621fa4a5', 'e149e3fe-bd77-4b58-b15f-d796c1dee9e1', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
