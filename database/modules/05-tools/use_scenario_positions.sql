-- Module: use_scenario_positions
-- Category: tool
-- Description: use_scenario_positions MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019c0cd8-ad78-7a5d-a14b-81019cf711ba', 'scenario_position_id', 'The ID of the scenario position configuration to link', 'string', true, '', '2026-01-30T03:00:52.718855+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7998-a8ed-5bd7a922c2bb', '019c0cd8-ad78-7a5d-a14b-81019cf711ba', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('5dae5401-6bec-40ff-9cdc-8bfdd02576be', '019c0cd8-ad78-7a5d-a14b-81019cf711ba', 'id', '{{ scenario_position_id }}', '2026-01-31T02:04:17.083661+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c0cd8-ad77-71f6-93d6-1d92a72c4383', 'use_scenario_positions', '2026-01-30T03:00:52.718855+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource) VALUES ('019c0cd8-ad73-781f-a3aa-1f1049dd213c', '2026-01-30T03:00:52.718855+00:00', false, false, true, 'use_scenario_positions', 'Use an existing scenario position configuration instead of creating a new one', '{}', false, '{019c0cd8-ad78-7a5d-a14b-81019cf711ba}', '{5dae5401-6bec-40ff-9cdc-8bfdd02576be}', 'scenario_positions') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c0cd8-ad76-7f5f-9bbb-3f9c025e1625', '2026-01-30T03:00:52.718855+00:00', '2026-01-30T03:00:52.718855+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c0cd8-ad76-7f5f-9bbb-3f9c025e1625', '019c4e6b-2c29-7998-a8ed-5bd7a922c2bb', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c0cd8-ad76-7f5f-9bbb-3f9c025e1625', '019c0cd8-ad78-7a5d-a14b-81019cf711ba', '2026-01-30T03:00:52.718855+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c0cd8-ad76-7f5f-9bbb-3f9c025e1625', '5dae5401-6bec-40ff-9cdc-8bfdd02576be', '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019c0cd8-ad76-7f5f-9bbb-3f9c025e1625', '019bbeb4-5114-79ea-bfe0-901d3d172d9c', true, '2026-02-12T01:05:03.953545+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0cd8-ad76-7f5f-9bbb-3f9c025e1625', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0cd8-ad76-7f5f-9bbb-3f9c025e1625', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c0cd8-ad76-7f5f-9bbb-3f9c025e1625', '019c0cd8-ad77-71f6-93d6-1d92a72c4383', '2026-01-30T03:00:52.718855+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c0cd8-ad76-7f5f-9bbb-3f9c025e1625', '019c0cd8-ad73-781f-a3aa-1f1049dd213c', true, '2026-01-30T03:00:52.718855+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
