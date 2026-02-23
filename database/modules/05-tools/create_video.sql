-- Module: create_video
-- Category: tool
-- Description: create_video MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-73a9-b24d-e7ab977a5273', 'name', '', 'string', true, '', '2026-01-05T00:28:02.003807+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-76b7-9a43-9359c6b8b484', '019bbf87-091e-73a9-b24d-e7ab977a5273', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-79c6-9b3e-d5b2865e3956', 'length_seconds', '', 'number', true, '', '2026-01-06T15:55:22.215511+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-76bb-a3be-7135f7fb1fa7', '019bbf87-091e-79c6-9b3e-d5b2865e3956', 1, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-7373-8a48-37437e3ffde1', 'description', '', 'string', false, '', '2026-01-05T00:28:02.003807+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-76be-a267-ce27f92af940', '019bbf87-091e-7373-8a48-37437e3ffde1', 2, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0964-77cd-ab26-d467f04ec130', '019bbf87-091e-73a9-b24d-e7ab977a5273', 'name', '{{ name }}', '2026-01-14T18:39:46.698365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-096c-7c49-8340-67b41f71b130', '019bbf87-091e-79c6-9b3e-d5b2865e3956', 'length_seconds', '', '2026-01-06T15:55:22.215511+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0964-7ddd-9ac0-ca38f131c8b8', '019bbf87-091e-7373-8a48-37437e3ffde1', 'description', '{{ description }}', '2026-01-14T18:39:46.698365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-7f2f-b1bc-ccb95b102a57', 'Create a video for this scenario. The video should visually represent the scenario described in the problem statement. Include details about the setting, characters, and key actions.', '2025-12-29T19:41:03.614243+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a2f-7e9c-a071-9e35169d4cc8', 'create_video', '2025-12-29T19:41:03.614243+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource, entry) VALUES ('019bebc4-d436-7b96-b622-c512f3a418da', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_video', 'Create a video for this scenario. The video should visually represent the scenario described in the problem statement. Include details about the setting, characters, and key actions.', '{}', true, '{019bbf87-091e-73a9-b24d-e7ab977a5273,019bbf87-091e-7373-8a48-37437e3ffde1,019bbf87-091e-79c6-9b3e-d5b2865e3956}', '{019bbf87-0964-77cd-ab26-d467f04ec130,019bbf87-096c-7c49-8340-67b41f71b130,019bbf87-0964-7ddd-9ac0-ca38f131c8b8}', 'videos', NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b6ba0-df00-7d50-a92c-fffc24d64012', '2025-12-29T19:41:03.614243+00:00', '2025-12-30T15:04:40.818969+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019b6ba0-df00-7d50-a92c-fffc24d64012', '019c4e6b-2c29-76b7-9a43-9359c6b8b484', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019b6ba0-df00-7d50-a92c-fffc24d64012', '019c4e6b-2c29-76bb-a3be-7135f7fb1fa7', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019b6ba0-df00-7d50-a92c-fffc24d64012', '019c4e6b-2c29-76be-a267-ce27f92af940', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7d50-a92c-fffc24d64012', '019bbf87-091e-73a9-b24d-e7ab977a5273', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7d50-a92c-fffc24d64012', '019bbf87-091e-7373-8a48-37437e3ffde1', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7d50-a92c-fffc24d64012', '019bbf87-091e-79c6-9b3e-d5b2865e3956', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7d50-a92c-fffc24d64012', '019bbf87-0964-77cd-ab26-d467f04ec130', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7d50-a92c-fffc24d64012', '019bbf87-096c-7c49-8340-67b41f71b130', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7d50-a92c-fffc24d64012', '019bbf87-0964-7ddd-9ac0-ca38f131c8b8', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7d50-a92c-fffc24d64012', '019bbabc-5a2f-7f2f-b1bc-ccb95b102a57', '2025-12-29T19:41:03.614243+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b6ba0-df00-7d50-a92c-fffc24d64012', '019bbeb4-5117-741b-aa3c-9c953d7554f9', true, '2025-12-29T19:41:03.614243+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7d50-a92c-fffc24d64012', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2025-12-29T19:41:03.614243+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7d50-a92c-fffc24d64012', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-02-22T12:36:03.817884+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b6ba0-df00-7d50-a92c-fffc24d64012', '019bbabc-5a2f-7e9c-a071-9e35169d4cc8', '2025-12-29T19:41:03.614243+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b6ba0-df00-7d50-a92c-fffc24d64012', '019bebc4-d436-7b96-b622-c512f3a418da', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
