-- Module: create_conversations
-- Category: tool
-- Description: create_conversations MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('7b6b7cd3-7036-4f19-9e7f-055ec259f3d0', 'attempt_conversations', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('014e789f-5b5b-42a8-8c15-ad46253c9377', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('7b155d15-1181-4b0f-9e59-4556be04b576', '014e789f-5b5b-42a8-8c15-ad46253c9377', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('dd7b9a20-08b7-48dc-bc58-4f8fb23a84e8', '014e789f-5b5b-42a8-8c15-ad46253c9377', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('3790db70-9bb3-4a5e-af30-8d2be8918f3f', 'chat_id', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('68a94785-1c3b-4852-a016-e85f5fc1f013', '3790db70-9bb3-4a5e-af30-8d2be8918f3f', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('dd1f7dca-b1de-4b50-a9a6-d207a4375022', '3790db70-9bb3-4a5e-af30-8d2be8918f3f', 'chat_id', '{{ chat_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('ab2d666c-1863-4a7f-a51c-248696c0b649', 'run_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('780bcd54-1e56-4b2a-a0b2-6134dbfd4c55', 'ab2d666c-1863-4a7f-a51c-248696c0b649', 2, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('7df57137-8b7f-475c-bba8-fc27550f46d2', 'ab2d666c-1863-4a7f-a51c-248696c0b649', 'run_id', '{{ run_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('4c5c7341-9b8b-408d-9271-eda6c16598f1', 'Create a new conversations entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('99ae7123-e745-46c1-9f09-db90524f37ec', 'create_conversations', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('f4676536-49d8-4f90-a807-b1f459b3765f', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_conversations', 'Create a new conversations entry', '{}', 'create', '{014e789f-5b5b-42a8-8c15-ad46253c9377,3790db70-9bb3-4a5e-af30-8d2be8918f3f,ab2d666c-1863-4a7f-a51c-248696c0b649}', '{dd7b9a20-08b7-48dc-bc58-4f8fb23a84e8,dd1f7dca-b1de-4b50-a9a6-d207a4375022,7df57137-8b7f-475c-bba8-fc27550f46d2}', '{}'::text[], '{conversations}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('57cfc16c-b756-4488-966a-823e01d0080d', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('57cfc16c-b756-4488-966a-823e01d0080d', '7b155d15-1181-4b0f-9e59-4556be04b576', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('57cfc16c-b756-4488-966a-823e01d0080d', '68a94785-1c3b-4852-a016-e85f5fc1f013', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('57cfc16c-b756-4488-966a-823e01d0080d', '780bcd54-1e56-4b2a-a0b2-6134dbfd4c55', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('57cfc16c-b756-4488-966a-823e01d0080d', '014e789f-5b5b-42a8-8c15-ad46253c9377', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('57cfc16c-b756-4488-966a-823e01d0080d', '3790db70-9bb3-4a5e-af30-8d2be8918f3f', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('57cfc16c-b756-4488-966a-823e01d0080d', 'ab2d666c-1863-4a7f-a51c-248696c0b649', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('57cfc16c-b756-4488-966a-823e01d0080d', 'dd7b9a20-08b7-48dc-bc58-4f8fb23a84e8', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('57cfc16c-b756-4488-966a-823e01d0080d', 'dd1f7dca-b1de-4b50-a9a6-d207a4375022', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('57cfc16c-b756-4488-966a-823e01d0080d', '7df57137-8b7f-475c-bba8-fc27550f46d2', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('57cfc16c-b756-4488-966a-823e01d0080d', '7b6b7cd3-7036-4f19-9e7f-055ec259f3d0', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('57cfc16c-b756-4488-966a-823e01d0080d', '4c5c7341-9b8b-408d-9271-eda6c16598f1', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('57cfc16c-b756-4488-966a-823e01d0080d', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('57cfc16c-b756-4488-966a-823e01d0080d', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('57cfc16c-b756-4488-966a-823e01d0080d', '99ae7123-e745-46c1-9f09-db90524f37ec', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('57cfc16c-b756-4488-966a-823e01d0080d', 'f4676536-49d8-4f90-a807-b1f459b3765f', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
