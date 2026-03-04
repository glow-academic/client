-- Module: create_conversations_completions
-- Category: tool
-- Description: create_conversations_completions MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('f4194a40-0e15-4ac4-a82f-3d213067a3f8', 'attempt_conversation_completions', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('5475fe89-f8ff-4d08-ad33-a54208d67d35', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('cf96908d-e4cb-48b7-80c2-63e74f6dd2a2', '5475fe89-f8ff-4d08-ad33-a54208d67d35', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('495c005e-2f8f-473c-834a-75f094ab00fd', '5475fe89-f8ff-4d08-ad33-a54208d67d35', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('ff04d5dd-1ed0-40d5-ab1d-11b26693016a', 'conversation_id', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('05006b5c-3eb3-4da0-babc-e7814a151b6e', 'ff04d5dd-1ed0-40d5-ab1d-11b26693016a', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('9644e7e7-845b-43e0-b8d4-6e054cbc213f', 'ff04d5dd-1ed0-40d5-ab1d-11b26693016a', 'conversation_id', '{{ conversation_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('65d78456-db24-4dbe-b22c-ef85a74d9bd9', 'end_reason', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('9e0a5b1a-f700-4d40-8147-0867e4085cba', '65d78456-db24-4dbe-b22c-ef85a74d9bd9', 2, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('8aff4b3a-f077-43f2-9fcc-5f79d03f0060', '65d78456-db24-4dbe-b22c-ef85a74d9bd9', 'end_reason', '{{ end_reason }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('f429613b-fa55-4a93-b4b4-68f5f61fe14a', 'Create a new conversations completions entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('5ae53c05-f8c5-458c-a80b-10665c8f84d5', 'create_conversations_completions', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('f03d39a2-775a-459e-bbb5-f0ace9092fa8', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_conversations_completions', 'Create a new conversations completions entry', '{}', 'create', '{5475fe89-f8ff-4d08-ad33-a54208d67d35,ff04d5dd-1ed0-40d5-ab1d-11b26693016a,65d78456-db24-4dbe-b22c-ef85a74d9bd9}', '{495c005e-2f8f-473c-834a-75f094ab00fd,9644e7e7-845b-43e0-b8d4-6e054cbc213f,8aff4b3a-f077-43f2-9fcc-5f79d03f0060}', '{}'::text[], '{conversations_completions}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('e41f04df-a1e1-4d41-bcfd-c459ce306492', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('e41f04df-a1e1-4d41-bcfd-c459ce306492', 'cf96908d-e4cb-48b7-80c2-63e74f6dd2a2', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('e41f04df-a1e1-4d41-bcfd-c459ce306492', '05006b5c-3eb3-4da0-babc-e7814a151b6e', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('e41f04df-a1e1-4d41-bcfd-c459ce306492', '9e0a5b1a-f700-4d40-8147-0867e4085cba', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('e41f04df-a1e1-4d41-bcfd-c459ce306492', '5475fe89-f8ff-4d08-ad33-a54208d67d35', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('e41f04df-a1e1-4d41-bcfd-c459ce306492', 'ff04d5dd-1ed0-40d5-ab1d-11b26693016a', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('e41f04df-a1e1-4d41-bcfd-c459ce306492', '65d78456-db24-4dbe-b22c-ef85a74d9bd9', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('e41f04df-a1e1-4d41-bcfd-c459ce306492', '495c005e-2f8f-473c-834a-75f094ab00fd', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('e41f04df-a1e1-4d41-bcfd-c459ce306492', '9644e7e7-845b-43e0-b8d4-6e054cbc213f', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('e41f04df-a1e1-4d41-bcfd-c459ce306492', '8aff4b3a-f077-43f2-9fcc-5f79d03f0060', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('e41f04df-a1e1-4d41-bcfd-c459ce306492', 'f4194a40-0e15-4ac4-a82f-3d213067a3f8', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('e41f04df-a1e1-4d41-bcfd-c459ce306492', 'f429613b-fa55-4a93-b4b4-68f5f61fe14a', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('e41f04df-a1e1-4d41-bcfd-c459ce306492', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('e41f04df-a1e1-4d41-bcfd-c459ce306492', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('e41f04df-a1e1-4d41-bcfd-c459ce306492', '5ae53c05-f8c5-458c-a80b-10665c8f84d5', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('e41f04df-a1e1-4d41-bcfd-c459ce306492', 'f03d39a2-775a-459e-bbb5-f0ace9092fa8', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
