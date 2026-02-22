-- Module: create_scenario_positions
-- Category: tool
-- Description: create_scenario_positions MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-7380-834d-0e0eb6b97d0c', 'scenario_id', '', 'string', true, '', '2026-01-13T02:51:36.015837+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7833-8619-614927e67941', '019bbf87-091f-7380-834d-0e0eb6b97d0c', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-78ff-aac4-e106cd6af4e1', 'value', '', 'number', true, '', '2026-01-09T03:07:20.516811+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7834-a80b-353d7415f488', '019bbf87-091e-78ff-aac4-e106cd6af4e1', 1, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-781f-adab-974beb4f0386', 'simulation_id', '', 'string', true, '', '2026-01-14T18:39:46.732086+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7838-8fa1-0dcd8115a2da', '019bbf87-091f-781f-adab-974beb4f0386', 2, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-096b-734d-b031-69ff82f593a4', '019bbf87-091f-7380-834d-0e0eb6b97d0c', 'scenario_id', '{{ scenario_id }}', '2026-01-13T02:51:36.015837+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0965-751e-bf8d-1f0c7563f20b', '019bbf87-091e-78ff-aac4-e106cd6af4e1', 'value', '{{ value }}', '2026-01-08T04:35:07.614135+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-096b-74ae-a967-e642fef0a546', '019bbf87-091f-781f-adab-974beb4f0386', 'simulation_id', '{{ simulation_id }}', '2026-01-14T18:39:46.732086+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-79b3-8fa1-ddb6a2056a31', 'Create a new scenario position resource to set ordering of scenarios within simulations', '2026-01-13T02:51:36.016365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-791a-8eee-2372b2ca5924', 'create_scenario_positions', '2026-01-13T02:51:36.016365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource) VALUES ('019bebc4-d436-7cb0-a120-7762b81276c3', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_scenario_positions', 'Create a new scenario position resource to set ordering of scenarios within simulations', '{}', true, '{019bbf87-091e-78ff-aac4-e106cd6af4e1,019bbf87-091f-781f-adab-974beb4f0386,019bbf87-091f-7380-834d-0e0eb6b97d0c}', '{019bbf87-096b-734d-b031-69ff82f593a4,019bbf87-0965-751e-bf8d-1f0c7563f20b,019bbf87-096b-74ae-a967-e642fef0a546}', 'scenario_positions') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bb544-12d5-7ea5-9c7b-0d6082a02d61', '2026-01-13T02:51:36.016365+00:00', '2026-01-13T02:51:36.016365+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019bb544-12d5-7ea5-9c7b-0d6082a02d61', '019c4e6b-2c29-7833-8619-614927e67941', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019bb544-12d5-7ea5-9c7b-0d6082a02d61', '019c4e6b-2c29-7834-a80b-353d7415f488', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019bb544-12d5-7ea5-9c7b-0d6082a02d61', '019c4e6b-2c29-7838-8fa1-0dcd8115a2da', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb544-12d5-7ea5-9c7b-0d6082a02d61', '019bbf87-091e-78ff-aac4-e106cd6af4e1', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb544-12d5-7ea5-9c7b-0d6082a02d61', '019bbf87-091f-781f-adab-974beb4f0386', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb544-12d5-7ea5-9c7b-0d6082a02d61', '019bbf87-091f-7380-834d-0e0eb6b97d0c', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb544-12d5-7ea5-9c7b-0d6082a02d61', '019bbf87-096b-734d-b031-69ff82f593a4', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb544-12d5-7ea5-9c7b-0d6082a02d61', '019bbf87-0965-751e-bf8d-1f0c7563f20b', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb544-12d5-7ea5-9c7b-0d6082a02d61', '019bbf87-096b-74ae-a967-e642fef0a546', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bb544-12d5-7ea5-9c7b-0d6082a02d61', '019bbabc-5a32-79b3-8fa1-ddb6a2056a31', '2026-01-13T02:51:36.016365+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019bb544-12d5-7ea5-9c7b-0d6082a02d61', '019bbeb4-5114-79ea-bfe0-901d3d172d9c', true, '2026-01-13T02:51:36.016365+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bb544-12d5-7ea5-9c7b-0d6082a02d61', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-13T02:51:36.016365+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bb544-12d5-7ea5-9c7b-0d6082a02d61', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-02-22T12:36:03.817884+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bb544-12d5-7ea5-9c7b-0d6082a02d61', '019bbabc-5a32-791a-8eee-2372b2ca5924', '2026-01-13T02:51:36.016365+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bb544-12d5-7ea5-9c7b-0d6082a02d61', '019bebc4-d436-7cb0-a120-7762b81276c3', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
