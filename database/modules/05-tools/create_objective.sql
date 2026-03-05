-- Module: create_objective
-- Category: tool
-- Description: create_objective MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-7778-8b79-b9c01c9861cd', 'objective', '', 'string', true, '', '2026-01-06T15:55:22.215511+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-76a9-816b-a67dd4371df6', '019bbf87-091e-7778-8b79-b9c01c9861cd', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0966-77df-9c22-cee11b4f4d31', '019bbf87-091e-7778-8b79-b9c01c9861cd', 'objective', '{{ objective }}', '2026-01-06T15:55:22.215511+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-7501-b98f-772b38484aa8', 'Create a learning objective for this scenario. Objectives should be specific, measurable, relate to pedagogical skills or subject matter knowledge, and be achievable within a single chat interaction. Call this tool multiple times to create multiple objectives.', '2025-12-29T19:41:03.614243+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-7472-9202-f6a6d9729723', 'create_objective', '2025-12-29T19:41:03.614243+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('019bebc4-d436-7b8b-8443-f82efdfd5790', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_objective', 'Create a learning objective for this scenario. Objectives should be specific, measurable, relate to pedagogical skills or subject matter knowledge, and be achievable within a single chat interaction. Call this tool multiple times to create multiple objectives.', '{}', 'create', '{019bbf87-091e-7778-8b79-b9c01c9861cd}', '{019bbf87-0966-77df-9c22-cee11b4f4d31}', '{objectives}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b6ba0-df00-79f5-9e03-1e507b91adfd', '2025-12-29T19:41:03.614243+00:00', '2025-12-30T15:04:40.818969+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019b6ba0-df00-79f5-9e03-1e507b91adfd', '019c4e6b-2c29-76a9-816b-a67dd4371df6', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-79f5-9e03-1e507b91adfd', '019bbf87-091e-7778-8b79-b9c01c9861cd', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-79f5-9e03-1e507b91adfd', '019bbf87-0966-77df-9c22-cee11b4f4d31', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-79f5-9e03-1e507b91adfd', '019bbabc-5a2f-7501-b98f-772b38484aa8', '2025-12-29T19:41:03.614243+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_resources_junction
INSERT INTO public.tool_resources_junction (tool_id, resource_id, active, created_at, generated, mcp) VALUES ('019b6ba0-df00-79f5-9e03-1e507b91adfd', '019bbeb4-5112-708a-806d-7d695f766105', true, '2025-12-29T19:41:03.614243+00:00', false, false) ON CONFLICT (tool_id, resource_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-79f5-9e03-1e507b91adfd', '019be334-bfc6-74fb-be11-ea6b522945bb', '2025-12-29T19:41:03.614243+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('019b6ba0-df00-79f5-9e03-1e507b91adfd', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-79f5-9e03-1e507b91adfd', '019bbabc-5a2f-7472-9202-f6a6d9729723', '2025-12-29T19:41:03.614243+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b6ba0-df00-79f5-9e03-1e507b91adfd', '019bebc4-d436-7b8b-8443-f82efdfd5790', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
