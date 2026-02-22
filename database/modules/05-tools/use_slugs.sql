-- Module: use_slugs
-- Category: tool
-- Description: use_slugs MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('4b6d2687-4c4e-4e54-ae8f-e1c4c13bd9a6', 'slug_id', '', 'string', true, '', '2026-02-21T22:16:39.602906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('07762a8a-be52-4878-8a44-4dd523d09c7f', '4b6d2687-4c4e-4e54-ae8f-e1c4c13bd9a6', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('a7e46b34-9852-4b9d-bece-3b544eb5404b', '4b6d2687-4c4e-4e54-ae8f-e1c4c13bd9a6', 'id', '{{ slug_id }}', '2026-02-21T22:16:39.604747+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d8a-7343-b3ea-c0f34b691059', 'Use an existing slugs resource instead of creating a new one', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d8a-72c6-a5d6-da7f07348e3c', 'use_slugs', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids) VALUES ('d07bff92-18d9-4b75-a8d2-deefb5a0616c', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'use_slugs', 'Use an existing slug by its ID', '{}', false, '{}', '{}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('7a0a4cc7-bf23-4bb2-b6a0-9ee0c39a3c5f', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('7a0a4cc7-bf23-4bb2-b6a0-9ee0c39a3c5f', '07762a8a-be52-4878-8a44-4dd523d09c7f', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('7a0a4cc7-bf23-4bb2-b6a0-9ee0c39a3c5f', '4b6d2687-4c4e-4e54-ae8f-e1c4c13bd9a6', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('7a0a4cc7-bf23-4bb2-b6a0-9ee0c39a3c5f', 'a7e46b34-9852-4b9d-bece-3b544eb5404b', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('7a0a4cc7-bf23-4bb2-b6a0-9ee0c39a3c5f', '019c82b8-5d8a-7343-b3ea-c0f34b691059', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('7a0a4cc7-bf23-4bb2-b6a0-9ee0c39a3c5f', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('7a0a4cc7-bf23-4bb2-b6a0-9ee0c39a3c5f', '019c82b8-5d8a-72c6-a5d6-da7f07348e3c', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('7a0a4cc7-bf23-4bb2-b6a0-9ee0c39a3c5f', 'd07bff92-18d9-4b75-a8d2-deefb5a0616c', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
