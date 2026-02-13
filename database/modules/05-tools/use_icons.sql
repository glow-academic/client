-- Module: use_icons
-- Category: tool
-- Description: use_icons MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-795f-a64b-829281ce1408', '019c06a8-2afd-7549-ac35-bc1e31b6c6d4', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c06a8-2af8-7e10-9f3b-fa61e1018dc8', 'use_icons', '2026-01-28T22:10:10.283595+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af5-7b5d-9491-b53823a821c7', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_icons', 'Use an existing icon resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c06a8-2afc-7628-a34c-ae7690793a97', '2026-01-28T22:10:10.283595+00:00', '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c06a8-2afc-7628-a34c-ae7690793a97', '019c4e6b-2c29-795f-a64b-829281ce1408', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7628-a34c-ae7690793a97', '019c06a8-2afd-7549-ac35-bc1e31b6c6d4', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7628-a34c-ae7690793a97', 'ee773399-c6c9-480c-9513-3ab2a93a90cd', '2026-01-30T14:58:36.217917+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019c06a8-2afc-7628-a34c-ae7690793a97', '019bbeb4-5111-70d0-920d-65f36aa57797', true, '2026-02-12T01:05:03.953545+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7628-a34c-ae7690793a97', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-30T14:58:36.213184+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7628-a34c-ae7690793a97', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-01-30T14:58:36.217041+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7628-a34c-ae7690793a97', '019c06a8-2af8-7e10-9f3b-fa61e1018dc8', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c06a8-2afc-7628-a34c-ae7690793a97', '019c06a8-2af5-7b5d-9491-b53823a821c7', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
