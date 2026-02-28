-- Module: create_attempt_insights
-- Category: tool
-- Description: create_attempt_insights MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('0d27feff-cf29-44f1-84c6-3656c6a39b99', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('ddbbdcb7-b23d-45f7-a560-d5f4a8083fc1', '0d27feff-cf29-44f1-84c6-3656c6a39b99', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('439dfccb-16a4-4260-807d-155dd3e3dac9', '0d27feff-cf29-44f1-84c6-3656c6a39b99', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('d6f4d449-b642-4ad0-b9de-a3778f8e75a7', 'group_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('ed0201f2-26c6-4cb7-b7d1-c3f90b320ede', 'd6f4d449-b642-4ad0-b9de-a3778f8e75a7', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('8b54b89f-33c5-4637-88b8-3d764d08d911', 'd6f4d449-b642-4ad0-b9de-a3778f8e75a7', 'group_id', '{{ group_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('26066cad-e55b-40ec-8d88-002487af6f68', 'content', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('1a51535f-cfd0-44b2-89b7-f4e3418363b1', '26066cad-e55b-40ec-8d88-002487af6f68', 2, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('aa0ba8e5-50ca-470a-98ec-1dfcb227d09c', '26066cad-e55b-40ec-8d88-002487af6f68', 'content', '{{ content }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('cf9126c3-7337-4be8-a771-f78586e01c2a', 'Create a new attempt insights entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('c2f08317-c9a1-4ebb-9b96-f2c351df368d', 'create_attempt_insights', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('7db2d001-3d8e-4174-b4c5-d91b13106dd3', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_attempt_insights', 'Create a new attempt insights entry', '{}', 'create', '{0d27feff-cf29-44f1-84c6-3656c6a39b99,d6f4d449-b642-4ad0-b9de-a3778f8e75a7,26066cad-e55b-40ec-8d88-002487af6f68}', '{439dfccb-16a4-4260-807d-155dd3e3dac9,8b54b89f-33c5-4637-88b8-3d764d08d911,aa0ba8e5-50ca-470a-98ec-1dfcb227d09c}', '{}'::text[], '{attempt_insights}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('e1515b68-a372-4993-9098-782ba0e7c213', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('e1515b68-a372-4993-9098-782ba0e7c213', 'ddbbdcb7-b23d-45f7-a560-d5f4a8083fc1', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('e1515b68-a372-4993-9098-782ba0e7c213', 'ed0201f2-26c6-4cb7-b7d1-c3f90b320ede', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('e1515b68-a372-4993-9098-782ba0e7c213', '1a51535f-cfd0-44b2-89b7-f4e3418363b1', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('e1515b68-a372-4993-9098-782ba0e7c213', '0d27feff-cf29-44f1-84c6-3656c6a39b99', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('e1515b68-a372-4993-9098-782ba0e7c213', 'd6f4d449-b642-4ad0-b9de-a3778f8e75a7', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('e1515b68-a372-4993-9098-782ba0e7c213', '26066cad-e55b-40ec-8d88-002487af6f68', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('e1515b68-a372-4993-9098-782ba0e7c213', '439dfccb-16a4-4260-807d-155dd3e3dac9', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('e1515b68-a372-4993-9098-782ba0e7c213', '8b54b89f-33c5-4637-88b8-3d764d08d911', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('e1515b68-a372-4993-9098-782ba0e7c213', 'aa0ba8e5-50ca-470a-98ec-1dfcb227d09c', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('e1515b68-a372-4993-9098-782ba0e7c213', '018f0004-0001-7000-8000-000000000002', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('e1515b68-a372-4993-9098-782ba0e7c213', 'cf9126c3-7337-4be8-a771-f78586e01c2a', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('e1515b68-a372-4993-9098-782ba0e7c213', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('e1515b68-a372-4993-9098-782ba0e7c213', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('e1515b68-a372-4993-9098-782ba0e7c213', 'c2f08317-c9a1-4ebb-9b96-f2c351df368d', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('e1515b68-a372-4993-9098-782ba0e7c213', '7db2d001-3d8e-4174-b4c5-d91b13106dd3', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
