-- Module: create_protocols
-- Category: tool
-- Description: create_protocols MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-78ff-aac4-e106cd6af4e1', 'value', '', 'number', true, '', '2026-01-09T03:07:20.516811+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7806-b140-bcc070b3f046', '019bbf87-091e-78ff-aac4-e106cd6af4e1', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0965-751e-bf8d-1f0c7563f20b', '019bbf87-091e-78ff-aac4-e106cd6af4e1', 'value', '{{ value }}', '2026-01-08T04:35:07.614135+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-734a-8e28-618edc0c51e2', 'Create a new protocol', '2026-01-09T00:42:14.163715+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-72b5-803c-5115bb8e3496', 'create_protocols', '2026-01-09T00:42:14.163715+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource) VALUES ('019bebc4-d436-7c96-b29a-80cc1f4d73b1', '2026-01-17T17:57:40.627996+00:00', false, false, true, 'create_protocols', 'Create a new protocol', '{}', true, '{019bbf87-091e-78ff-aac4-e106cd6af4e1}', '{019bbf87-0965-751e-bf8d-1f0c7563f20b}', 'protocols') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019ba034-3316-767a-a5de-ba418c62676c', '2026-01-09T00:42:14.163715+00:00', '2026-01-09T00:42:14.163715+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019ba034-3316-767a-a5de-ba418c62676c', '019c4e6b-2c29-7806-b140-bcc070b3f046', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-767a-a5de-ba418c62676c', '019bbf87-091e-78ff-aac4-e106cd6af4e1', '2026-01-09T03:07:20.508667+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-767a-a5de-ba418c62676c', '019bbf87-0965-751e-bf8d-1f0c7563f20b', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-767a-a5de-ba418c62676c', '019bbabc-5a32-734a-8e28-618edc0c51e2', '2026-01-09T00:42:14.163715+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019ba034-3316-767a-a5de-ba418c62676c', '019bbeb4-5112-7eee-9fad-3bd63f172a5c', true, '2026-01-09T00:42:14.163715+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019ba034-3316-767a-a5de-ba418c62676c', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-09T00:42:14.163715+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019ba034-3316-767a-a5de-ba418c62676c', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-02-22T12:36:03.817884+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-767a-a5de-ba418c62676c', '019bbabc-5a32-72b5-803c-5115bb8e3496', '2026-01-09T00:42:14.163715+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019ba034-3316-767a-a5de-ba418c62676c', '019bebc4-d436-7c96-b29a-80cc1f4d73b1', true, '2026-01-17T17:57:40.627996+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
