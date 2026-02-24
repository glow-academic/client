-- Module: use_protocols
-- Category: tool
-- Description: use_protocols MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('6af5cbea-a239-4bb4-a064-36df3118f364', 'protocol_id', '', 'string', true, '', '2026-02-21T22:16:39.602906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('08c52002-09bb-46ba-942b-43595ab85019', '6af5cbea-a239-4bb4-a064-36df3118f364', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('6983fab6-a059-4cf6-af2a-6a18b51663f9', '6af5cbea-a239-4bb4-a064-36df3118f364', 'id', '{{ protocol_id }}', '2026-02-21T22:16:39.604747+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d8a-71f8-8fe8-231408a9d826', 'Use an existing protocols resource instead of creating a new one', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d8a-717c-ac19-6bcf5eecc5e5', 'use_protocols', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource, entry, artifact) VALUES ('ee01c972-7196-4fdd-ad4d-a55a41523396', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'use_protocols', 'Use an existing protocol by its ID', '{}', false, '{6af5cbea-a239-4bb4-a064-36df3118f364}', '{6983fab6-a059-4cf6-af2a-6a18b51663f9}', NULL, NULL, NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('5c469808-5e5a-4801-952b-fa79e1dc98d1', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('5c469808-5e5a-4801-952b-fa79e1dc98d1', '08c52002-09bb-46ba-942b-43595ab85019', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('5c469808-5e5a-4801-952b-fa79e1dc98d1', '6af5cbea-a239-4bb4-a064-36df3118f364', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('5c469808-5e5a-4801-952b-fa79e1dc98d1', '6983fab6-a059-4cf6-af2a-6a18b51663f9', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('5c469808-5e5a-4801-952b-fa79e1dc98d1', '019c82b8-5d8a-71f8-8fe8-231408a9d826', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('5c469808-5e5a-4801-952b-fa79e1dc98d1', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('5c469808-5e5a-4801-952b-fa79e1dc98d1', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-02-22T12:36:03.817884+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('5c469808-5e5a-4801-952b-fa79e1dc98d1', '019c82b8-5d8a-717c-ac19-6bcf5eecc5e5', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('5c469808-5e5a-4801-952b-fa79e1dc98d1', 'ee01c972-7196-4fdd-ad4d-a55a41523396', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
