-- Module: create_conversations
-- Category: tool
-- Description: create_conversations MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('4221ab76-c9e4-4082-88ee-127b1b4781c8', 'conversations', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('e8054576-0594-4bea-bc8a-f0a4101c0269', 'chat_id', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('65b242dd-80be-4b4a-939b-11623bd139bc', 'e8054576-0594-4bea-bc8a-f0a4101c0269', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('e4c1f885-05a4-42aa-9886-e0e771bb31c2', 'e8054576-0594-4bea-bc8a-f0a4101c0269', 'chat_id', '{{ chat_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('2829d9ec-8f87-499b-9f2c-9cd0a28eeb7e', 'run_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('53f8e712-5038-4207-949f-cda7dc1353fb', '2829d9ec-8f87-499b-9f2c-9cd0a28eeb7e', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('5915a0f0-6d98-4701-b8aa-a9a1c569301c', '2829d9ec-8f87-499b-9f2c-9cd0a28eeb7e', 'run_id', '{{ run_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('9f89ad50-5a15-4544-a6b1-84723ec91c95', 'Create a new conversations entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('eae79b6a-5480-4012-bca8-c6f3a6661ea8', 'create_conversations', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('9fc8b3ea-b6e3-4de0-9dde-be26b1b8daf3', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_conversations', 'Create a new conversations entry', '{}', 'create', '{e8054576-0594-4bea-bc8a-f0a4101c0269,2829d9ec-8f87-499b-9f2c-9cd0a28eeb7e}', '{e4c1f885-05a4-42aa-9886-e0e771bb31c2,5915a0f0-6d98-4701-b8aa-a9a1c569301c}', '{}'::text[], '{conversations}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('d899184e-8f05-47b6-b504-ea9fef610037', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('d899184e-8f05-47b6-b504-ea9fef610037', '65b242dd-80be-4b4a-939b-11623bd139bc', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('d899184e-8f05-47b6-b504-ea9fef610037', '53f8e712-5038-4207-949f-cda7dc1353fb', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('d899184e-8f05-47b6-b504-ea9fef610037', 'e8054576-0594-4bea-bc8a-f0a4101c0269', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('d899184e-8f05-47b6-b504-ea9fef610037', '2829d9ec-8f87-499b-9f2c-9cd0a28eeb7e', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('d899184e-8f05-47b6-b504-ea9fef610037', 'e4c1f885-05a4-42aa-9886-e0e771bb31c2', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('d899184e-8f05-47b6-b504-ea9fef610037', '5915a0f0-6d98-4701-b8aa-a9a1c569301c', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('d899184e-8f05-47b6-b504-ea9fef610037', '4221ab76-c9e4-4082-88ee-127b1b4781c8', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('d899184e-8f05-47b6-b504-ea9fef610037', '9f89ad50-5a15-4544-a6b1-84723ec91c95', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('d899184e-8f05-47b6-b504-ea9fef610037', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('d899184e-8f05-47b6-b504-ea9fef610037', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('d899184e-8f05-47b6-b504-ea9fef610037', 'eae79b6a-5480-4012-bca8-c6f3a6661ea8', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('d899184e-8f05-47b6-b504-ea9fef610037', '9fc8b3ea-b6e3-4de0-9dde-be26b1b8daf3', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
