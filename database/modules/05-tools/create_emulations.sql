-- Module: create_emulations
-- Category: tool
-- Description: create_emulations MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('a5e48ff8-32c9-4eaf-ac11-ae2681be421e', 'emulations', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('877bc537-ac0a-4345-a0d5-5c3bc52b9e4c', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('eb3a2c62-506a-4b1c-ba3a-8715176f01a6', '877bc537-ac0a-4345-a0d5-5c3bc52b9e4c', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('a6ce8efb-7dd9-491f-8775-d8647870521b', '877bc537-ac0a-4345-a0d5-5c3bc52b9e4c', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('8734f8e8-d0a7-4a71-9a9f-0193adffeb9f', 'grant_id', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('c012e0f5-bda9-46c3-84be-ee8086be78be', '8734f8e8-d0a7-4a71-9a9f-0193adffeb9f', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('cd25ce69-b47c-4f2c-9469-23b720d5f913', '8734f8e8-d0a7-4a71-9a9f-0193adffeb9f', 'grant_id', '{{ grant_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('6672f922-468c-4fc1-9f9d-a0aa6d39c754', 'Create a new emulations entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('cca543e8-a0bb-47c5-af39-5b9747f34c94', 'create_emulations', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('e5e02a3e-a1ec-464c-b30e-bfd1f0a68f23', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_emulations', 'Create a new emulations entry', '{}', 'create', '{877bc537-ac0a-4345-a0d5-5c3bc52b9e4c,8734f8e8-d0a7-4a71-9a9f-0193adffeb9f}', '{a6ce8efb-7dd9-491f-8775-d8647870521b,cd25ce69-b47c-4f2c-9469-23b720d5f913}', '{}'::text[], '{emulations}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('6434afc7-b6de-46b7-9b2b-ac7acd20549d', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('6434afc7-b6de-46b7-9b2b-ac7acd20549d', 'eb3a2c62-506a-4b1c-ba3a-8715176f01a6', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('6434afc7-b6de-46b7-9b2b-ac7acd20549d', 'c012e0f5-bda9-46c3-84be-ee8086be78be', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('6434afc7-b6de-46b7-9b2b-ac7acd20549d', '877bc537-ac0a-4345-a0d5-5c3bc52b9e4c', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('6434afc7-b6de-46b7-9b2b-ac7acd20549d', '8734f8e8-d0a7-4a71-9a9f-0193adffeb9f', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('6434afc7-b6de-46b7-9b2b-ac7acd20549d', 'a6ce8efb-7dd9-491f-8775-d8647870521b', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('6434afc7-b6de-46b7-9b2b-ac7acd20549d', 'cd25ce69-b47c-4f2c-9469-23b720d5f913', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('6434afc7-b6de-46b7-9b2b-ac7acd20549d', 'a5e48ff8-32c9-4eaf-ac11-ae2681be421e', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('6434afc7-b6de-46b7-9b2b-ac7acd20549d', '6672f922-468c-4fc1-9f9d-a0aa6d39c754', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('6434afc7-b6de-46b7-9b2b-ac7acd20549d', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('6434afc7-b6de-46b7-9b2b-ac7acd20549d', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('6434afc7-b6de-46b7-9b2b-ac7acd20549d', 'cca543e8-a0bb-47c5-af39-5b9747f34c94', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('6434afc7-b6de-46b7-9b2b-ac7acd20549d', 'e5e02a3e-a1ec-464c-b30e-bfd1f0a68f23', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
