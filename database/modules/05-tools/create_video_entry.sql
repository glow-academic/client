-- Module: create_video_entry
-- Category: tool
-- Description: create_video_entry MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('f7dd5892-d531-4ca9-81e3-94bbaf81388e', 'videos', '2026-03-02T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-741e-9750-ffa018c4a030', 'active', '', 'boolean', true, 'true', '2026-01-13T03:25:29.718071+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('145592c7-379c-4d0e-a4d4-c5c419abe6e6', '019bbf87-091f-741e-9750-ffa018c4a030', 0, '2026-03-02T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0965-723f-9fa6-99aaa445f4fc', '019bbf87-091f-741e-9750-ffa018c4a030', 'active', '{{ active }}', '2026-01-14T18:39:46.698365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-79c6-9b3e-d5b2865e3956', 'length_seconds', '', 'number', true, '', '2026-01-06T15:55:22.215511+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('24ac15bf-92b2-4590-b424-b4d9f39bbbfb', '019bbf87-091e-79c6-9b3e-d5b2865e3956', 1, '2026-03-02T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-096c-7c49-8340-67b41f71b130', '019bbf87-091e-79c6-9b3e-d5b2865e3956', 'length_seconds', '', '2026-01-06T15:55:22.215511+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('037628aa-969a-472b-98df-ede32d2a48f6', 'Create a new video entry', '2026-03-02T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('ab1e95e3-b30e-494c-9587-98fd67204c3c', 'create_video_entry', '2026-03-02T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('f3ca206e-801e-4074-8266-f94f3d332874', '2026-03-02T00:00:00.000000+00:00', false, false, true, 'create_video_entry', 'Create a new video entry', '{}', 'create', '{019bbf87-091f-741e-9750-ffa018c4a030,019bbf87-091e-79c6-9b3e-d5b2865e3956}', '{019bbf87-0965-723f-9fa6-99aaa445f4fc,019bbf87-096c-7c49-8340-67b41f71b130}', '{}'::text[], '{videos}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('40ab72e9-6e8e-4e3b-ad7c-ac2e9089014f', '2026-03-02T00:00:00.000000+00:00', '2026-03-02T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('40ab72e9-6e8e-4e3b-ad7c-ac2e9089014f', '145592c7-379c-4d0e-a4d4-c5c419abe6e6', '2026-03-02T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('40ab72e9-6e8e-4e3b-ad7c-ac2e9089014f', '24ac15bf-92b2-4590-b424-b4d9f39bbbfb', '2026-03-02T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('40ab72e9-6e8e-4e3b-ad7c-ac2e9089014f', '019bbf87-091f-741e-9750-ffa018c4a030', '2026-03-02T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('40ab72e9-6e8e-4e3b-ad7c-ac2e9089014f', '019bbf87-091e-79c6-9b3e-d5b2865e3956', '2026-03-02T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('40ab72e9-6e8e-4e3b-ad7c-ac2e9089014f', '019bbf87-0965-723f-9fa6-99aaa445f4fc', '2026-03-02T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('40ab72e9-6e8e-4e3b-ad7c-ac2e9089014f', '019bbf87-096c-7c49-8340-67b41f71b130', '2026-03-02T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('40ab72e9-6e8e-4e3b-ad7c-ac2e9089014f', 'f7dd5892-d531-4ca9-81e3-94bbaf81388e', true, '2026-03-02T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('40ab72e9-6e8e-4e3b-ad7c-ac2e9089014f', '037628aa-969a-472b-98df-ede32d2a48f6', '2026-03-02T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('40ab72e9-6e8e-4e3b-ad7c-ac2e9089014f', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-03-02T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('40ab72e9-6e8e-4e3b-ad7c-ac2e9089014f', '019d0000-0001-7000-8000-000000000002', '2026-03-02T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('40ab72e9-6e8e-4e3b-ad7c-ac2e9089014f', 'ab1e95e3-b30e-494c-9587-98fd67204c3c', '2026-03-02T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('40ab72e9-6e8e-4e3b-ad7c-ac2e9089014f', 'f3ca206e-801e-4074-8266-f94f3d332874', true, '2026-03-02T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
