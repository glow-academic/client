-- Module: create_group_positions
-- Category: tool
-- Description: create_group_positions MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-7621-82c2-3fba8dc1a434', 'eval_id', '', 'string', true, '', '2026-01-14T18:39:46.698365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7881-b5bb-f7c6fa477940', '019bbf87-091f-7621-82c2-3fba8dc1a434', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-78ff-aac4-e106cd6af4e1', 'value', '', 'number', true, '', '2026-01-09T03:07:20.516811+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7887-b6d2-5452c7140d23', '019bbf87-091e-78ff-aac4-e106cd6af4e1', 1, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-741e-9750-ffa018c4a030', 'active', '', 'boolean', true, 'true', '2026-01-13T03:25:29.718071+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-788a-be26-addc306423d9', '019bbf87-091f-741e-9750-ffa018c4a030', 2, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-7642-aa72-3507ef41149c', 'group_id', '', 'string', true, '', '2026-01-14T18:39:46.698365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-788c-bf9a-0d7263699592', '019bbf87-091f-7642-aa72-3507ef41149c', 3, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0966-7a4f-9f39-c3832c18b46a', '019bbf87-091f-7621-82c2-3fba8dc1a434', 'id', '{{ eval_id }}', '2026-01-14T18:39:46.698365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0966-7aee-96c7-e5f169218818', '019bbf87-091f-7642-aa72-3507ef41149c', 'id', '{{ group_id }}', '2026-01-14T18:39:46.698365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0965-751e-bf8d-1f0c7563f20b', '019bbf87-091e-78ff-aac4-e106cd6af4e1', 'value', '{{ value }}', '2026-01-08T04:35:07.614135+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0965-723f-9fa6-99aaa445f4fc', '019bbf87-091f-741e-9750-ffa018c4a030', 'active', '{{ active }}', '2026-01-14T18:39:46.698365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbdce-83ff-7399-a0f3-6c33163aa1a4', 'Create a new group_positions resource', '2026-01-14T18:39:46.667548+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbdce-83fe-79a4-8312-55da1341fdef', 'create_group_positions', '2026-01-14T18:39:46.667548+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('019bebc4-d436-7cd5-9cfb-f52df7b3d47d', '2026-01-17T17:58:56.053417+00:00', false, false, true, 'create_group_positions', 'Create a new group_positions resource', '{}', 'create', '{019bbf87-091f-7642-aa72-3507ef41149c,019bbf87-091f-7621-82c2-3fba8dc1a434,019bbf87-091e-78ff-aac4-e106cd6af4e1,019bbf87-091f-741e-9750-ffa018c4a030}', '{019bbf87-0966-7a4f-9f39-c3832c18b46a,019bbf87-0966-7aee-96c7-e5f169218818,019bbf87-0965-751e-bf8d-1f0c7563f20b,019bbf87-0965-723f-9fa6-99aaa445f4fc}', '{group_positions}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bbdce-83fe-76ad-8956-8ebb2b3d59a9', '2026-01-14T18:39:46.667548+00:00', '2026-01-14T18:39:46.667548+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019bbdce-83fe-76ad-8956-8ebb2b3d59a9', '019c4e6b-2c29-7881-b5bb-f7c6fa477940', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019bbdce-83fe-76ad-8956-8ebb2b3d59a9', '019c4e6b-2c29-7887-b6d2-5452c7140d23', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019bbdce-83fe-76ad-8956-8ebb2b3d59a9', '019c4e6b-2c29-788a-be26-addc306423d9', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019bbdce-83fe-76ad-8956-8ebb2b3d59a9', '019c4e6b-2c29-788c-bf9a-0d7263699592', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-83fe-76ad-8956-8ebb2b3d59a9', '019bbf87-091f-7642-aa72-3507ef41149c', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-83fe-76ad-8956-8ebb2b3d59a9', '019bbf87-091f-7621-82c2-3fba8dc1a434', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-83fe-76ad-8956-8ebb2b3d59a9', '019bbf87-091e-78ff-aac4-e106cd6af4e1', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-83fe-76ad-8956-8ebb2b3d59a9', '019bbf87-091f-741e-9750-ffa018c4a030', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-83fe-76ad-8956-8ebb2b3d59a9', '019bbf87-0966-7a4f-9f39-c3832c18b46a', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-83fe-76ad-8956-8ebb2b3d59a9', '019bbf87-0966-7aee-96c7-e5f169218818', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-83fe-76ad-8956-8ebb2b3d59a9', '019bbf87-0965-751e-bf8d-1f0c7563f20b', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-83fe-76ad-8956-8ebb2b3d59a9', '019bbf87-0965-723f-9fa6-99aaa445f4fc', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bbdce-83fe-76ad-8956-8ebb2b3d59a9', '019bbdce-83ff-7399-a0f3-6c33163aa1a4', '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_resources_junction
INSERT INTO public.tool_resources_junction (tool_id, resource_id, active, created_at, generated, mcp) VALUES ('019bbdce-83fe-76ad-8956-8ebb2b3d59a9', '019bbeb4-510f-7e91-8964-26fc754aaccc', '2026-01-14T22:50:46.919286+00:00', false, false) ON CONFLICT (tool_id, resource_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('019bbdce-83fe-76ad-8956-8ebb2b3d59a9', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('019bbdce-83fe-76ad-8956-8ebb2b3d59a9', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bbdce-83fe-76ad-8956-8ebb2b3d59a9', '019bbdce-83fe-79a4-8312-55da1341fdef', '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bbdce-83fe-76ad-8956-8ebb2b3d59a9', '019bebc4-d436-7cd5-9cfb-f52df7b3d47d', '2026-01-17T17:58:56.053417+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
