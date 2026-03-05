-- Module: create_text_entry
-- Category: tool
-- Description: create_text_entry MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('14c349fe-a519-4920-a464-4e56110f62f1', 'texts', '2026-03-02T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-741e-9750-ffa018c4a030', 'active', '', 'boolean', true, 'true', '2026-01-13T03:25:29.718071+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('be30c2fe-1bc4-4bac-aeb2-fbc3f196c5c0', '019bbf87-091f-741e-9750-ffa018c4a030', 0, '2026-03-02T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0965-723f-9fa6-99aaa445f4fc', '019bbf87-091f-741e-9750-ffa018c4a030', 'active', '{{ active }}', '2026-01-14T18:39:46.698365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('c7a23048-3cd4-480f-a4f6-1b9c22817ad5', 'Create a new text entry', '2026-03-02T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('6e8b2ff1-4dee-4680-8bb1-72e750d4dd12', 'create_text_entry', '2026-03-02T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('95d56c0d-60f0-4151-9cf0-dff7eec26a90', '2026-03-02T00:00:00.000000+00:00', false, false, true, 'create_text_entry', 'Create a new text entry', '{}', 'create', '{019bbf87-091f-741e-9750-ffa018c4a030}', '{019bbf87-0965-723f-9fa6-99aaa445f4fc}', '{}'::text[], '{texts}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('2f5f00dc-99df-4a1f-ab20-1e0c324cddcf', '2026-03-02T00:00:00.000000+00:00', '2026-03-02T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('2f5f00dc-99df-4a1f-ab20-1e0c324cddcf', 'be30c2fe-1bc4-4bac-aeb2-fbc3f196c5c0', '2026-03-02T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('2f5f00dc-99df-4a1f-ab20-1e0c324cddcf', '019bbf87-091f-741e-9750-ffa018c4a030', '2026-03-02T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('2f5f00dc-99df-4a1f-ab20-1e0c324cddcf', '019bbf87-0965-723f-9fa6-99aaa445f4fc', '2026-03-02T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('2f5f00dc-99df-4a1f-ab20-1e0c324cddcf', '14c349fe-a519-4920-a464-4e56110f62f1', true, '2026-03-02T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('2f5f00dc-99df-4a1f-ab20-1e0c324cddcf', 'c7a23048-3cd4-480f-a4f6-1b9c22817ad5', '2026-03-02T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('2f5f00dc-99df-4a1f-ab20-1e0c324cddcf', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-03-02T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('2f5f00dc-99df-4a1f-ab20-1e0c324cddcf', '019d0000-0001-7000-8000-000000000002', '2026-03-02T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('2f5f00dc-99df-4a1f-ab20-1e0c324cddcf', '6e8b2ff1-4dee-4680-8bb1-72e750d4dd12', '2026-03-02T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('2f5f00dc-99df-4a1f-ab20-1e0c324cddcf', '95d56c0d-60f0-4151-9cf0-dff7eec26a90', true, '2026-03-02T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
