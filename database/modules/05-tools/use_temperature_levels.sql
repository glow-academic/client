-- Module: use_temperature_levels
-- Category: tool
-- Description: use_temperature_levels MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-748d-877c-acad536b0f97', 'temperature_level_id', '', 'string', true, '', '2026-01-13T04:12:23.640777+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4f27-1785-732e-9a7a-34dbe4baa242', '019bbf87-091f-748d-877c-acad536b0f97', 0, '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c4f27-1785-7120-9979-29e7b808f006', 'Use an existing temperature level resource instead of creating a new one', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c4f27-1784-7e28-be06-4941b1025b02', 'use_temperature_levels', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids) VALUES ('019c4f27-1784-7c83-a971-06d5405753dd', '2026-02-12T00:01:27.881501+00:00', false, false, true, 'use_temperature_levels', 'Use an existing temperature level resource instead of creating a new one', '{}', false, '{019bbf87-091f-748d-877c-acad536b0f97}', '{}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c4f27-1784-7cb6-a2eb-5bcb09404268', '2026-02-12T00:01:27.881501+00:00', '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c4f27-1784-7cb6-a2eb-5bcb09404268', '019c4f27-1785-732e-9a7a-34dbe4baa242', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c4f27-1784-7cb6-a2eb-5bcb09404268', '019bbf87-091f-748d-877c-acad536b0f97', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019c4f27-1784-7cb6-a2eb-5bcb09404268', '019c4f27-1785-7120-9979-29e7b808f006', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019c4f27-1784-7cb6-a2eb-5bcb09404268', '019bbeb4-5115-7a1a-928e-4701bb4a634d', true, '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4f27-1784-7cb6-a2eb-5bcb09404268', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4f27-1784-7cb6-a2eb-5bcb09404268', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c4f27-1784-7cb6-a2eb-5bcb09404268', '019c4f27-1784-7e28-be06-4941b1025b02', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c4f27-1784-7cb6-a2eb-5bcb09404268', '019c4f27-1784-7c83-a971-06d5405753dd', true, '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
