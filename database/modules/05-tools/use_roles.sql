-- Module: use_roles
-- Category: tool
-- Description: use_roles MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('b92e7dbb-06f5-495d-b4e6-b9c5fbaf999a', 'role_id', '', 'string', true, '', '2026-02-21T22:16:39.602906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('eaa39c77-09bf-4e4a-8a23-d552fa1acbb8', 'b92e7dbb-06f5-495d-b4e6-b9c5fbaf999a', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('ef8befff-9306-453d-b960-fed06e2294f5', 'b92e7dbb-06f5-495d-b4e6-b9c5fbaf999a', 'id', '{{ role_id }}', '2026-02-21T22:16:39.604747+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d8b-7779-95d5-d82f676bb379', 'Use an existing roles resource instead of creating a new one', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d8b-7636-a7f0-3c99fb1d4f62', 'use_roles', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource) VALUES ('4f07ae5c-a08c-4dee-a8f8-60f20dbf96e2', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'use_roles', 'Use an existing role by its ID', '{}', false, '{b92e7dbb-06f5-495d-b4e6-b9c5fbaf999a}', '{ef8befff-9306-453d-b960-fed06e2294f5}', NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('26737d74-4b5c-47f6-966b-c0f13fa2ebee', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('26737d74-4b5c-47f6-966b-c0f13fa2ebee', 'eaa39c77-09bf-4e4a-8a23-d552fa1acbb8', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('26737d74-4b5c-47f6-966b-c0f13fa2ebee', 'b92e7dbb-06f5-495d-b4e6-b9c5fbaf999a', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('26737d74-4b5c-47f6-966b-c0f13fa2ebee', 'ef8befff-9306-453d-b960-fed06e2294f5', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('26737d74-4b5c-47f6-966b-c0f13fa2ebee', '019c82b8-5d8b-7779-95d5-d82f676bb379', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('26737d74-4b5c-47f6-966b-c0f13fa2ebee', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('26737d74-4b5c-47f6-966b-c0f13fa2ebee', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-02-22T12:36:03.817884+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('26737d74-4b5c-47f6-966b-c0f13fa2ebee', '019c82b8-5d8b-7636-a7f0-3c99fb1d4f62', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('26737d74-4b5c-47f6-966b-c0f13fa2ebee', '4f07ae5c-a08c-4dee-a8f8-60f20dbf96e2', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
