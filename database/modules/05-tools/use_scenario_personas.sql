-- Module: use_scenario_personas
-- Category: tool
-- Description: use_scenario_personas MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('a92290bc-f250-4419-a42d-f1c4a75bde4d', 'scenario_persona_id', '', 'string', true, '', '2026-02-21T22:16:39.602906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('70da11a0-0738-47e5-87e1-4e5c8f3afed8', 'a92290bc-f250-4419-a42d-f1c4a75bde4d', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('98af36dc-6d1f-49e4-8469-5b027d13c1bc', 'a92290bc-f250-4419-a42d-f1c4a75bde4d', 'id', '{{ scenario_persona_id }}', '2026-02-21T22:16:39.604747+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d8c-7211-9348-490bffb0557a', 'Use an existing scenario personas resource instead of creating a new one', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d8c-718f-ab14-123e17653677', 'use_scenario_personas', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids) VALUES ('b6f5bfc5-65ee-4ee4-afab-25b2a528c6ac', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'use_scenario_personas', 'Use an existing scenario-persona binding by its ID', '{}', false, '{}', '{}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('1390af29-8586-487a-91c4-7b34f02d00d7', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('1390af29-8586-487a-91c4-7b34f02d00d7', '70da11a0-0738-47e5-87e1-4e5c8f3afed8', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('1390af29-8586-487a-91c4-7b34f02d00d7', 'a92290bc-f250-4419-a42d-f1c4a75bde4d', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('1390af29-8586-487a-91c4-7b34f02d00d7', '98af36dc-6d1f-49e4-8469-5b027d13c1bc', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('1390af29-8586-487a-91c4-7b34f02d00d7', '019c82b8-5d8c-7211-9348-490bffb0557a', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('1390af29-8586-487a-91c4-7b34f02d00d7', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('1390af29-8586-487a-91c4-7b34f02d00d7', '019c82b8-5d8c-718f-ab14-123e17653677', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('1390af29-8586-487a-91c4-7b34f02d00d7', 'b6f5bfc5-65ee-4ee4-afab-25b2a528c6ac', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
