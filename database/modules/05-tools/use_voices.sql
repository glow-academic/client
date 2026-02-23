-- Module: use_voices
-- Category: tool
-- Description: use_voices MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-7506-a258-7c1e4bf24a41', 'voice_id', '', 'string', true, '', '2026-01-13T04:12:23.641609+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('aa6734d4-fa55-4aa7-aedc-055cee586883', '019bbf87-091f-7506-a258-7c1e4bf24a41', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-096c-7f84-9de3-3633a716c6be', '019bbf87-091f-7506-a258-7c1e4bf24a41', 'voice_id', '{{ voice_id }}', '2026-01-13T04:12:23.641609+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d89-7f71-b40f-76cb6ac43a4e', 'Use an existing voices resource instead of creating a new one', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d89-7ef2-b717-69303c7bc2d4', 'use_voices', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource) VALUES ('209cfad1-69b5-40be-a980-406888376306', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'use_voices', 'Use an existing voice by its ID', '{}', false, '{019bbf87-091f-7506-a258-7c1e4bf24a41}', '{019bbf87-096c-7f84-9de3-3633a716c6be}', 'voices') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('9a1b42c1-961b-4eb6-95ea-ed447cf6db57', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('9a1b42c1-961b-4eb6-95ea-ed447cf6db57', 'aa6734d4-fa55-4aa7-aedc-055cee586883', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('9a1b42c1-961b-4eb6-95ea-ed447cf6db57', '019bbf87-091f-7506-a258-7c1e4bf24a41', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('9a1b42c1-961b-4eb6-95ea-ed447cf6db57', '019bbf87-096c-7f84-9de3-3633a716c6be', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('9a1b42c1-961b-4eb6-95ea-ed447cf6db57', '019c82b8-5d89-7f71-b40f-76cb6ac43a4e', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('9a1b42c1-961b-4eb6-95ea-ed447cf6db57', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('9a1b42c1-961b-4eb6-95ea-ed447cf6db57', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-02-22T12:36:03.817884+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('9a1b42c1-961b-4eb6-95ea-ed447cf6db57', '019c82b8-5d89-7ef2-b717-69303c7bc2d4', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('9a1b42c1-961b-4eb6-95ea-ed447cf6db57', '209cfad1-69b5-40be-a980-406888376306', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
