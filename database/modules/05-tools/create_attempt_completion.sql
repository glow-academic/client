-- Module: create_attempt_completion
-- Category: tool
-- Description: create_attempt_completion MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('172e69c0-a9e4-4cda-bd73-2e6b13300558', 'attempt_completions', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('e7e45f56-b23b-4083-829e-f34c57417ef7', 'chat_id', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('12c32e8c-ddb4-4bd9-8ff2-82d815ef5c4e', 'e7e45f56-b23b-4083-829e-f34c57417ef7', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('03eb43f3-e957-44fc-9b75-6354acf93238', 'e7e45f56-b23b-4083-829e-f34c57417ef7', 'chat_id', '{{ chat_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('cd902d45-7d8a-4846-9090-451420f5ee8a', 'end_reason', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('86b8e23b-5765-4d42-aff2-bf30f52fd8d7', 'cd902d45-7d8a-4846-9090-451420f5ee8a', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('156b26f8-1c6f-4422-b2bc-9ea904e69520', 'cd902d45-7d8a-4846-9090-451420f5ee8a', 'end_reason', '{{ end_reason }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('a77bf6c2-d23a-4955-8902-b6ca396d075b', 'Create a new attempt completion entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('4f036a5a-3529-4925-8f83-bdcb90a68088', 'create_attempt_completion', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('dea3396b-72f6-46e2-9adc-5e70bd2b1108', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_attempt_completion', 'Create a new attempt completion entry', '{}', 'create', '{e7e45f56-b23b-4083-829e-f34c57417ef7,cd902d45-7d8a-4846-9090-451420f5ee8a}', '{03eb43f3-e957-44fc-9b75-6354acf93238,156b26f8-1c6f-4422-b2bc-9ea904e69520}', '{}'::text[], '{attempt_completions}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('a804e5cd-13b9-4a51-8b7a-e317c873e906', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('a804e5cd-13b9-4a51-8b7a-e317c873e906', '12c32e8c-ddb4-4bd9-8ff2-82d815ef5c4e', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('a804e5cd-13b9-4a51-8b7a-e317c873e906', '86b8e23b-5765-4d42-aff2-bf30f52fd8d7', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('a804e5cd-13b9-4a51-8b7a-e317c873e906', 'e7e45f56-b23b-4083-829e-f34c57417ef7', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('a804e5cd-13b9-4a51-8b7a-e317c873e906', 'cd902d45-7d8a-4846-9090-451420f5ee8a', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('a804e5cd-13b9-4a51-8b7a-e317c873e906', '03eb43f3-e957-44fc-9b75-6354acf93238', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('a804e5cd-13b9-4a51-8b7a-e317c873e906', '156b26f8-1c6f-4422-b2bc-9ea904e69520', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('a804e5cd-13b9-4a51-8b7a-e317c873e906', '172e69c0-a9e4-4cda-bd73-2e6b13300558', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('a804e5cd-13b9-4a51-8b7a-e317c873e906', 'a77bf6c2-d23a-4955-8902-b6ca396d075b', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('a804e5cd-13b9-4a51-8b7a-e317c873e906', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('a804e5cd-13b9-4a51-8b7a-e317c873e906', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('a804e5cd-13b9-4a51-8b7a-e317c873e906', '4f036a5a-3529-4925-8f83-bdcb90a68088', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('a804e5cd-13b9-4a51-8b7a-e317c873e906', 'dea3396b-72f6-46e2-9adc-5e70bd2b1108', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
