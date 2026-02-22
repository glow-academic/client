-- Module: create_groups_rubrics
-- Category: tool
-- Description: create_groups_rubrics MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-7642-aa72-3507ef41149c', 'group_id', '', 'string', true, '', '2026-01-14T18:39:46.698365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('0ea6f60b-a282-4aff-9402-781d34c8a0e7', '019bbf87-091f-7642-aa72-3507ef41149c', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-731c-a2f6-8ffc74d94378', 'rubric_id', '', 'string', true, '', '2026-01-13T02:51:36.014392+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('6d0a529b-38e3-4b2a-8af4-8a89ca885024', '019bbf87-091f-731c-a2f6-8ffc74d94378', 1, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0966-7aee-96c7-e5f169218818', '019bbf87-091f-7642-aa72-3507ef41149c', 'group_id', '{{ group_id }}', '2026-01-14T18:39:46.698365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0966-7034-9f1e-9aa5955a38aa', '019bbf87-091f-731c-a2f6-8ffc74d94378', 'rubric_id', '{{ rubric_id }}', '2026-01-13T02:51:36.014392+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d88-7d4b-8e02-8ed6b617b0d6', 'Create a new groups rubrics resource', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d88-7cc0-b764-1bfde0537c13', 'create_groups_rubrics', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource) VALUES ('cbae0937-636c-4b82-9ecc-ed4f4abadc07', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'create_groups_rubrics', 'Create a group-rubric binding', '{}', true, '{}', '{}', NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('be36bf36-b1d1-4d3e-b568-f4e0db36d0b7', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('be36bf36-b1d1-4d3e-b568-f4e0db36d0b7', '0ea6f60b-a282-4aff-9402-781d34c8a0e7', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('be36bf36-b1d1-4d3e-b568-f4e0db36d0b7', '6d0a529b-38e3-4b2a-8af4-8a89ca885024', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('be36bf36-b1d1-4d3e-b568-f4e0db36d0b7', '019bbf87-091f-7642-aa72-3507ef41149c', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('be36bf36-b1d1-4d3e-b568-f4e0db36d0b7', '019bbf87-091f-731c-a2f6-8ffc74d94378', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('be36bf36-b1d1-4d3e-b568-f4e0db36d0b7', '019bbf87-0966-7aee-96c7-e5f169218818', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('be36bf36-b1d1-4d3e-b568-f4e0db36d0b7', '019bbf87-0966-7034-9f1e-9aa5955a38aa', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('be36bf36-b1d1-4d3e-b568-f4e0db36d0b7', '019c82b8-5d88-7d4b-8e02-8ed6b617b0d6', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('be36bf36-b1d1-4d3e-b568-f4e0db36d0b7', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('be36bf36-b1d1-4d3e-b568-f4e0db36d0b7', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-02-22T12:36:03.817884+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('be36bf36-b1d1-4d3e-b568-f4e0db36d0b7', '019c82b8-5d88-7cc0-b764-1bfde0537c13', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('be36bf36-b1d1-4d3e-b568-f4e0db36d0b7', 'cbae0937-636c-4b82-9ecc-ed4f4abadc07', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
