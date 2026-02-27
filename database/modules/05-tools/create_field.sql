-- Module: create_field
-- Category: tool
-- Description: create_field MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-7940-9825-c757e353ed6d', 'id', '', 'string', true, '', '2026-01-07T07:25:51.781825+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7690-8d70-5eccf7c46079', '019bbf87-091e-7940-9825-c757e353ed6d', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0965-77e7-8ab0-e35555bc6b29', '019bbf87-091e-7940-9825-c757e353ed6d', 'id', '', '2026-01-08T04:35:07.614923+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a2e-7cc1-94c7-8ef9ee428408', 'Classify files as part of a specific parameter item. Provide a list of file numbers (as strings) that should be classified as the specified parameter item.', '2025-12-22T23:03:23.445951+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a2e-7bc1-89a0-a01bd5175324', 'create_field', '2025-12-22T23:03:23.445951+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource, entry, artifact) VALUES ('019bebc4-d436-7b73-a506-0b196bce4ada', '2026-01-17T17:57:40.566652+00:00', false, false, true, 'create_field', 'Classify files as part of a specific parameter item. Provide a list of file numbers (as strings) that should be classified as the specified parameter item.', '{}', true, '{019bbf87-091e-7940-9825-c757e353ed6d}', '{019bbf87-0965-77e7-8ab0-e35555bc6b29}', 'fields', NULL, NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b484d-9837-75a6-97f2-6cd03cb2bf7c', '2025-12-22T23:03:23.445951+00:00', '2026-01-05T22:46:23.183209+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019b484d-9837-75a6-97f2-6cd03cb2bf7c', '019c4e6b-2c29-7690-8d70-5eccf7c46079', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b484d-9837-75a6-97f2-6cd03cb2bf7c', '019bbf87-091e-7940-9825-c757e353ed6d', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b484d-9837-75a6-97f2-6cd03cb2bf7c', '019bbf87-0965-77e7-8ab0-e35555bc6b29', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b484d-9837-75a6-97f2-6cd03cb2bf7c', '019bbabc-5a2e-7cc1-94c7-8ef9ee428408', '2025-12-22T23:03:23.445951+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_resources_junction
INSERT INTO public.tool_resources_junction (tool_id, resource_id, active, created_at, generated, mcp) VALUES ('019b484d-9837-75a6-97f2-6cd03cb2bf7c', '019bbeb4-510d-7790-bb69-2e3f34e2d23b', true, '2025-12-22T23:03:23.445951+00:00', false, false) ON CONFLICT (tool_id, resource_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b484d-9837-75a6-97f2-6cd03cb2bf7c', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2025-12-22T23:03:23.445951+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b484d-9837-75a6-97f2-6cd03cb2bf7c', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-02-22T12:36:03.817884+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b484d-9837-75a6-97f2-6cd03cb2bf7c', '019bbabc-5a2e-7bc1-89a0-a01bd5175324', '2025-12-22T23:03:23.445951+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b484d-9837-75a6-97f2-6cd03cb2bf7c', '019bebc4-d436-7b73-a506-0b196bce4ada', true, '2026-01-17T17:57:40.566652+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
