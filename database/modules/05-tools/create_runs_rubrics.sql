-- Module: create_runs_rubrics
-- Category: tool
-- Description: create_runs_rubrics MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-76bc-b6e2-a34bca37f12d', 'run_id', '', 'string', true, '', '2026-01-14T18:39:46.698365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('4f85003f-09f0-4a1c-a9f5-efb55c01ed61', '019bbf87-091f-76bc-b6e2-a34bca37f12d', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-731c-a2f6-8ffc74d94378', 'rubric_id', '', 'string', true, '', '2026-01-13T02:51:36.014392+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('37b51357-9e8c-44d2-8d32-1dbd5acb7cf8', '019bbf87-091f-731c-a2f6-8ffc74d94378', 1, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0967-72eb-9d83-366f75833a50', '019bbf87-091f-76bc-b6e2-a34bca37f12d', 'id', '{{ run_id }}', '2026-01-14T18:39:46.698365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0966-7034-9f1e-9aa5955a38aa', '019bbf87-091f-731c-a2f6-8ffc74d94378', 'id', '{{ rubric_id }}', '2026-01-13T02:51:36.014392+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d88-7ea4-9e60-3cd1bb465eec', 'Create a new runs rubrics resource', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d88-7e1e-a7bd-cf102a45dc73', 'create_runs_rubrics', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource, entry) VALUES ('093e0e28-1bd1-49a3-8464-c6322ddac802', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'create_runs_rubrics', 'Create a run-rubric binding', '{}', true, '{019bbf87-091f-731c-a2f6-8ffc74d94378,019bbf87-091f-76bc-b6e2-a34bca37f12d}', '{019bbf87-0966-7034-9f1e-9aa5955a38aa,019bbf87-0967-72eb-9d83-366f75833a50}', NULL, NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('9b97a4c3-8440-4186-b075-433cbb602ef0', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('9b97a4c3-8440-4186-b075-433cbb602ef0', '4f85003f-09f0-4a1c-a9f5-efb55c01ed61', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('9b97a4c3-8440-4186-b075-433cbb602ef0', '37b51357-9e8c-44d2-8d32-1dbd5acb7cf8', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('9b97a4c3-8440-4186-b075-433cbb602ef0', '019bbf87-091f-76bc-b6e2-a34bca37f12d', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('9b97a4c3-8440-4186-b075-433cbb602ef0', '019bbf87-091f-731c-a2f6-8ffc74d94378', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('9b97a4c3-8440-4186-b075-433cbb602ef0', '019bbf87-0967-72eb-9d83-366f75833a50', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('9b97a4c3-8440-4186-b075-433cbb602ef0', '019bbf87-0966-7034-9f1e-9aa5955a38aa', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('9b97a4c3-8440-4186-b075-433cbb602ef0', '019c82b8-5d88-7ea4-9e60-3cd1bb465eec', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('9b97a4c3-8440-4186-b075-433cbb602ef0', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('9b97a4c3-8440-4186-b075-433cbb602ef0', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-02-22T12:36:03.817884+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('9b97a4c3-8440-4186-b075-433cbb602ef0', '019c82b8-5d88-7e1e-a7bd-cf102a45dc73', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('9b97a4c3-8440-4186-b075-433cbb602ef0', '093e0e28-1bd1-49a3-8464-c6322ddac802', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
