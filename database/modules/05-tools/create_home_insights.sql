-- Module: create_home_insights
-- Category: tool
-- Description: create_home_insights MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('e2560220-972b-4c01-b74f-dacda67a0b90', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('89b50f44-7578-4bed-a609-85c3f90e5b39', 'e2560220-972b-4c01-b74f-dacda67a0b90', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('969a0030-c7aa-4885-bc1e-a46afac746c1', 'e2560220-972b-4c01-b74f-dacda67a0b90', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('29657555-cc8c-4a3d-a8e6-b2440e7557cc', 'group_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('3e10f3fd-55f3-48c9-8907-899a77147bc5', '29657555-cc8c-4a3d-a8e6-b2440e7557cc', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('981a5e2c-ee01-435b-a3da-f049d7019f70', '29657555-cc8c-4a3d-a8e6-b2440e7557cc', 'group_id', '{{ group_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('25ab2102-ae5d-4cb5-98fb-86459e198b9c', 'content', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('1f6b112b-7060-4b43-a42a-3f3090b90e67', '25ab2102-ae5d-4cb5-98fb-86459e198b9c', 2, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('9ed97d1f-770d-42fc-9702-99cec0dce055', '25ab2102-ae5d-4cb5-98fb-86459e198b9c', 'content', '{{ content }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('062cffdc-c2ae-4cb2-8b29-947badd07e3f', 'Create a new home insights entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('e3e86a8f-e4dc-4ba6-942d-a0dc43de0613', 'create_home_insights', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('2bd593b9-4ab1-48e6-86f6-5393550197fd', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_home_insights', 'Create a new home insights entry', '{}', 'create', '{e2560220-972b-4c01-b74f-dacda67a0b90,29657555-cc8c-4a3d-a8e6-b2440e7557cc,25ab2102-ae5d-4cb5-98fb-86459e198b9c}', '{969a0030-c7aa-4885-bc1e-a46afac746c1,981a5e2c-ee01-435b-a3da-f049d7019f70,9ed97d1f-770d-42fc-9702-99cec0dce055}', '{}'::text[], '{home_insights}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('b7456282-ead0-4500-804d-b18c69c1187d', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('b7456282-ead0-4500-804d-b18c69c1187d', '89b50f44-7578-4bed-a609-85c3f90e5b39', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('b7456282-ead0-4500-804d-b18c69c1187d', '3e10f3fd-55f3-48c9-8907-899a77147bc5', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('b7456282-ead0-4500-804d-b18c69c1187d', '1f6b112b-7060-4b43-a42a-3f3090b90e67', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('b7456282-ead0-4500-804d-b18c69c1187d', 'e2560220-972b-4c01-b74f-dacda67a0b90', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('b7456282-ead0-4500-804d-b18c69c1187d', '29657555-cc8c-4a3d-a8e6-b2440e7557cc', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('b7456282-ead0-4500-804d-b18c69c1187d', '25ab2102-ae5d-4cb5-98fb-86459e198b9c', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('b7456282-ead0-4500-804d-b18c69c1187d', '969a0030-c7aa-4885-bc1e-a46afac746c1', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('b7456282-ead0-4500-804d-b18c69c1187d', '981a5e2c-ee01-435b-a3da-f049d7019f70', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('b7456282-ead0-4500-804d-b18c69c1187d', '9ed97d1f-770d-42fc-9702-99cec0dce055', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('b7456282-ead0-4500-804d-b18c69c1187d', '018f0004-0001-7000-8000-000000000006', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('b7456282-ead0-4500-804d-b18c69c1187d', '062cffdc-c2ae-4cb2-8b29-947badd07e3f', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('b7456282-ead0-4500-804d-b18c69c1187d', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('b7456282-ead0-4500-804d-b18c69c1187d', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('b7456282-ead0-4500-804d-b18c69c1187d', 'e3e86a8f-e4dc-4ba6-942d-a0dc43de0613', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('b7456282-ead0-4500-804d-b18c69c1187d', '2bd593b9-4ab1-48e6-86f6-5393550197fd', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
