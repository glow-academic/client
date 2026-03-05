-- Module: create_auth_item_keys
-- Category: tool
-- Description: create_auth_item_keys MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('998763c1-8fe5-4422-81ba-59eb8bb46192', 'key', '', 'string', true, '', '2026-02-21T22:16:39.602906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('afe746b5-b1e4-4339-bc5d-418b1e0e4516', '998763c1-8fe5-4422-81ba-59eb8bb46192', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('e0814298-ee37-4ea9-ac03-a9490357fe3b', '998763c1-8fe5-4422-81ba-59eb8bb46192', 'key', '{{ key }}', '2026-02-21T22:16:39.604747+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d89-7004-b927-65ee1a15909c', 'Create a new auth item keys resource', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d88-7f7f-97b7-00d9c5f8c6f8', 'create_auth_item_keys', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('018a62dc-6b3d-4b5f-95a1-e9809a17efd3', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'create_auth_item_keys', 'Create a new auth item key', '{}', 'create', '{998763c1-8fe5-4422-81ba-59eb8bb46192}', '{e0814298-ee37-4ea9-ac03-a9490357fe3b}', '{}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('c6819679-9648-4850-b277-ea1f89b34f11', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('c6819679-9648-4850-b277-ea1f89b34f11', 'afe746b5-b1e4-4339-bc5d-418b1e0e4516', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('c6819679-9648-4850-b277-ea1f89b34f11', '998763c1-8fe5-4422-81ba-59eb8bb46192', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('c6819679-9648-4850-b277-ea1f89b34f11', 'e0814298-ee37-4ea9-ac03-a9490357fe3b', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, descriptions_id, created_at, generated, mcp, active) VALUES ('c6819679-9648-4850-b277-ea1f89b34f11', '019c82b8-5d89-7004-b927-65ee1a15909c', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, descriptions_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flags_id, created_at, generated, mcp, active) VALUES ('c6819679-9648-4850-b277-ea1f89b34f11', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flags_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operations_id, created_at, active, generated, mcp) VALUES ('c6819679-9648-4850-b277-ea1f89b34f11', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operations_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, names_id, created_at, generated, mcp, active) VALUES ('c6819679-9648-4850-b277-ea1f89b34f11', '019c82b8-5d88-7f7f-97b7-00d9c5f8c6f8', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, names_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('c6819679-9648-4850-b277-ea1f89b34f11', '018a62dc-6b3d-4b5f-95a1-e9809a17efd3', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
