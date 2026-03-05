-- Module: use_uploads
-- Category: tool
-- Description: use_uploads MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('13772ecb-3e4a-4fba-b9e1-2b038401e5ca', 'upload_id', '', 'string', true, '', '2026-02-21T22:16:39.602906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('b5097641-b509-493b-99a5-2a3550ce9ef2', '13772ecb-3e4a-4fba-b9e1-2b038401e5ca', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('8599b585-8015-4681-8a63-295bc77f6794', '13772ecb-3e4a-4fba-b9e1-2b038401e5ca', 'id', '{{ upload_id }}', '2026-02-21T22:16:39.604747+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d8a-7877-90b1-fdc7c266778d', 'Use an existing uploads resource instead of creating a new one', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d8a-77f5-a5f1-bc10dff2791c', 'use_uploads', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('a9275dc8-75e1-42c9-8fd7-ab5bdee1189b', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'use_uploads', 'Use an existing upload by its ID', '{}', 'link', '{13772ecb-3e4a-4fba-b9e1-2b038401e5ca}', '{8599b585-8015-4681-8a63-295bc77f6794}', '{}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('c21eb8a5-cacc-4cfd-ac36-eedfcb62bc20', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('c21eb8a5-cacc-4cfd-ac36-eedfcb62bc20', 'b5097641-b509-493b-99a5-2a3550ce9ef2', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('c21eb8a5-cacc-4cfd-ac36-eedfcb62bc20', '13772ecb-3e4a-4fba-b9e1-2b038401e5ca', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('c21eb8a5-cacc-4cfd-ac36-eedfcb62bc20', '8599b585-8015-4681-8a63-295bc77f6794', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('c21eb8a5-cacc-4cfd-ac36-eedfcb62bc20', '019c82b8-5d8a-7877-90b1-fdc7c266778d', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('c21eb8a5-cacc-4cfd-ac36-eedfcb62bc20', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('c21eb8a5-cacc-4cfd-ac36-eedfcb62bc20', '019d0000-0001-7000-8000-000000000003', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('c21eb8a5-cacc-4cfd-ac36-eedfcb62bc20', '019c82b8-5d8a-77f5-a5f1-bc10dff2791c', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('c21eb8a5-cacc-4cfd-ac36-eedfcb62bc20', 'a9275dc8-75e1-42c9-8fd7-ab5bdee1189b', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
