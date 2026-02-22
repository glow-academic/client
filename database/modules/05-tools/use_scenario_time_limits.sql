-- Module: use_scenario_time_limits
-- Category: tool
-- Description: use_scenario_time_limits MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019c0cd8-ad78-7ab6-8d92-f0cdef967fd8', 'scenario_time_limit_id', 'The ID of the scenario time limit configuration to link', 'string', true, '', '2026-01-30T03:00:52.718855+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-79a3-bf3e-63558dfaeb0a', '019c0cd8-ad78-7ab6-8d92-f0cdef967fd8', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('550fdadd-cdfb-4f81-8b63-fea58d068c1b', '019c0cd8-ad78-7ab6-8d92-f0cdef967fd8', 'id', '{{ scenario_time_limit_id }}', '2026-01-31T02:04:17.083661+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c0cd8-ad77-7921-a5f1-aa80a6332bc0', 'use_scenario_time_limits', '2026-01-30T03:00:52.718855+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource) VALUES ('019c0cd8-ad73-7b6f-b393-86ceeddd1beb', '2026-01-30T03:00:52.718855+00:00', false, false, true, 'use_scenario_time_limits', 'Use an existing scenario time limit configuration instead of creating a new one', '{}', false, '{019c0cd8-ad78-7ab6-8d92-f0cdef967fd8}', '{550fdadd-cdfb-4f81-8b63-fea58d068c1b}', 'scenario_time_limits') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c0cd8-ad77-78c3-bb8b-4c4430166f56', '2026-01-30T03:00:52.718855+00:00', '2026-01-30T03:00:52.718855+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c0cd8-ad77-78c3-bb8b-4c4430166f56', '019c4e6b-2c29-79a3-bf3e-63558dfaeb0a', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c0cd8-ad77-78c3-bb8b-4c4430166f56', '019c0cd8-ad78-7ab6-8d92-f0cdef967fd8', '2026-01-30T03:00:52.718855+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c0cd8-ad77-78c3-bb8b-4c4430166f56', '550fdadd-cdfb-4f81-8b63-fea58d068c1b', '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019c0cd8-ad77-78c3-bb8b-4c4430166f56', '019c4f27-1788-77d1-80c2-d5f6a884ea5e', true, '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0cd8-ad77-78c3-bb8b-4c4430166f56', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0cd8-ad77-78c3-bb8b-4c4430166f56', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c0cd8-ad77-78c3-bb8b-4c4430166f56', '019c0cd8-ad77-7921-a5f1-aa80a6332bc0', '2026-01-30T03:00:52.718855+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c0cd8-ad77-78c3-bb8b-4c4430166f56', '019c0cd8-ad73-7b6f-b393-86ceeddd1beb', true, '2026-01-30T03:00:52.718855+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
