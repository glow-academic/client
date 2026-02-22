-- Module: use_scenarios
-- Category: tool
-- Description: use_scenarios MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-7380-834d-0e0eb6b97d0c', 'scenario_id', '', 'string', true, '', '2026-01-13T02:51:36.015837+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7991-be06-3b33165869c1', '019bbf87-091f-7380-834d-0e0eb6b97d0c', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('1974e228-f025-490a-a974-6d2bf9b8ef44', '019bbf87-091f-7380-834d-0e0eb6b97d0c', 'id', '{{ scenario_id }}', '2026-01-31T02:04:17.083661+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c0cd8-ad75-7f4e-acf1-b8d5ce99fd48', 'use_scenarios', '2026-01-30T03:00:52.718855+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource) VALUES ('019c0cd8-ad73-72dd-8a41-ea5b247384db', '2026-01-30T03:00:52.718855+00:00', false, false, true, 'use_scenarios', 'Use an existing scenario resource instead of creating a new one', '{}', false, '{019bbf87-091f-7380-834d-0e0eb6b97d0c}', '{1974e228-f025-490a-a974-6d2bf9b8ef44}', 'scenarios') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c0cd8-ad75-7d9c-a481-f29ca2da6fd0', '2026-01-30T03:00:52.718855+00:00', '2026-01-30T03:00:52.718855+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c0cd8-ad75-7d9c-a481-f29ca2da6fd0', '019c4e6b-2c29-7991-be06-3b33165869c1', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c0cd8-ad75-7d9c-a481-f29ca2da6fd0', '019bbf87-091f-7380-834d-0e0eb6b97d0c', '2026-01-30T03:00:52.718855+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c0cd8-ad75-7d9c-a481-f29ca2da6fd0', '1974e228-f025-490a-a974-6d2bf9b8ef44', '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019c0cd8-ad75-7d9c-a481-f29ca2da6fd0', '019bbeb4-5114-7d6f-b639-917c2d4e0b9b', true, '2026-02-12T01:05:03.953545+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0cd8-ad75-7d9c-a481-f29ca2da6fd0', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0cd8-ad75-7d9c-a481-f29ca2da6fd0', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c0cd8-ad75-7d9c-a481-f29ca2da6fd0', '019c0cd8-ad75-7f4e-acf1-b8d5ce99fd48', '2026-01-30T03:00:52.718855+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c0cd8-ad75-7d9c-a481-f29ca2da6fd0', '019c0cd8-ad73-72dd-8a41-ea5b247384db', true, '2026-01-30T03:00:52.718855+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
