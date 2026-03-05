-- Module: use_scenario_flags
-- Category: tool
-- Description: use_scenario_flags MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019c0cd8-ad78-744b-9c53-a823ab2682be', 'scenario_flag_id', 'The ID of the scenario flag configuration to link', 'string', true, '', '2026-01-30T03:00:52.718855+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7995-b971-f165f1d73f0e', '019c0cd8-ad78-744b-9c53-a823ab2682be', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('44ab4560-1387-47dd-84f6-79dce5859a72', '019c0cd8-ad78-744b-9c53-a823ab2682be', 'id', '{{ scenario_flag_id }}', '2026-01-31T02:04:17.083661+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c0cd8-ad76-7d65-a139-219b90f7d111', 'use_scenario_flags', '2026-01-30T03:00:52.718855+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('019c0cd8-ad73-7621-b92d-91764faa013e', '2026-01-30T03:00:52.718855+00:00', false, false, true, 'use_scenario_flags', 'Use an existing scenario flag configuration instead of creating a new one', '{}', 'link', '{019c0cd8-ad78-744b-9c53-a823ab2682be}', '{44ab4560-1387-47dd-84f6-79dce5859a72}', '{scenario_flags}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c0cd8-ad76-7cdf-be1b-991a987e2cd3', '2026-01-30T03:00:52.718855+00:00', '2026-01-30T03:00:52.718855+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c0cd8-ad76-7cdf-be1b-991a987e2cd3', '019c4e6b-2c29-7995-b971-f165f1d73f0e', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c0cd8-ad76-7cdf-be1b-991a987e2cd3', '019c0cd8-ad78-744b-9c53-a823ab2682be', '2026-01-30T03:00:52.718855+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c0cd8-ad76-7cdf-be1b-991a987e2cd3', '44ab4560-1387-47dd-84f6-79dce5859a72', '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_resources_junction
INSERT INTO public.tool_resources_junction (tool_id, resource_id, active, created_at, generated, mcp) VALUES ('019c0cd8-ad76-7cdf-be1b-991a987e2cd3', '019bbeb4-5114-7893-8560-ee7cb288b34b', '2026-02-12T01:05:03.953545+00:00', false, false) ON CONFLICT (tool_id, resource_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('019c0cd8-ad76-7cdf-be1b-991a987e2cd3', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('019c0cd8-ad76-7cdf-be1b-991a987e2cd3', '019d0000-0001-7000-8000-000000000003', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c0cd8-ad76-7cdf-be1b-991a987e2cd3', '019c0cd8-ad76-7d65-a139-219b90f7d111', '2026-01-30T03:00:52.718855+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c0cd8-ad76-7cdf-be1b-991a987e2cd3', '019c0cd8-ad73-7621-b92d-91764faa013e', '2026-01-30T03:00:52.718855+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
