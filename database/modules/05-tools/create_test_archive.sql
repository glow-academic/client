-- Module: create_test_archive
-- Category: tool
-- Description: create_test_archive MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('cca9dd32-5eab-4b47-a11d-76311c1b5453', 'test_archives', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('5de58a92-6500-491c-a0c2-4cc3686bfd0d', 'test_id', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('05df5c1d-bb76-45fb-b777-c038dbc3af74', '5de58a92-6500-491c-a0c2-4cc3686bfd0d', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('a29f8345-d738-4ab6-82a5-fd4db21eeefa', '5de58a92-6500-491c-a0c2-4cc3686bfd0d', 'test_id', '{{ test_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('ceef4d32-efdb-4222-b689-a72595a952d4', 'archived', '', 'boolean', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('ab637d51-8a7d-48f7-ae22-7a9a58e858af', 'ceef4d32-efdb-4222-b689-a72595a952d4', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('3348fc57-0814-4de1-b3ca-454f56fbcb3a', 'ceef4d32-efdb-4222-b689-a72595a952d4', 'archived', '{{ archived }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('78a65265-440a-4eea-a118-159171c45d4f', 'Create a new test archive entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('286afa14-3476-43ab-b731-fea317969273', 'create_test_archive', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('4a75980d-e62a-477f-85d2-a17ecd24156f', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_test_archive', 'Create a new test archive entry', '{}', 'create', '{5de58a92-6500-491c-a0c2-4cc3686bfd0d,ceef4d32-efdb-4222-b689-a72595a952d4}', '{a29f8345-d738-4ab6-82a5-fd4db21eeefa,3348fc57-0814-4de1-b3ca-454f56fbcb3a}', '{}'::text[], '{test_archives}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('530db599-c297-4d26-8e95-854a7b344b37', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('530db599-c297-4d26-8e95-854a7b344b37', '05df5c1d-bb76-45fb-b777-c038dbc3af74', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('530db599-c297-4d26-8e95-854a7b344b37', 'ab637d51-8a7d-48f7-ae22-7a9a58e858af', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('530db599-c297-4d26-8e95-854a7b344b37', '5de58a92-6500-491c-a0c2-4cc3686bfd0d', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('530db599-c297-4d26-8e95-854a7b344b37', 'ceef4d32-efdb-4222-b689-a72595a952d4', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('530db599-c297-4d26-8e95-854a7b344b37', 'a29f8345-d738-4ab6-82a5-fd4db21eeefa', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('530db599-c297-4d26-8e95-854a7b344b37', '3348fc57-0814-4de1-b3ca-454f56fbcb3a', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('530db599-c297-4d26-8e95-854a7b344b37', 'cca9dd32-5eab-4b47-a11d-76311c1b5453', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('530db599-c297-4d26-8e95-854a7b344b37', '78a65265-440a-4eea-a118-159171c45d4f', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('530db599-c297-4d26-8e95-854a7b344b37', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('530db599-c297-4d26-8e95-854a7b344b37', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('530db599-c297-4d26-8e95-854a7b344b37', '286afa14-3476-43ab-b731-fea317969273', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('530db599-c297-4d26-8e95-854a7b344b37', '4a75980d-e62a-477f-85d2-a17ecd24156f', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
