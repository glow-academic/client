-- Module: create_prompt
-- Category: tool
-- Description: create_prompt MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-73a9-b24d-e7ab977a5273', 'name', '', 'string', true, '', '2026-01-05T00:28:02.003807+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-76e4-a1cf-c92a9a4a9472', '019bbf87-091e-73a9-b24d-e7ab977a5273', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-77db-8e1b-386592353bee', 'system_prompt', '', 'string', true, '', '2026-01-06T15:55:22.225205+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-76ea-b224-b53b7bec3296', '019bbf87-091e-77db-8e1b-386592353bee', 1, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-7373-8a48-37437e3ffde1', 'description', '', 'string', false, '', '2026-01-05T00:28:02.003807+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-76ed-b9bb-7dabe28d10a3', '019bbf87-091e-7373-8a48-37437e3ffde1', 2, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0968-7e95-904a-7416c06e0117', '019bbf87-091e-77db-8e1b-386592353bee', 'system_prompt', '{{ content }}', '2026-01-06T15:55:22.225205+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0964-77cd-ab26-d467f04ec130', '019bbf87-091e-73a9-b24d-e7ab977a5273', 'name', '{{ name }}', '2026-01-14T18:39:46.698365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0964-7ddd-9ac0-ca38f131c8b8', '019bbf87-091e-7373-8a48-37437e3ffde1', 'description', '{{ description }}', '2026-01-14T18:39:46.698365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-76ee-8364-040eb6a93539', 'Set system prompt', '2026-01-04T20:00:50.761743+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-7662-9662-3386644a6029', 'create_prompt', '2026-01-04T20:00:50.761743+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource, entry) VALUES ('019bebc4-d436-7bc7-a392-37e8b4549478', '2026-01-17T17:57:40.643852+00:00', false, false, true, 'create_prompt', 'Set system prompt', '{}', true, '{019bbf87-091e-73a9-b24d-e7ab977a5273,019bbf87-091e-7373-8a48-37437e3ffde1,019bbf87-091e-77db-8e1b-386592353bee}', '{019bbf87-0968-7e95-904a-7416c06e0117,019bbf87-0964-77cd-ab26-d467f04ec130,019bbf87-0964-7ddd-9ac0-ca38f131c8b8}', 'prompts', NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b8a99-244b-70fe-a17c-a689c3356a67', '2026-01-04T20:00:50.761743+00:00', '2026-01-05T22:46:23.183209+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019b8a99-244b-70fe-a17c-a689c3356a67', '019c4e6b-2c29-76e4-a1cf-c92a9a4a9472', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019b8a99-244b-70fe-a17c-a689c3356a67', '019c4e6b-2c29-76ea-b224-b53b7bec3296', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019b8a99-244b-70fe-a17c-a689c3356a67', '019c4e6b-2c29-76ed-b9bb-7dabe28d10a3', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b8a99-244b-70fe-a17c-a689c3356a67', '019bbf87-091e-73a9-b24d-e7ab977a5273', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b8a99-244b-70fe-a17c-a689c3356a67', '019bbf87-091e-7373-8a48-37437e3ffde1', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b8a99-244b-70fe-a17c-a689c3356a67', '019bbf87-091e-77db-8e1b-386592353bee', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b8a99-244b-70fe-a17c-a689c3356a67', '019bbf87-0968-7e95-904a-7416c06e0117', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b8a99-244b-70fe-a17c-a689c3356a67', '019bbf87-0964-77cd-ab26-d467f04ec130', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b8a99-244b-70fe-a17c-a689c3356a67', '019bbf87-0964-7ddd-9ac0-ca38f131c8b8', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b8a99-244b-70fe-a17c-a689c3356a67', '019bbabc-5a2f-76ee-8364-040eb6a93539', '2026-01-04T20:00:50.761743+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b8a99-244b-70fe-a17c-a689c3356a67', '019bbeb4-5112-7db2-87d9-0f26b04d3ffe', true, '2026-01-04T20:00:50.761743+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b8a99-244b-70fe-a17c-a689c3356a67', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-04T20:00:50.761743+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b8a99-244b-70fe-a17c-a689c3356a67', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-02-22T12:36:03.817884+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b8a99-244b-70fe-a17c-a689c3356a67', '019bbabc-5a2f-7662-9662-3386644a6029', '2026-01-04T20:00:50.761743+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b8a99-244b-70fe-a17c-a689c3356a67', '019bebc4-d436-7bc7-a392-37e8b4549478', true, '2026-01-17T17:57:40.643852+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
