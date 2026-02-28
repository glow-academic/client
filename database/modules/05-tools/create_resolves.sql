-- Module: create_resolves
-- Category: tool
-- Description: create_resolves MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('844836c9-3821-434f-839b-6788576799de', 'resolves', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('fc973f43-c1b2-4b42-b6e0-749658bd7124', 'problem_id', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('1ef025ee-c655-4e74-96a6-f72b23262414', 'fc973f43-c1b2-4b42-b6e0-749658bd7124', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('7e9193c0-1f23-451f-a530-a87c5a7cbb35', 'fc973f43-c1b2-4b42-b6e0-749658bd7124', 'problem_id', '{{ problem_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('1f3fa581-391e-4e86-bf74-4ce9b7268b8e', 'resolved', '', 'boolean', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('503073fa-446b-46cf-b209-c7772eab1064', '1f3fa581-391e-4e86-bf74-4ce9b7268b8e', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('f8482866-928c-4ec0-ba0b-6f2e10faa18b', '1f3fa581-391e-4e86-bf74-4ce9b7268b8e', 'resolved', '{{ resolved }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('e8d45b67-81ff-4e13-a272-963e27cba8e9', 'Create a new resolves entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('5262015b-1e91-4c69-b301-8161d9ed1597', 'create_resolves', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('07fadfe0-0754-442a-bce4-9d56ab407544', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_resolves', 'Create a new resolves entry', '{}', 'create', '{fc973f43-c1b2-4b42-b6e0-749658bd7124,1f3fa581-391e-4e86-bf74-4ce9b7268b8e}', '{7e9193c0-1f23-451f-a530-a87c5a7cbb35,f8482866-928c-4ec0-ba0b-6f2e10faa18b}', '{}'::text[], '{resolves}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('db333edb-e2ae-4a6f-bf56-336e8dd42db0', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('db333edb-e2ae-4a6f-bf56-336e8dd42db0', '1ef025ee-c655-4e74-96a6-f72b23262414', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('db333edb-e2ae-4a6f-bf56-336e8dd42db0', '503073fa-446b-46cf-b209-c7772eab1064', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('db333edb-e2ae-4a6f-bf56-336e8dd42db0', 'fc973f43-c1b2-4b42-b6e0-749658bd7124', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('db333edb-e2ae-4a6f-bf56-336e8dd42db0', '1f3fa581-391e-4e86-bf74-4ce9b7268b8e', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('db333edb-e2ae-4a6f-bf56-336e8dd42db0', '7e9193c0-1f23-451f-a530-a87c5a7cbb35', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('db333edb-e2ae-4a6f-bf56-336e8dd42db0', 'f8482866-928c-4ec0-ba0b-6f2e10faa18b', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('db333edb-e2ae-4a6f-bf56-336e8dd42db0', '844836c9-3821-434f-839b-6788576799de', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('db333edb-e2ae-4a6f-bf56-336e8dd42db0', 'e8d45b67-81ff-4e13-a272-963e27cba8e9', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('db333edb-e2ae-4a6f-bf56-336e8dd42db0', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('db333edb-e2ae-4a6f-bf56-336e8dd42db0', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('db333edb-e2ae-4a6f-bf56-336e8dd42db0', '5262015b-1e91-4c69-b301-8161d9ed1597', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('db333edb-e2ae-4a6f-bf56-336e8dd42db0', '07fadfe0-0754-442a-bce4-9d56ab407544', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
