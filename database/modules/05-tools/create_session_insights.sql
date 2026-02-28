-- Module: create_session_insights
-- Category: tool
-- Description: create_session_insights MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('1eb7da1d-ec8e-4365-bbd8-5100942f6026', 'group_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('efbf4e89-94a2-408e-afda-85a2d7bfe5b9', '1eb7da1d-ec8e-4365-bbd8-5100942f6026', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('2c73f37d-ecf2-4feb-b0a7-520e5087ad53', '1eb7da1d-ec8e-4365-bbd8-5100942f6026', 'group_id', '{{ group_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('041e6548-0b61-4745-b2f2-b2a001f188c6', 'content', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('7bac7375-27de-408d-bf57-06c404c2fcbb', '041e6548-0b61-4745-b2f2-b2a001f188c6', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('84f79e2c-db36-4804-98f0-814a774d1598', '041e6548-0b61-4745-b2f2-b2a001f188c6', 'content', '{{ content }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('d160f378-de76-4980-a0fa-f073460a16ae', 'Create a new session insights entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('b1c02bfd-55a7-4f62-83ae-4f5d1126e87a', 'create_session_insights', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('4b4321b2-7ed7-4108-908e-b9ec59659234', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_session_insights', 'Create a new session insights entry', '{}', 'create', '{1eb7da1d-ec8e-4365-bbd8-5100942f6026,041e6548-0b61-4745-b2f2-b2a001f188c6}', '{2c73f37d-ecf2-4feb-b0a7-520e5087ad53,84f79e2c-db36-4804-98f0-814a774d1598}', '{}'::text[], '{session_insights}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('bf2c5864-112a-4c8e-82d3-d524d5322fd6', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('bf2c5864-112a-4c8e-82d3-d524d5322fd6', 'efbf4e89-94a2-408e-afda-85a2d7bfe5b9', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('bf2c5864-112a-4c8e-82d3-d524d5322fd6', '7bac7375-27de-408d-bf57-06c404c2fcbb', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('bf2c5864-112a-4c8e-82d3-d524d5322fd6', '1eb7da1d-ec8e-4365-bbd8-5100942f6026', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('bf2c5864-112a-4c8e-82d3-d524d5322fd6', '041e6548-0b61-4745-b2f2-b2a001f188c6', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('bf2c5864-112a-4c8e-82d3-d524d5322fd6', '2c73f37d-ecf2-4feb-b0a7-520e5087ad53', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('bf2c5864-112a-4c8e-82d3-d524d5322fd6', '84f79e2c-db36-4804-98f0-814a774d1598', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('bf2c5864-112a-4c8e-82d3-d524d5322fd6', '018f0004-0001-7000-8000-00000000000c', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('bf2c5864-112a-4c8e-82d3-d524d5322fd6', 'd160f378-de76-4980-a0fa-f073460a16ae', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('bf2c5864-112a-4c8e-82d3-d524d5322fd6', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('bf2c5864-112a-4c8e-82d3-d524d5322fd6', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('bf2c5864-112a-4c8e-82d3-d524d5322fd6', 'b1c02bfd-55a7-4f62-83ae-4f5d1126e87a', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('bf2c5864-112a-4c8e-82d3-d524d5322fd6', '4b4321b2-7ed7-4108-908e-b9ec59659234', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
