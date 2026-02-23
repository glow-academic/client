-- Module: use_objectives
-- Category: tool
-- Description: use_objectives MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019c0a2d-fc3b-7ed3-9540-bc9f25fd77fc', 'objective_id', 'The ID of the objective to link', 'string', true, '', '2026-01-29T14:35:11.795021+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7985-8f97-88a3b73b629c', '019c0a2d-fc3b-7ed3-9540-bc9f25fd77fc', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('fd340494-667f-46da-8437-d1062b446449', '019c0a2d-fc3b-7ed3-9540-bc9f25fd77fc', 'id', '{{ objective_id }}', '2026-01-31T02:04:17.083661+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c0a2d-fc3a-7f6c-bfeb-e4d8fe48b7f7', 'use_objectives', '2026-01-29T14:35:11.795021+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource, entry) VALUES ('019c0a2d-fc36-785a-9b6d-02eca12bb6e6', '2026-01-29T14:35:11.795021+00:00', false, false, true, 'use_objectives', 'Use an existing objective resource instead of creating a new one', '{}', false, '{019c0a2d-fc3b-7ed3-9540-bc9f25fd77fc}', '{fd340494-667f-46da-8437-d1062b446449}', 'objectives', NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c0a2d-fc3a-7f3c-b722-c1d9f679bb89', '2026-01-29T14:35:11.795021+00:00', '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c0a2d-fc3a-7f3c-b722-c1d9f679bb89', '019c4e6b-2c29-7985-8f97-88a3b73b629c', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-7f3c-b722-c1d9f679bb89', '019c0a2d-fc3b-7ed3-9540-bc9f25fd77fc', '2026-01-29T14:35:11.795021+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-7f3c-b722-c1d9f679bb89', 'fd340494-667f-46da-8437-d1062b446449', '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019c0a2d-fc3a-7f3c-b722-c1d9f679bb89', '019bbeb4-5112-708a-806d-7d695f766105', true, '2026-02-12T01:05:03.953545+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-7f3c-b722-c1d9f679bb89', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-7f3c-b722-c1d9f679bb89', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-7f3c-b722-c1d9f679bb89', '019c0a2d-fc3a-7f6c-bfeb-e4d8fe48b7f7', '2026-01-29T14:35:11.795021+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c0a2d-fc3a-7f3c-b722-c1d9f679bb89', '019c0a2d-fc36-785a-9b6d-02eca12bb6e6', true, '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
