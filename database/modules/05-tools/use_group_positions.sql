-- Module: use_group_positions
-- Category: tool
-- Description: use_group_positions MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('69c8f9fe-eb30-461a-bc68-890dfc16d1bc', 'group_position_id', '', 'string', true, '', '2026-02-21T22:16:39.602906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('a8668e0f-b4ef-4647-8396-d851f32326b6', '69c8f9fe-eb30-461a-bc68-890dfc16d1bc', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('5e0a68b8-05e8-4046-a91c-36047ae8ed9b', '69c8f9fe-eb30-461a-bc68-890dfc16d1bc', 'id', '{{ group_position_id }}', '2026-02-21T22:16:39.604747+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d8a-79c2-9042-286e3fd9ef3c', 'Use an existing group positions resource instead of creating a new one', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d8a-793d-9ce1-a4dc19789649', 'use_group_positions', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('451a9536-b994-47ab-8663-1a7757735505', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'use_group_positions', 'Use an existing group position by its ID', '{}', 'link', '{69c8f9fe-eb30-461a-bc68-890dfc16d1bc}', '{5e0a68b8-05e8-4046-a91c-36047ae8ed9b}', '{}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('644e9335-2856-4a02-ad41-69e1b8ceac70', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('644e9335-2856-4a02-ad41-69e1b8ceac70', 'a8668e0f-b4ef-4647-8396-d851f32326b6', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('644e9335-2856-4a02-ad41-69e1b8ceac70', '69c8f9fe-eb30-461a-bc68-890dfc16d1bc', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('644e9335-2856-4a02-ad41-69e1b8ceac70', '5e0a68b8-05e8-4046-a91c-36047ae8ed9b', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, descriptions_id, created_at, generated, mcp, active) VALUES ('644e9335-2856-4a02-ad41-69e1b8ceac70', '019c82b8-5d8a-79c2-9042-286e3fd9ef3c', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, descriptions_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flags_id, created_at, generated, mcp, active) VALUES ('644e9335-2856-4a02-ad41-69e1b8ceac70', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flags_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operations_id, created_at, active, generated, mcp) VALUES ('644e9335-2856-4a02-ad41-69e1b8ceac70', '019d0000-0001-7000-8000-000000000003', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operations_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, names_id, created_at, generated, mcp, active) VALUES ('644e9335-2856-4a02-ad41-69e1b8ceac70', '019c82b8-5d8a-793d-9ce1-a4dc19789649', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, names_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('644e9335-2856-4a02-ad41-69e1b8ceac70', '451a9536-b994-47ab-8663-1a7757735505', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
