-- Module: use_templates
-- Category: tool
-- Description: use_templates MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-7cb7-91f8-df30e243b6e4', 'template_id', '', 'string', true, '', '2026-01-06T15:55:22.215511+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-797f-8ae4-41cb729a9805', '019bbf87-091e-7cb7-91f8-df30e243b6e4', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('4ab492c3-52b5-4cd3-940c-06611d307d23', '019bbf87-091e-7cb7-91f8-df30e243b6e4', 'id', '{{ template_id }}', '2026-01-31T02:04:17.083661+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0966-7df6-bc74-45c69b1d866f', '019bbf87-091e-7cb7-91f8-df30e243b6e4', 'template_id', '', '2026-01-06T15:55:22.215511+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c0a2d-fc3a-7a72-96c0-0c5b8e26139b', 'use_templates', '2026-01-29T14:35:11.795021+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource) VALUES ('019c0a2d-fc36-7d3c-ac2c-a2108a6c55de', '2026-01-29T14:35:11.795021+00:00', false, false, true, 'use_templates', 'Use an existing template resource instead of creating a new one', '{}', false, '{019bbf87-091e-7cb7-91f8-df30e243b6e4}', '{4ab492c3-52b5-4cd3-940c-06611d307d23,019bbf87-0966-7df6-bc74-45c69b1d866f}', NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c0a2d-fc3a-7a19-8606-6c99644852e5', '2026-01-29T14:35:11.795021+00:00', '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c0a2d-fc3a-7a19-8606-6c99644852e5', '019c4e6b-2c29-797f-8ae4-41cb729a9805', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-7a19-8606-6c99644852e5', '019bbf87-091e-7cb7-91f8-df30e243b6e4', '2026-01-29T14:35:11.795021+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-7a19-8606-6c99644852e5', '4ab492c3-52b5-4cd3-940c-06611d307d23', '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-7a19-8606-6c99644852e5', '019bbf87-0966-7df6-bc74-45c69b1d866f', '2026-02-12T00:31:05.389162+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-7a19-8606-6c99644852e5', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-7a19-8606-6c99644852e5', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-7a19-8606-6c99644852e5', '019c0a2d-fc3a-7a72-96c0-0c5b8e26139b', '2026-01-29T14:35:11.795021+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c0a2d-fc3a-7a19-8606-6c99644852e5', '019c0a2d-fc36-7d3c-ac2c-a2108a6c55de', true, '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
