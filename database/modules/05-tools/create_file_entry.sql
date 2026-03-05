-- Module: create_file_entry
-- Category: tool
-- Description: create_file_entry MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('22ce3748-bac3-4d94-bc15-bc00a16ab2a0', 'files', '2026-03-02T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-741e-9750-ffa018c4a030', 'active', '', 'boolean', true, 'true', '2026-01-13T03:25:29.718071+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('f214fc1c-882c-43bc-ab65-9ba9b0b66cc6', '019bbf87-091f-741e-9750-ffa018c4a030', 0, '2026-03-02T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0965-723f-9fa6-99aaa445f4fc', '019bbf87-091f-741e-9750-ffa018c4a030', 'active', '{{ active }}', '2026-01-14T18:39:46.698365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('f64045a2-9f2e-4c39-b8c0-068dc32dd3aa', 'Create a new file entry', '2026-03-02T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('650c197d-504b-4835-bd97-d4c51e0f3fe4', 'create_file_entry', '2026-03-02T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('3c010757-ed41-447e-85e2-67167ca0275a', '2026-03-02T00:00:00.000000+00:00', false, false, true, 'create_file_entry', 'Create a new file entry', '{}', 'create', '{019bbf87-091f-741e-9750-ffa018c4a030}', '{019bbf87-0965-723f-9fa6-99aaa445f4fc}', '{}'::text[], '{files}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('eb24945c-0368-44cc-9b20-a61af4546229', '2026-03-02T00:00:00.000000+00:00', '2026-03-02T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('eb24945c-0368-44cc-9b20-a61af4546229', 'f214fc1c-882c-43bc-ab65-9ba9b0b66cc6', '2026-03-02T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('eb24945c-0368-44cc-9b20-a61af4546229', '019bbf87-091f-741e-9750-ffa018c4a030', '2026-03-02T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('eb24945c-0368-44cc-9b20-a61af4546229', '019bbf87-0965-723f-9fa6-99aaa445f4fc', '2026-03-02T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('eb24945c-0368-44cc-9b20-a61af4546229', '22ce3748-bac3-4d94-bc15-bc00a16ab2a0', true, '2026-03-02T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('eb24945c-0368-44cc-9b20-a61af4546229', 'f64045a2-9f2e-4c39-b8c0-068dc32dd3aa', '2026-03-02T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('eb24945c-0368-44cc-9b20-a61af4546229', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-03-02T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('eb24945c-0368-44cc-9b20-a61af4546229', '019d0000-0001-7000-8000-000000000002', '2026-03-02T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('eb24945c-0368-44cc-9b20-a61af4546229', '650c197d-504b-4835-bd97-d4c51e0f3fe4', '2026-03-02T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('eb24945c-0368-44cc-9b20-a61af4546229', '3c010757-ed41-447e-85e2-67167ca0275a', true, '2026-03-02T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
