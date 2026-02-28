-- Module: create_uploads_completions
-- Category: tool
-- Description: create_uploads_completions MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('fe3ac024-2362-449a-ae58-6fe2fc2b3084', 'uploads_completions', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('8b52d63d-1553-43bb-ae2b-44801255c7d5', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('3d6ab8a9-806b-4a10-bdb4-3f87d8455bbe', '8b52d63d-1553-43bb-ae2b-44801255c7d5', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('c4732030-ac3a-4619-afa9-d6414cfae9f5', '8b52d63d-1553-43bb-ae2b-44801255c7d5', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('f9193a6f-cfcd-451c-8a3a-59a02a84b9a0', 'upload_id', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('10d46172-985b-4717-b79e-b519b09743d0', 'f9193a6f-cfcd-451c-8a3a-59a02a84b9a0', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('02cae9b5-b433-46d8-b4c3-1baa75a9cc05', 'f9193a6f-cfcd-451c-8a3a-59a02a84b9a0', 'upload_id', '{{ upload_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('aac6cfb7-2660-403f-90fa-bad7002abaa1', 'end_reason', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('48bd5cf3-97a6-4044-a3c1-3ee657bf5802', 'aac6cfb7-2660-403f-90fa-bad7002abaa1', 2, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('ed22d2d0-3fc8-4257-8782-31e6dad22098', 'aac6cfb7-2660-403f-90fa-bad7002abaa1', 'end_reason', '{{ end_reason }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('c8262250-b25e-4abb-a044-b14b6f6bfd6c', 'Create a new uploads completions entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('c83619a1-033d-4596-acb8-6a5d899508ad', 'create_uploads_completions', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('94c74002-5f43-4add-9117-199873eacba9', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_uploads_completions', 'Create a new uploads completions entry', '{}', 'create', '{8b52d63d-1553-43bb-ae2b-44801255c7d5,f9193a6f-cfcd-451c-8a3a-59a02a84b9a0,aac6cfb7-2660-403f-90fa-bad7002abaa1}', '{c4732030-ac3a-4619-afa9-d6414cfae9f5,02cae9b5-b433-46d8-b4c3-1baa75a9cc05,ed22d2d0-3fc8-4257-8782-31e6dad22098}', '{}'::text[], '{uploads_completions}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('cc8ea429-e5de-40ea-86db-c2942d34f2ff', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('cc8ea429-e5de-40ea-86db-c2942d34f2ff', '3d6ab8a9-806b-4a10-bdb4-3f87d8455bbe', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('cc8ea429-e5de-40ea-86db-c2942d34f2ff', '10d46172-985b-4717-b79e-b519b09743d0', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('cc8ea429-e5de-40ea-86db-c2942d34f2ff', '48bd5cf3-97a6-4044-a3c1-3ee657bf5802', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('cc8ea429-e5de-40ea-86db-c2942d34f2ff', '8b52d63d-1553-43bb-ae2b-44801255c7d5', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('cc8ea429-e5de-40ea-86db-c2942d34f2ff', 'f9193a6f-cfcd-451c-8a3a-59a02a84b9a0', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('cc8ea429-e5de-40ea-86db-c2942d34f2ff', 'aac6cfb7-2660-403f-90fa-bad7002abaa1', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('cc8ea429-e5de-40ea-86db-c2942d34f2ff', 'c4732030-ac3a-4619-afa9-d6414cfae9f5', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('cc8ea429-e5de-40ea-86db-c2942d34f2ff', '02cae9b5-b433-46d8-b4c3-1baa75a9cc05', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('cc8ea429-e5de-40ea-86db-c2942d34f2ff', 'ed22d2d0-3fc8-4257-8782-31e6dad22098', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('cc8ea429-e5de-40ea-86db-c2942d34f2ff', 'fe3ac024-2362-449a-ae58-6fe2fc2b3084', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('cc8ea429-e5de-40ea-86db-c2942d34f2ff', 'c8262250-b25e-4abb-a044-b14b6f6bfd6c', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('cc8ea429-e5de-40ea-86db-c2942d34f2ff', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('cc8ea429-e5de-40ea-86db-c2942d34f2ff', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('cc8ea429-e5de-40ea-86db-c2942d34f2ff', 'c83619a1-033d-4596-acb8-6a5d899508ad', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('cc8ea429-e5de-40ea-86db-c2942d34f2ff', '94c74002-5f43-4add-9117-199873eacba9', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
