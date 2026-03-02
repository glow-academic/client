-- Module: create_image_entry
-- Category: tool
-- Description: create_image_entry MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('42b2eb26-6c58-4750-9cfa-b3cd09ee860a', 'images', '2026-03-02T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-741e-9750-ffa018c4a030', 'active', '', 'boolean', true, 'true', '2026-01-13T03:25:29.718071+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('f9ebbd4d-a7cc-47bc-99a8-8069c1dbecc1', '019bbf87-091f-741e-9750-ffa018c4a030', 0, '2026-03-02T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0965-723f-9fa6-99aaa445f4fc', '019bbf87-091f-741e-9750-ffa018c4a030', 'active', '{{ active }}', '2026-01-14T18:39:46.698365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('d81c561f-781a-4c78-8ff6-4b308939089d', 'Create a new image entry', '2026-03-02T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('27bf651b-a99d-4328-aea1-f45a93e0e0c5', 'create_image_entry', '2026-03-02T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('84bf47ec-87ea-4920-9c99-dba7e1f798b0', '2026-03-02T00:00:00.000000+00:00', false, false, true, 'create_image_entry', 'Create a new image entry', '{}', 'create', '{019bbf87-091f-741e-9750-ffa018c4a030}', '{019bbf87-0965-723f-9fa6-99aaa445f4fc}', '{}'::text[], '{images}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('6edb48df-54a0-448c-a00d-67034ab0908f', '2026-03-02T00:00:00.000000+00:00', '2026-03-02T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('6edb48df-54a0-448c-a00d-67034ab0908f', 'f9ebbd4d-a7cc-47bc-99a8-8069c1dbecc1', '2026-03-02T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('6edb48df-54a0-448c-a00d-67034ab0908f', '019bbf87-091f-741e-9750-ffa018c4a030', '2026-03-02T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('6edb48df-54a0-448c-a00d-67034ab0908f', '019bbf87-0965-723f-9fa6-99aaa445f4fc', '2026-03-02T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('6edb48df-54a0-448c-a00d-67034ab0908f', '42b2eb26-6c58-4750-9cfa-b3cd09ee860a', true, '2026-03-02T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('6edb48df-54a0-448c-a00d-67034ab0908f', 'd81c561f-781a-4c78-8ff6-4b308939089d', '2026-03-02T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('6edb48df-54a0-448c-a00d-67034ab0908f', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-03-02T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('6edb48df-54a0-448c-a00d-67034ab0908f', '019d0000-0001-7000-8000-000000000002', '2026-03-02T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('6edb48df-54a0-448c-a00d-67034ab0908f', '27bf651b-a99d-4328-aea1-f45a93e0e0c5', '2026-03-02T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('6edb48df-54a0-448c-a00d-67034ab0908f', '84bf47ec-87ea-4920-9c99-dba7e1f798b0', true, '2026-03-02T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
