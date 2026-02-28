-- Module: create_mutes
-- Category: tool
-- Description: create_mutes MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('246a2fb1-577e-4530-8e5b-e4db013795ac', 'mutes', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('cdbccce0-05df-400b-9b52-2984a3383ea6', 'conversation_id', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('43053a75-f5ba-4b26-b079-2d6b2594a6f7', 'cdbccce0-05df-400b-9b52-2984a3383ea6', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('d1baca04-81c6-4187-ac57-3f46af4c8aa7', 'cdbccce0-05df-400b-9b52-2984a3383ea6', 'conversation_id', '{{ conversation_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('82a75258-4187-48ed-948a-818e9fcdff80', 'muted', '', 'boolean', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('62f6118c-d031-4318-b9e6-b8df21910814', '82a75258-4187-48ed-948a-818e9fcdff80', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('de442baa-5b13-4e80-853d-df4b69c5e600', '82a75258-4187-48ed-948a-818e9fcdff80', 'muted', '{{ muted }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('f77a50a1-62a2-4ffd-b55f-731cfeaf1869', 'Create a new mutes entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('f9a9c807-bc3e-4dcd-ac88-e6227039860e', 'create_mutes', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('bb074366-3b6a-46fa-a42e-d298bad627fe', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_mutes', 'Create a new mutes entry', '{}', 'create', '{cdbccce0-05df-400b-9b52-2984a3383ea6,82a75258-4187-48ed-948a-818e9fcdff80}', '{d1baca04-81c6-4187-ac57-3f46af4c8aa7,de442baa-5b13-4e80-853d-df4b69c5e600}', '{}'::text[], '{mutes}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('b67b32a2-e0c8-4c09-82ab-b0e393075415', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('b67b32a2-e0c8-4c09-82ab-b0e393075415', '43053a75-f5ba-4b26-b079-2d6b2594a6f7', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('b67b32a2-e0c8-4c09-82ab-b0e393075415', '62f6118c-d031-4318-b9e6-b8df21910814', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('b67b32a2-e0c8-4c09-82ab-b0e393075415', 'cdbccce0-05df-400b-9b52-2984a3383ea6', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('b67b32a2-e0c8-4c09-82ab-b0e393075415', '82a75258-4187-48ed-948a-818e9fcdff80', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('b67b32a2-e0c8-4c09-82ab-b0e393075415', 'd1baca04-81c6-4187-ac57-3f46af4c8aa7', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('b67b32a2-e0c8-4c09-82ab-b0e393075415', 'de442baa-5b13-4e80-853d-df4b69c5e600', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('b67b32a2-e0c8-4c09-82ab-b0e393075415', '246a2fb1-577e-4530-8e5b-e4db013795ac', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('b67b32a2-e0c8-4c09-82ab-b0e393075415', 'f77a50a1-62a2-4ffd-b55f-731cfeaf1869', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('b67b32a2-e0c8-4c09-82ab-b0e393075415', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('b67b32a2-e0c8-4c09-82ab-b0e393075415', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('b67b32a2-e0c8-4c09-82ab-b0e393075415', 'f9a9c807-bc3e-4dcd-ac88-e6227039860e', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('b67b32a2-e0c8-4c09-82ab-b0e393075415', 'bb074366-3b6a-46fa-a42e-d298bad627fe', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
