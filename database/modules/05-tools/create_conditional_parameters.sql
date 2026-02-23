-- Module: create_conditional_parameters
-- Category: tool
-- Description: create_conditional_parameters MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-73fa-8792-299a4c6e4bc0', 'parameter_id', '', 'string', true, '', '2026-01-13T03:25:29.718071+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('8c553590-2214-4533-838a-5fd564769511', '019bbf87-091f-73fa-8792-299a4c6e4bc0', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-096c-7e02-bf85-9e4044aaf175', '019bbf87-091f-73fa-8792-299a4c6e4bc0', 'parameter_id', '{{ parameter_id }}', '2026-01-13T03:25:29.718071+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d85-7ff0-9aae-58aa55e4f87a', 'Create a new conditional parameters resource', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-7c4f-b08a-816e421efcc3', 'create_conditional_parameters', '2026-01-13T03:25:29.722192+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource) VALUES ('f3aeb0a8-1ca0-4dc7-9f8d-61b4f8537d43', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'create_conditional_parameters', 'Create a conditional parameter binding', '{}', true, '{019bbf87-091f-73fa-8792-299a4c6e4bc0}', '{019bbf87-096c-7e02-bf85-9e4044aaf175}', NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('56171eeb-1c3e-429d-a163-5b625fa78a2c', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('56171eeb-1c3e-429d-a163-5b625fa78a2c', '8c553590-2214-4533-838a-5fd564769511', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('56171eeb-1c3e-429d-a163-5b625fa78a2c', '019bbf87-091f-73fa-8792-299a4c6e4bc0', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('56171eeb-1c3e-429d-a163-5b625fa78a2c', '019bbf87-096c-7e02-bf85-9e4044aaf175', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('56171eeb-1c3e-429d-a163-5b625fa78a2c', '019c82b8-5d85-7ff0-9aae-58aa55e4f87a', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('56171eeb-1c3e-429d-a163-5b625fa78a2c', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('56171eeb-1c3e-429d-a163-5b625fa78a2c', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-02-22T12:36:03.817884+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('56171eeb-1c3e-429d-a163-5b625fa78a2c', '019bbabc-5a32-7c4f-b08a-816e421efcc3', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('56171eeb-1c3e-429d-a163-5b625fa78a2c', 'f3aeb0a8-1ca0-4dc7-9f8d-61b4f8537d43', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
