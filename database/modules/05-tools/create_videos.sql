-- Module: create_videos
-- Category: tool
-- Description: create_videos MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-73a9-b24d-e7ab977a5273', 'name', '', 'string', true, '', '2026-01-05T00:28:02.003807+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('c503bfb8-e9cc-477b-a3b6-c8d7cde0338c', '019bbf87-091e-73a9-b24d-e7ab977a5273', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-79c6-9b3e-d5b2865e3956', 'length_seconds', '', 'number', true, '', '2026-01-06T15:55:22.215511+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('aa030674-a141-4c2d-8ab7-36db0a56b2dd', '019bbf87-091e-79c6-9b3e-d5b2865e3956', 1, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-7373-8a48-37437e3ffde1', 'description', '', 'string', false, '', '2026-01-05T00:28:02.003807+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('9e0c1a7c-5176-4c78-bf4e-8d23edbb011b', '019bbf87-091e-7373-8a48-37437e3ffde1', 2, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0964-77cd-ab26-d467f04ec130', '019bbf87-091e-73a9-b24d-e7ab977a5273', 'name', '{{ name }}', '2026-01-14T18:39:46.698365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-096c-7c49-8340-67b41f71b130', '019bbf87-091e-79c6-9b3e-d5b2865e3956', 'length_seconds', '', '2026-01-06T15:55:22.215511+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0964-7ddd-9ac0-ca38f131c8b8', '019bbf87-091e-7373-8a48-37437e3ffde1', 'description', '{{ description }}', '2026-01-14T18:39:46.698365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d88-791c-99ce-88d7ab984971', 'Create a new videos resource', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d88-788d-a3e0-9f58c540a763', 'create_videos', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource, entry) VALUES ('52bd3f2d-8a5f-4a90-940a-a334975adc2a', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'create_videos', 'Create a new video resource', '{}', true, '{019bbf87-091e-7373-8a48-37437e3ffde1,019bbf87-091e-73a9-b24d-e7ab977a5273,019bbf87-091e-79c6-9b3e-d5b2865e3956}', '{019bbf87-0964-77cd-ab26-d467f04ec130,019bbf87-0964-7ddd-9ac0-ca38f131c8b8,019bbf87-096c-7c49-8340-67b41f71b130}', NULL, NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('f531a8fd-df85-41e9-9d92-4bcea398ac22', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('f531a8fd-df85-41e9-9d92-4bcea398ac22', 'c503bfb8-e9cc-477b-a3b6-c8d7cde0338c', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('f531a8fd-df85-41e9-9d92-4bcea398ac22', 'aa030674-a141-4c2d-8ab7-36db0a56b2dd', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('f531a8fd-df85-41e9-9d92-4bcea398ac22', '9e0c1a7c-5176-4c78-bf4e-8d23edbb011b', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('f531a8fd-df85-41e9-9d92-4bcea398ac22', '019bbf87-091e-73a9-b24d-e7ab977a5273', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('f531a8fd-df85-41e9-9d92-4bcea398ac22', '019bbf87-091e-79c6-9b3e-d5b2865e3956', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('f531a8fd-df85-41e9-9d92-4bcea398ac22', '019bbf87-091e-7373-8a48-37437e3ffde1', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('f531a8fd-df85-41e9-9d92-4bcea398ac22', '019bbf87-0964-77cd-ab26-d467f04ec130', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('f531a8fd-df85-41e9-9d92-4bcea398ac22', '019bbf87-096c-7c49-8340-67b41f71b130', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('f531a8fd-df85-41e9-9d92-4bcea398ac22', '019bbf87-0964-7ddd-9ac0-ca38f131c8b8', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('f531a8fd-df85-41e9-9d92-4bcea398ac22', '019c82b8-5d88-791c-99ce-88d7ab984971', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('f531a8fd-df85-41e9-9d92-4bcea398ac22', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('f531a8fd-df85-41e9-9d92-4bcea398ac22', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-02-22T12:36:03.817884+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('f531a8fd-df85-41e9-9d92-4bcea398ac22', '019c82b8-5d88-788d-a3e0-9f58c540a763', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('f531a8fd-df85-41e9-9d92-4bcea398ac22', '52bd3f2d-8a5f-4a90-940a-a334975adc2a', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
