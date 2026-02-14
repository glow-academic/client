-- Module: create_simulation_positions
-- Category: tool
-- Description: create_simulation_positions MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-78ff-aac4-e106cd6af4e1', 'value', '', 'number', true, '', '2026-01-09T03:07:20.516811+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7936-9e9b-76b1ec56b0cd', '019bbf87-091e-78ff-aac4-e106cd6af4e1', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-781f-adab-974beb4f0386', 'simulation_id', '', 'string', true, '', '2026-01-14T18:39:46.732086+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-793a-a38e-1a2d59bd72aa', '019bbf87-091f-781f-adab-974beb4f0386', 1, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0965-751e-bf8d-1f0c7563f20b', '019bbf87-091e-78ff-aac4-e106cd6af4e1', 'value', '{{ value }}', '2026-01-08T04:35:07.614135+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-096b-74ae-a967-e642fef0a546', '019bbf87-091f-781f-adab-974beb4f0386', 'simulation_id', '{{ simulation_id }}', '2026-01-14T18:39:46.732086+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019c48f6-4a52-73c5-9e33-08bdb39628b8', '019bbf87-091e-78ff-aac4-e106cd6af4e1', 'position', '{{ value }}', '2026-02-10T19:10:26.375145+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bd836-3ae4-7267-af9c-380b1cebb553', 'Create a new simulation position resource to set ordering of simulations within cohorts', '2026-01-19T21:43:11.312843+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bd836-3ae3-73c8-901f-24564dff13a4', 'create_simulation_positions', '2026-01-19T21:43:11.312843+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7d28-8f22-23d852477486', '2026-01-19T21:43:11.312843+00:00', false, false, true, 'create_simulation_positions', 'Create a new simulation position resource to set ordering of simulations within cohorts', '{}', false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bd836-3ae3-71a0-990d-b5c0fa015cd0', '2026-01-19T21:43:11.312843+00:00', '2026-01-19T21:43:11.312843+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019bd836-3ae3-71a0-990d-b5c0fa015cd0', '019c4e6b-2c29-7936-9e9b-76b1ec56b0cd', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019bd836-3ae3-71a0-990d-b5c0fa015cd0', '019c4e6b-2c29-793a-a38e-1a2d59bd72aa', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bd836-3ae3-71a0-990d-b5c0fa015cd0', '019bbf87-091f-781f-adab-974beb4f0386', '2026-01-19T21:43:11.312843+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bd836-3ae3-71a0-990d-b5c0fa015cd0', '019bbf87-091e-78ff-aac4-e106cd6af4e1', '2026-01-19T21:43:11.312843+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bd836-3ae3-71a0-990d-b5c0fa015cd0', '019bbf87-0965-751e-bf8d-1f0c7563f20b', '2026-01-19T21:43:11.312843+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bd836-3ae3-71a0-990d-b5c0fa015cd0', '019bbf87-096b-74ae-a967-e642fef0a546', '2026-01-19T21:43:11.312843+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bd836-3ae3-71a0-990d-b5c0fa015cd0', '019c48f6-4a52-73c5-9e33-08bdb39628b8', '2026-02-10T19:10:26.375145+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bd836-3ae3-71a0-990d-b5c0fa015cd0', '019bd836-3ae4-7267-af9c-380b1cebb553', '2026-01-19T21:43:11.312843+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019bd836-3ae3-71a0-990d-b5c0fa015cd0', '019bd836-3ae2-703b-9d67-f64fab2b69d0', true, '2026-01-19T21:43:11.312843+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bd836-3ae3-71a0-990d-b5c0fa015cd0', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-19T21:43:11.312843+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bd836-3ae3-71a0-990d-b5c0fa015cd0', '019bd836-3ae3-73c8-901f-24564dff13a4', '2026-01-19T21:43:11.312843+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bd836-3ae3-71a0-990d-b5c0fa015cd0', '019bebc4-d436-7d28-8f22-23d852477486', true, '2026-01-19T21:43:11.312843+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
