-- Module: use_args_outputs
-- Category: tool
-- Description: use_args_outputs MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('16bbeddb-ffcc-4ca9-8b78-7febd1fa5131', 'args_output_id', '', 'string', true, '', '2026-02-21T22:16:39.602906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('ddb44af3-c84a-4403-bd98-da7897b9f20e', '16bbeddb-ffcc-4ca9-8b78-7febd1fa5131', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('7b814c3c-f9e5-4fdc-8955-27193d488106', '16bbeddb-ffcc-4ca9-8b78-7febd1fa5131', 'id', '{{ args_output_id }}', '2026-02-21T22:16:39.604747+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d8c-7658-90e4-f00e30afd5ae', 'Use an existing args outputs resource instead of creating a new one', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d8c-75cd-9631-3645ef73d41b', 'use_args_outputs', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource, entry) VALUES ('1faeefb9-77ee-4a64-9a35-55a9cba2c12c', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'use_args_outputs', 'Use an existing args output by its ID', '{}', false, '{16bbeddb-ffcc-4ca9-8b78-7febd1fa5131}', '{7b814c3c-f9e5-4fdc-8955-27193d488106}', NULL, NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('a0c17ebd-38dd-47a2-a0be-cc60dd0b267f', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('a0c17ebd-38dd-47a2-a0be-cc60dd0b267f', 'ddb44af3-c84a-4403-bd98-da7897b9f20e', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('a0c17ebd-38dd-47a2-a0be-cc60dd0b267f', '16bbeddb-ffcc-4ca9-8b78-7febd1fa5131', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('a0c17ebd-38dd-47a2-a0be-cc60dd0b267f', '7b814c3c-f9e5-4fdc-8955-27193d488106', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('a0c17ebd-38dd-47a2-a0be-cc60dd0b267f', '019c82b8-5d8c-7658-90e4-f00e30afd5ae', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('a0c17ebd-38dd-47a2-a0be-cc60dd0b267f', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('a0c17ebd-38dd-47a2-a0be-cc60dd0b267f', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-02-22T12:36:03.817884+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('a0c17ebd-38dd-47a2-a0be-cc60dd0b267f', '019c82b8-5d8c-75cd-9631-3645ef73d41b', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('a0c17ebd-38dd-47a2-a0be-cc60dd0b267f', '1faeefb9-77ee-4a64-9a35-55a9cba2c12c', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
