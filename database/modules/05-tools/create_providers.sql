-- Module: create_providers
-- Category: tool
-- Description: create_providers MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-7940-9825-c757e353ed6d', 'id', '', 'string', true, '', '2026-01-07T07:25:51.781825+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-777e-a005-14e4b98185f1', '019bbf87-091e-7940-9825-c757e353ed6d', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-7713-8183-d5f81f342c75', 'provider_id', '', 'string', true, '', '2026-01-14T18:39:46.747769+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7783-bf5a-1467c87fd286', '019bbf87-091f-7713-8183-d5f81f342c75', 1, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0966-7981-9b50-b7ac4f8bbb63', '019bbf87-091f-7713-8183-d5f81f342c75', 'id', '{{ provider_id }}', '2026-01-14T18:39:46.732086+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-745f-b7b4-08d348f45b7c', 'Create a new providers resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-73cf-8b21-4178b7b8e3a4', 'create_providers', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource, entry, artifact) VALUES ('019bebc4-d436-7c5e-b441-5b0c8673e4db', '2026-01-17T17:57:40.647526+00:00', false, false, true, 'create_providers', 'Create a new providers resource', '{}', true, '{019bbf87-091f-7713-8183-d5f81f342c75,019bbf87-091e-7940-9825-c757e353ed6d}', '{019bbf87-0966-7981-9b50-b7ac4f8bbb63}', 'providers', NULL, NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8048-75a3-8fba-9d76171470ed', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019b9f61-8048-75a3-8fba-9d76171470ed', '019c4e6b-2c29-777e-a005-14e4b98185f1', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019b9f61-8048-75a3-8fba-9d76171470ed', '019c4e6b-2c29-7783-bf5a-1467c87fd286', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-75a3-8fba-9d76171470ed', '019bbf87-091f-7713-8183-d5f81f342c75', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-75a3-8fba-9d76171470ed', '019bbf87-091e-7940-9825-c757e353ed6d', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-75a3-8fba-9d76171470ed', '019bbf87-0966-7981-9b50-b7ac4f8bbb63', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-75a3-8fba-9d76171470ed', '019bbabc-5a31-745f-b7b4-08d348f45b7c', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_resources_junction
INSERT INTO public.tool_resources_junction (tool_id, resource_id, active, created_at, generated, mcp) VALUES ('019b9f61-8048-75a3-8fba-9d76171470ed', '019bbeb4-5113-7030-b93a-5ab053c805e3', true, '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (tool_id, resource_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8048-75a3-8fba-9d76171470ed', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8048-75a3-8fba-9d76171470ed', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-02-22T12:36:03.817884+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-75a3-8fba-9d76171470ed', '019bbabc-5a31-73cf-8b21-4178b7b8e3a4', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b9f61-8048-75a3-8fba-9d76171470ed', '019bebc4-d436-7c5e-b441-5b0c8673e4db', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
