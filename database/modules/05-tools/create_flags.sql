-- Module: create_flags
-- Category: tool
-- Description: create_flags MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-73a9-b24d-e7ab977a5273', 'name', '', 'string', true, '', '2026-01-05T00:28:02.003807+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-773c-acb3-0b3ebb4d6b93', '019bbf87-091e-73a9-b24d-e7ab977a5273', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-7373-8a48-37437e3ffde1', 'description', '', 'string', false, '', '2026-01-05T00:28:02.003807+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7740-a417-7a0dff14815b', '019bbf87-091e-7373-8a48-37437e3ffde1', 1, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-7b2c-b67b-68a41ee0f8d3', 'icon_id', '', 'string', false, '', '2026-01-08T04:35:07.611112+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7745-baf8-999662fe0354', '019bbf87-091e-7b2c-b67b-68a41ee0f8d3', 2, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0964-77cd-ab26-d467f04ec130', '019bbf87-091e-73a9-b24d-e7ab977a5273', 'name', '{{ name }}', '2026-01-14T18:39:46.698365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0964-7ddd-9ac0-ca38f131c8b8', '019bbf87-091e-7373-8a48-37437e3ffde1', 'description', '{{ description }}', '2026-01-14T18:39:46.698365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0965-7033-95af-445ff0be8f46', '019bbf87-091e-7b2c-b67b-68a41ee0f8d3', 'icon', '{{ icon_id }}', '2026-01-14T18:39:46.698365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-79ee-83f5-f9010455e88c', 'Create a new flags resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-7919-9ccd-dce9f5415bf6', 'create_flags', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource) VALUES ('019bebc4-d436-7c14-a42e-f45a12c4fdb0', '2026-01-17T17:58:56.073128+00:00', false, false, true, 'create_flags', 'Create a new flags resource', '{}', true, '{019bbf87-091e-7373-8a48-37437e3ffde1,019bbf87-091e-73a9-b24d-e7ab977a5273,019bbf87-091e-7b2c-b67b-68a41ee0f8d3}', '{019bbf87-0964-77cd-ab26-d467f04ec130,019bbf87-0964-7ddd-9ac0-ca38f131c8b8,019bbf87-0965-7033-95af-445ff0be8f46}', 'flags') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8047-71c6-8140-a588e6b6c8ee', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019b9f61-8047-71c6-8140-a588e6b6c8ee', '019c4e6b-2c29-773c-acb3-0b3ebb4d6b93', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019b9f61-8047-71c6-8140-a588e6b6c8ee', '019c4e6b-2c29-7740-a417-7a0dff14815b', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019b9f61-8047-71c6-8140-a588e6b6c8ee', '019c4e6b-2c29-7745-baf8-999662fe0354', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-71c6-8140-a588e6b6c8ee', '019bbf87-091e-7373-8a48-37437e3ffde1', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-71c6-8140-a588e6b6c8ee', '019bbf87-091e-73a9-b24d-e7ab977a5273', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-71c6-8140-a588e6b6c8ee', '019bbf87-091e-7b2c-b67b-68a41ee0f8d3', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-71c6-8140-a588e6b6c8ee', '019bbf87-0964-77cd-ab26-d467f04ec130', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-71c6-8140-a588e6b6c8ee', '019bbf87-0964-7ddd-9ac0-ca38f131c8b8', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-71c6-8140-a588e6b6c8ee', '019bbf87-0965-7033-95af-445ff0be8f46', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-71c6-8140-a588e6b6c8ee', '019bbabc-5a30-79ee-83f5-f9010455e88c', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b9f61-8047-71c6-8140-a588e6b6c8ee', '019bbeb4-510d-78c7-8a11-7e2129f665df', true, '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8047-71c6-8140-a588e6b6c8ee', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8047-71c6-8140-a588e6b6c8ee', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-01-30T14:58:36.217041+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-71c6-8140-a588e6b6c8ee', '019bbabc-5a30-7919-9ccd-dce9f5415bf6', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b9f61-8047-71c6-8140-a588e6b6c8ee', '019bebc4-d436-7c14-a42e-f45a12c4fdb0', true, '2026-01-17T17:58:56.073128+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
