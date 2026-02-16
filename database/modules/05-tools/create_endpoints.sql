-- Module: create_endpoints
-- Category: tool
-- Description: create_endpoints MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-700d-8c09-4765105cfba7', 'base_url', '', 'string', true, '', '2026-01-09T00:42:14.158542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-77ee-aada-f467a4d87865', '019bbf87-091f-700d-8c09-4765105cfba7', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019c2f13-4300-7c00-8000-000000000011', 'endpoints_id', 'Returned endpoint resource ID', 'uuid', false, '', '2026-02-10T19:13:36.011239+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-77f0-b6a6-b5124aae62d2', '019c2f13-4300-7c00-8000-000000000011', 1, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0968-7699-ab4b-ef99310aea44', '019bbf87-091f-700d-8c09-4765105cfba7', 'base_url', '{{ base_url }}', '2026-01-09T00:42:14.158542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019c2f13-4300-7c00-8000-000000000021', '019c2f13-4300-7c00-8000-000000000011', 'endpoints_id', '{{ endpoints_id }}', '2026-02-10T19:13:36.011239+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-7137-af9d-dd3768f1be0d', 'Create a new endpoint', '2026-01-09T00:42:14.163715+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-70a3-b825-f78046bc3782', 'create_endpoints', '2026-01-09T00:42:14.163715+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids) VALUES ('019bebc4-d436-7c81-832a-a4a08d2b50f6', '2026-01-17T17:57:40.647526+00:00', false, false, true, 'create_endpoints', 'Create a new endpoint', '{}', false, '{019bbf87-091f-700d-8c09-4765105cfba7,019c2f13-4300-7c00-8000-000000000011}', '{019bbf87-0968-7699-ab4b-ef99310aea44,019c2f13-4300-7c00-8000-000000000021}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019ba034-3314-78bf-b711-03c5ebd25953', '2026-01-09T00:42:14.163715+00:00', '2026-01-09T00:42:14.163715+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019ba034-3314-78bf-b711-03c5ebd25953', '019c4e6b-2c29-77ee-aada-f467a4d87865', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019ba034-3314-78bf-b711-03c5ebd25953', '019c4e6b-2c29-77f0-b6a6-b5124aae62d2', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019ba034-3314-78bf-b711-03c5ebd25953', '019bbf87-091f-700d-8c09-4765105cfba7', '2026-01-09T03:07:20.508667+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019ba034-3314-78bf-b711-03c5ebd25953', '019c2f13-4300-7c00-8000-000000000011', '2026-02-11T19:45:12.566344+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019ba034-3314-78bf-b711-03c5ebd25953', '019bbf87-0968-7699-ab4b-ef99310aea44', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019ba034-3314-78bf-b711-03c5ebd25953', '019c2f13-4300-7c00-8000-000000000021', '2026-02-10T19:13:36.011239+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019ba034-3314-78bf-b711-03c5ebd25953', '019bbabc-5a32-7137-af9d-dd3768f1be0d', '2026-01-09T00:42:14.163715+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019ba034-3314-78bf-b711-03c5ebd25953', '019bbeb4-510d-72b0-a995-a5531d642b85', true, '2026-01-09T00:42:14.163715+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019ba034-3314-78bf-b711-03c5ebd25953', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-09T00:42:14.163715+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019ba034-3314-78bf-b711-03c5ebd25953', '019bbabc-5a32-70a3-b825-f78046bc3782', '2026-01-09T00:42:14.163715+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019ba034-3314-78bf-b711-03c5ebd25953', '019bebc4-d436-7c81-832a-a4a08d2b50f6', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
