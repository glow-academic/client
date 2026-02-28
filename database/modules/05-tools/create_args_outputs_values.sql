-- Module: create_args_outputs_values
-- Category: tool
-- Description: create_args_outputs_values MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('5ac769f3-dde5-4808-a989-3ccb7b1b5d5d', 'args_outputs_values', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('0b60b685-d31d-40e2-8648-8b0b26c689c0', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('321b141c-c67d-4364-ad99-ec939036347b', '0b60b685-d31d-40e2-8648-8b0b26c689c0', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('dcc0a4eb-0372-469d-a0ee-9073dd686666', '0b60b685-d31d-40e2-8648-8b0b26c689c0', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('9ff15356-4d66-4b6a-8bd4-ce7225331c9a', 'string_value', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('d346cced-467c-4c59-972d-68242d5b4b30', '9ff15356-4d66-4b6a-8bd4-ce7225331c9a', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('90416e5e-642f-4e37-a3a6-fb33e4de86c7', '9ff15356-4d66-4b6a-8bd4-ce7225331c9a', 'string_value', '{{ string_value }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('5607f6db-d216-4650-9567-8945620ddb13', 'number_value', '', 'number', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('e9fa6bc9-8533-4c0f-9ca3-5eca7a203b19', '5607f6db-d216-4650-9567-8945620ddb13', 2, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('c8a14d16-b181-4b24-98ab-b026e62dfebd', '5607f6db-d216-4650-9567-8945620ddb13', 'number_value', '{{ number_value }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('651103d7-3b3f-4c04-a8d8-fdf03e34788f', 'boolean_value', '', 'boolean', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('64508252-0576-4ab4-88af-44dcf0638197', '651103d7-3b3f-4c04-a8d8-fdf03e34788f', 3, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('1ffa302e-a09e-4311-bae7-31cdb5ddcd4e', '651103d7-3b3f-4c04-a8d8-fdf03e34788f', 'boolean_value', '{{ boolean_value }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('ca633781-edb9-4661-adef-015b20fee35f', 'Create a new args outputs values entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('369541e9-3893-4c5d-a334-4c20eba5010c', 'create_args_outputs_values', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('982d3004-95d6-48eb-9aae-651c1eb8a8ac', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_args_outputs_values', 'Create a new args outputs values entry', '{}', 'create', '{0b60b685-d31d-40e2-8648-8b0b26c689c0,9ff15356-4d66-4b6a-8bd4-ce7225331c9a,5607f6db-d216-4650-9567-8945620ddb13,651103d7-3b3f-4c04-a8d8-fdf03e34788f}', '{dcc0a4eb-0372-469d-a0ee-9073dd686666,90416e5e-642f-4e37-a3a6-fb33e4de86c7,c8a14d16-b181-4b24-98ab-b026e62dfebd,1ffa302e-a09e-4311-bae7-31cdb5ddcd4e}', '{}'::text[], '{args_outputs_values}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('6c554540-267a-4be3-ae0e-4c0ddc223aa6', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('6c554540-267a-4be3-ae0e-4c0ddc223aa6', '321b141c-c67d-4364-ad99-ec939036347b', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('6c554540-267a-4be3-ae0e-4c0ddc223aa6', 'd346cced-467c-4c59-972d-68242d5b4b30', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('6c554540-267a-4be3-ae0e-4c0ddc223aa6', 'e9fa6bc9-8533-4c0f-9ca3-5eca7a203b19', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('6c554540-267a-4be3-ae0e-4c0ddc223aa6', '64508252-0576-4ab4-88af-44dcf0638197', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('6c554540-267a-4be3-ae0e-4c0ddc223aa6', '0b60b685-d31d-40e2-8648-8b0b26c689c0', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('6c554540-267a-4be3-ae0e-4c0ddc223aa6', '9ff15356-4d66-4b6a-8bd4-ce7225331c9a', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('6c554540-267a-4be3-ae0e-4c0ddc223aa6', '5607f6db-d216-4650-9567-8945620ddb13', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('6c554540-267a-4be3-ae0e-4c0ddc223aa6', '651103d7-3b3f-4c04-a8d8-fdf03e34788f', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('6c554540-267a-4be3-ae0e-4c0ddc223aa6', 'dcc0a4eb-0372-469d-a0ee-9073dd686666', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('6c554540-267a-4be3-ae0e-4c0ddc223aa6', '90416e5e-642f-4e37-a3a6-fb33e4de86c7', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('6c554540-267a-4be3-ae0e-4c0ddc223aa6', 'c8a14d16-b181-4b24-98ab-b026e62dfebd', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('6c554540-267a-4be3-ae0e-4c0ddc223aa6', '1ffa302e-a09e-4311-bae7-31cdb5ddcd4e', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('6c554540-267a-4be3-ae0e-4c0ddc223aa6', '5ac769f3-dde5-4808-a989-3ccb7b1b5d5d', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('6c554540-267a-4be3-ae0e-4c0ddc223aa6', 'ca633781-edb9-4661-adef-015b20fee35f', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('6c554540-267a-4be3-ae0e-4c0ddc223aa6', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('6c554540-267a-4be3-ae0e-4c0ddc223aa6', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('6c554540-267a-4be3-ae0e-4c0ddc223aa6', '369541e9-3893-4c5d-a334-4c20eba5010c', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('6c554540-267a-4be3-ae0e-4c0ddc223aa6', '982d3004-95d6-48eb-9aae-651c1eb8a8ac', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
