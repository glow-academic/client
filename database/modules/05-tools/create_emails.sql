-- Module: create_emails
-- Category: tool
-- Description: create_emails MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-73ae-8758-02c3bcedd626', 'email', '', 'string', true, '', '2026-01-13T03:08:53.444973+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-783d-9ba9-f7d018e6fc5d', '019bbf87-091f-73ae-8758-02c3bcedd626', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-096a-7898-b11e-0b1e1268c810', '019bbf87-091f-73ae-8758-02c3bcedd626', 'email', '{{ email }}', '2026-01-13T03:08:53.444973+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-7ab9-8430-0c36d76891c6', 'Create a new email resource', '2026-01-13T03:08:53.448220+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-7a20-8257-bf67f764a542', 'create_emails', '2026-01-13T03:08:53.448220+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids) VALUES ('019bebc4-d436-7cb5-b393-0f9756ccc867', '2026-01-17T17:57:40.632192+00:00', false, false, true, 'create_emails', 'Create a new email resource', '{}', false, '{019bbf87-091f-73ae-8758-02c3bcedd626}', '{019bbf87-096a-7898-b11e-0b1e1268c810}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bb553-e748-7d28-9baa-9874247afb73', '2026-01-13T03:08:53.448220+00:00', '2026-01-13T03:08:53.448220+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019bb553-e748-7d28-9baa-9874247afb73', '019c4e6b-2c29-783d-9ba9-f7d018e6fc5d', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb553-e748-7d28-9baa-9874247afb73', '019bbf87-091f-73ae-8758-02c3bcedd626', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb553-e748-7d28-9baa-9874247afb73', '019bbf87-096a-7898-b11e-0b1e1268c810', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bb553-e748-7d28-9baa-9874247afb73', '019bbabc-5a32-7ab9-8430-0c36d76891c6', '2026-01-13T03:08:53.448220+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019bb553-e748-7d28-9baa-9874247afb73', '019bbeb4-510d-7167-8c71-f15ede99a090', true, '2026-01-13T03:08:53.448220+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bb553-e748-7d28-9baa-9874247afb73', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-13T03:08:53.448220+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bb553-e748-7d28-9baa-9874247afb73', '019bbabc-5a32-7a20-8257-bf67f764a542', '2026-01-13T03:08:53.448220+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bb553-e748-7d28-9baa-9874247afb73', '019bebc4-d436-7cb5-b393-0f9756ccc867', true, '2026-01-17T17:57:40.632192+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
