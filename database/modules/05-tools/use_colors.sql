-- Module: use_colors
-- Category: tool
-- Description: use_colors MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019c06a8-2afc-7e58-a1d2-3724e2b70dd3', 'color_id', 'The ID of the color to link', 'string', true, '', '2026-01-28T22:10:10.283595+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7952-b5b2-6a37063a7bcc', '019c06a8-2afc-7e58-a1d2-3724e2b70dd3', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('1d4b9314-bd8e-43fa-9f91-3cab63d2a6fe', '019c06a8-2afc-7e58-a1d2-3724e2b70dd3', 'id', '{{ color_id }}', '2026-01-30T14:58:36.217917+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c06a8-2af7-72c7-bed1-ec07e4bea469', 'use_colors', '2026-01-28T22:10:10.283595+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource) VALUES ('019c06a8-2af4-765d-abe4-dc47e392ad30', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_colors', 'Use an existing color resource instead of creating a new one', '{}', false, '{019c06a8-2afc-7e58-a1d2-3724e2b70dd3}', '{1d4b9314-bd8e-43fa-9f91-3cab63d2a6fe}', 'colors') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c06a8-2afc-7051-8212-4be68125ebd4', '2026-01-28T22:10:10.283595+00:00', '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c06a8-2afc-7051-8212-4be68125ebd4', '019c4e6b-2c29-7952-b5b2-6a37063a7bcc', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7051-8212-4be68125ebd4', '019c06a8-2afc-7e58-a1d2-3724e2b70dd3', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7051-8212-4be68125ebd4', '1d4b9314-bd8e-43fa-9f91-3cab63d2a6fe', '2026-01-30T14:58:36.217917+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019c06a8-2afc-7051-8212-4be68125ebd4', '019bbeb4-510c-7526-82cc-55a0480f1215', true, '2026-02-12T01:05:03.953545+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7051-8212-4be68125ebd4', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-30T14:58:36.213184+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7051-8212-4be68125ebd4', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-01-30T14:58:36.217041+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7051-8212-4be68125ebd4', '019c06a8-2af7-72c7-bed1-ec07e4bea469', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c06a8-2afc-7051-8212-4be68125ebd4', '019c06a8-2af4-765d-abe4-dc47e392ad30', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
