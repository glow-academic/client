-- Module: use_descriptions
-- Category: tool
-- Description: use_descriptions MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019c06a8-2afd-74e6-86e4-1a0e5915a04c', 'description_id', 'The ID of the description to link', 'string', true, '', '2026-01-28T22:10:10.283595+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7946-b43b-cca71a600eaf', '019c06a8-2afd-74e6-86e4-1a0e5915a04c', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('dd1476d4-c3ef-48aa-9651-af7096929e22', '019c06a8-2afd-74e6-86e4-1a0e5915a04c', 'id', '{{ description_id }}', '2026-01-30T14:58:36.217917+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c06a8-2af8-7cf3-80c2-78a27a837e00', 'use_descriptions', '2026-01-28T22:10:10.283595+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids) VALUES ('019c06a8-2af5-705d-ae92-7905a846a500', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_descriptions', 'Use an existing description resource instead of creating a new one', '{}', false, '{019c06a8-2afd-74e6-86e4-1a0e5915a04c}', '{dd1476d4-c3ef-48aa-9651-af7096929e22}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c06a8-2afa-7fd6-a8e5-f3f1b1aef023', '2026-01-28T22:10:10.283595+00:00', '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c06a8-2afa-7fd6-a8e5-f3f1b1aef023', '019c4e6b-2c29-7946-b43b-cca71a600eaf', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afa-7fd6-a8e5-f3f1b1aef023', '019c06a8-2afd-74e6-86e4-1a0e5915a04c', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afa-7fd6-a8e5-f3f1b1aef023', 'dd1476d4-c3ef-48aa-9651-af7096929e22', '2026-01-30T14:58:36.217917+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019c06a8-2afa-7fd6-a8e5-f3f1b1aef023', '019bbeb4-510c-7ef2-9ede-574bcc96b9aa', true, '2026-02-12T01:05:03.953545+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c06a8-2afa-7fd6-a8e5-f3f1b1aef023', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-30T14:58:36.213184+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c06a8-2afa-7fd6-a8e5-f3f1b1aef023', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-01-30T14:58:36.217041+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afa-7fd6-a8e5-f3f1b1aef023', '019c06a8-2af8-7cf3-80c2-78a27a837e00', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c06a8-2afa-7fd6-a8e5-f3f1b1aef023', '019c06a8-2af5-705d-ae92-7905a846a500', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
