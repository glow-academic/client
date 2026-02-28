-- Module: create_attempt_archive
-- Category: tool
-- Description: create_attempt_archive MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('09c81363-f282-4fa9-8f42-efa7c248ec2b', 'attempt_archives', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('042099c9-6240-4fdf-9696-003f6ded26a0', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('bc4e44d6-165c-4613-be07-d08cddb5ab23', '042099c9-6240-4fdf-9696-003f6ded26a0', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('0ff8fdc5-4d1f-4200-abfc-1877a2300e4c', '042099c9-6240-4fdf-9696-003f6ded26a0', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('2b286014-f437-4892-b6a7-0c98e7af5125', 'attempt_id', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('3bbc2241-a513-4086-bfe7-c316d2f4b0bc', '2b286014-f437-4892-b6a7-0c98e7af5125', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('6df0c0d4-0a53-42fb-b347-963462fb978d', '2b286014-f437-4892-b6a7-0c98e7af5125', 'attempt_id', '{{ attempt_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('1b8b99f5-80ce-4228-a0b0-61baa7e10b67', 'archived', '', 'boolean', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('dbf722e3-a19f-4ea6-ac5c-07de631418ec', '1b8b99f5-80ce-4228-a0b0-61baa7e10b67', 2, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('eb43d643-d532-4d1d-865d-0d77da186be2', '1b8b99f5-80ce-4228-a0b0-61baa7e10b67', 'archived', '{{ archived }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('6fbf7e24-8d30-447d-9416-2f06392366e6', 'Create a new attempt archive entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('bfd2cc40-7c38-40a9-9243-a1d78a032bb1', 'create_attempt_archive', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('22294a89-bfff-44fe-90b0-834802bacf7c', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_attempt_archive', 'Create a new attempt archive entry', '{}', 'create', '{042099c9-6240-4fdf-9696-003f6ded26a0,2b286014-f437-4892-b6a7-0c98e7af5125,1b8b99f5-80ce-4228-a0b0-61baa7e10b67}', '{0ff8fdc5-4d1f-4200-abfc-1877a2300e4c,6df0c0d4-0a53-42fb-b347-963462fb978d,eb43d643-d532-4d1d-865d-0d77da186be2}', '{}'::text[], '{attempt_archives}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('d0b98b0d-1289-4f5c-8778-0ac4a1fa7ed6', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('d0b98b0d-1289-4f5c-8778-0ac4a1fa7ed6', 'bc4e44d6-165c-4613-be07-d08cddb5ab23', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('d0b98b0d-1289-4f5c-8778-0ac4a1fa7ed6', '3bbc2241-a513-4086-bfe7-c316d2f4b0bc', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('d0b98b0d-1289-4f5c-8778-0ac4a1fa7ed6', 'dbf722e3-a19f-4ea6-ac5c-07de631418ec', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('d0b98b0d-1289-4f5c-8778-0ac4a1fa7ed6', '042099c9-6240-4fdf-9696-003f6ded26a0', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('d0b98b0d-1289-4f5c-8778-0ac4a1fa7ed6', '2b286014-f437-4892-b6a7-0c98e7af5125', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('d0b98b0d-1289-4f5c-8778-0ac4a1fa7ed6', '1b8b99f5-80ce-4228-a0b0-61baa7e10b67', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('d0b98b0d-1289-4f5c-8778-0ac4a1fa7ed6', '0ff8fdc5-4d1f-4200-abfc-1877a2300e4c', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('d0b98b0d-1289-4f5c-8778-0ac4a1fa7ed6', '6df0c0d4-0a53-42fb-b347-963462fb978d', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('d0b98b0d-1289-4f5c-8778-0ac4a1fa7ed6', 'eb43d643-d532-4d1d-865d-0d77da186be2', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('d0b98b0d-1289-4f5c-8778-0ac4a1fa7ed6', '09c81363-f282-4fa9-8f42-efa7c248ec2b', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('d0b98b0d-1289-4f5c-8778-0ac4a1fa7ed6', '6fbf7e24-8d30-447d-9416-2f06392366e6', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('d0b98b0d-1289-4f5c-8778-0ac4a1fa7ed6', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('d0b98b0d-1289-4f5c-8778-0ac4a1fa7ed6', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('d0b98b0d-1289-4f5c-8778-0ac4a1fa7ed6', 'bfd2cc40-7c38-40a9-9243-a1d78a032bb1', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('d0b98b0d-1289-4f5c-8778-0ac4a1fa7ed6', '22294a89-bfff-44fe-90b0-834802bacf7c', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
