-- Module: use_qualities
-- Category: tool
-- Description: use_qualities MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019c4f27-1782-74f3-923b-6563265324d3', 'quality_id', '', 'string', true, '', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4f27-1782-75d2-bfc9-515d1a1260fc', '019c4f27-1782-74f3-923b-6563265324d3', 0, '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c4f27-1782-7303-baa5-c0e71f191c6d', 'Use an existing quality resource instead of creating a new one', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c4f27-1782-7144-aa68-411dc33f9be2', 'use_qualities', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource, entry) VALUES ('019c4f27-1782-706e-bc20-dc534c81ebda', '2026-02-12T00:01:27.881501+00:00', false, false, true, 'use_qualities', 'Use an existing quality resource instead of creating a new one', '{}', false, '{019c4f27-1782-74f3-923b-6563265324d3}', '{}', 'qualities', NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c4f27-1782-70d3-b39a-db44023eb3f4', '2026-02-12T00:01:27.881501+00:00', '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c4f27-1782-70d3-b39a-db44023eb3f4', '019c4f27-1782-75d2-bfc9-515d1a1260fc', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c4f27-1782-70d3-b39a-db44023eb3f4', '019c4f27-1782-74f3-923b-6563265324d3', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019c4f27-1782-70d3-b39a-db44023eb3f4', '019c4f27-1782-7303-baa5-c0e71f191c6d', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019c4f27-1782-70d3-b39a-db44023eb3f4', '019bbeb4-5113-7474-82ad-730fbdf768cc', true, '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4f27-1782-70d3-b39a-db44023eb3f4', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4f27-1782-70d3-b39a-db44023eb3f4', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c4f27-1782-70d3-b39a-db44023eb3f4', '019c4f27-1782-7144-aa68-411dc33f9be2', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c4f27-1782-70d3-b39a-db44023eb3f4', '019c4f27-1782-706e-bc20-dc534c81ebda', true, '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
