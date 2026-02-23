-- Module: use_bindings
-- Category: tool
-- Description: use_bindings MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('bc610a9f-aee6-46dd-9c23-e2779738cb0e', 'binding_id', '', 'string', true, '', '2026-02-21T22:16:39.602906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('fe8a3790-b53f-45f5-a68e-f2dfc0cc849b', 'bc610a9f-aee6-46dd-9c23-e2779738cb0e', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('2ccb614e-9cb8-42bd-9ffe-0df5eef4d2e5', 'bc610a9f-aee6-46dd-9c23-e2779738cb0e', 'id', '{{ binding_id }}', '2026-02-21T22:16:39.604747+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d8c-77a4-9926-58ec0fb65002', 'Use an existing bindings resource instead of creating a new one', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d8c-7722-8bf6-ecc71e933fcf', 'use_bindings', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource, entry) VALUES ('37ea0108-e0aa-4d2e-b514-f1a8d2d976aa', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'use_bindings', 'Use an existing binding by its ID', '{}', false, '{bc610a9f-aee6-46dd-9c23-e2779738cb0e}', '{2ccb614e-9cb8-42bd-9ffe-0df5eef4d2e5}', NULL, NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('f3d2c660-f567-4ce5-8a53-5d9604621476', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('f3d2c660-f567-4ce5-8a53-5d9604621476', 'fe8a3790-b53f-45f5-a68e-f2dfc0cc849b', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('f3d2c660-f567-4ce5-8a53-5d9604621476', 'bc610a9f-aee6-46dd-9c23-e2779738cb0e', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('f3d2c660-f567-4ce5-8a53-5d9604621476', '2ccb614e-9cb8-42bd-9ffe-0df5eef4d2e5', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('f3d2c660-f567-4ce5-8a53-5d9604621476', '019c82b8-5d8c-77a4-9926-58ec0fb65002', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('f3d2c660-f567-4ce5-8a53-5d9604621476', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('f3d2c660-f567-4ce5-8a53-5d9604621476', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-02-22T12:36:03.817884+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('f3d2c660-f567-4ce5-8a53-5d9604621476', '019c82b8-5d8c-7722-8bf6-ecc71e933fcf', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('f3d2c660-f567-4ce5-8a53-5d9604621476', '37ea0108-e0aa-4d2e-b514-f1a8d2d976aa', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
