-- Module: create_reports
-- Category: tool
-- Description: create_reports MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('fcae5974-6d92-4be2-80d8-70c525c1388f', 'reports', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('ce475659-01a9-4835-9698-0fc5bcd24626', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('ec011461-6e21-46b1-916e-e82571dd8b53', 'ce475659-01a9-4835-9698-0fc5bcd24626', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('5e182a48-34ba-495d-90af-7d4fe09156c6', 'ce475659-01a9-4835-9698-0fc5bcd24626', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('2c2f1e91-782c-4794-ae0e-180525b0f1f7', 'upload_id', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('27317be6-f66e-4fd7-b099-91d16881b472', '2c2f1e91-782c-4794-ae0e-180525b0f1f7', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('9e712456-c506-466a-9e9c-22093f7b30a1', '2c2f1e91-782c-4794-ae0e-180525b0f1f7', 'upload_id', '{{ upload_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('4bd43238-ae99-41db-a918-9d8655a86172', 'Create a new reports entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('0604b797-1ef2-4140-b842-9d7b930be815', 'create_reports', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('70e7c414-e046-42ce-81ed-aa16f7753152', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_reports', 'Create a new reports entry', '{}', 'create', '{ce475659-01a9-4835-9698-0fc5bcd24626,2c2f1e91-782c-4794-ae0e-180525b0f1f7}', '{5e182a48-34ba-495d-90af-7d4fe09156c6,9e712456-c506-466a-9e9c-22093f7b30a1}', '{}'::text[], '{reports}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('1a417dc5-77dd-4361-8a27-5228031e2af3', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('1a417dc5-77dd-4361-8a27-5228031e2af3', 'ec011461-6e21-46b1-916e-e82571dd8b53', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('1a417dc5-77dd-4361-8a27-5228031e2af3', '27317be6-f66e-4fd7-b099-91d16881b472', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('1a417dc5-77dd-4361-8a27-5228031e2af3', 'ce475659-01a9-4835-9698-0fc5bcd24626', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('1a417dc5-77dd-4361-8a27-5228031e2af3', '2c2f1e91-782c-4794-ae0e-180525b0f1f7', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('1a417dc5-77dd-4361-8a27-5228031e2af3', '5e182a48-34ba-495d-90af-7d4fe09156c6', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('1a417dc5-77dd-4361-8a27-5228031e2af3', '9e712456-c506-466a-9e9c-22093f7b30a1', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('1a417dc5-77dd-4361-8a27-5228031e2af3', 'fcae5974-6d92-4be2-80d8-70c525c1388f', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('1a417dc5-77dd-4361-8a27-5228031e2af3', '4bd43238-ae99-41db-a918-9d8655a86172', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('1a417dc5-77dd-4361-8a27-5228031e2af3', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('1a417dc5-77dd-4361-8a27-5228031e2af3', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('1a417dc5-77dd-4361-8a27-5228031e2af3', '0604b797-1ef2-4140-b842-9d7b930be815', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('1a417dc5-77dd-4361-8a27-5228031e2af3', '70e7c414-e046-42ce-81ed-aa16f7753152', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
