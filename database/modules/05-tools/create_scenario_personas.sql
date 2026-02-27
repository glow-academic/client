-- Module: create_scenario_personas
-- Category: tool
-- Description: create_scenario_personas MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-7380-834d-0e0eb6b97d0c', 'scenario_id', '', 'string', true, '', '2026-01-13T02:51:36.015837+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('382b233e-c9c3-49c1-ab5b-ac7da5a7be8d', '019bbf87-091f-7380-834d-0e0eb6b97d0c', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019c0a2d-fc3b-7e62-bcb0-75124c777dcd', 'persona_id', 'The persona ID to attribute this content to (see Personas section in context above)', 'string', true, '', '2026-01-29T14:35:11.795021+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('b00a308e-c858-42df-a892-690af71a3610', '019c0a2d-fc3b-7e62-bcb0-75124c777dcd', 1, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-096b-734d-b031-69ff82f593a4', '019bbf87-091f-7380-834d-0e0eb6b97d0c', 'scenario_id', '{{ scenario_id }}', '2026-01-13T02:51:36.015837+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019c26f6-fecc-7f2a-a62f-d5fe00b4837e', '019c0a2d-fc3b-7e62-bcb0-75124c777dcd', 'persona_id', '{{ persona_id }}', '2026-02-04T04:44:07.231669+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d89-758f-9250-21c5de200c1c', 'Create a new scenario personas resource', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d89-7503-9c4d-eb7d379d18eb', 'create_scenario_personas', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('9a1122c5-f078-4eae-ae6a-1ce90068d8f2', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'create_scenario_personas', 'Create a scenario-persona binding', '{}', 'create', '{019bbf87-091f-7380-834d-0e0eb6b97d0c,019c0a2d-fc3b-7e62-bcb0-75124c777dcd}', '{019bbf87-096b-734d-b031-69ff82f593a4,019c26f6-fecc-7f2a-a62f-d5fe00b4837e}', '{scenario_personas}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('e56223e5-dffa-4a04-9b2b-387d36229580', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('e56223e5-dffa-4a04-9b2b-387d36229580', '382b233e-c9c3-49c1-ab5b-ac7da5a7be8d', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('e56223e5-dffa-4a04-9b2b-387d36229580', 'b00a308e-c858-42df-a892-690af71a3610', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('e56223e5-dffa-4a04-9b2b-387d36229580', '019bbf87-091f-7380-834d-0e0eb6b97d0c', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('e56223e5-dffa-4a04-9b2b-387d36229580', '019c0a2d-fc3b-7e62-bcb0-75124c777dcd', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('e56223e5-dffa-4a04-9b2b-387d36229580', '019bbf87-096b-734d-b031-69ff82f593a4', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('e56223e5-dffa-4a04-9b2b-387d36229580', '019c26f6-fecc-7f2a-a62f-d5fe00b4837e', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('e56223e5-dffa-4a04-9b2b-387d36229580', '019c82b8-5d89-758f-9250-21c5de200c1c', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_resources_junction
INSERT INTO public.tool_resources_junction (tool_id, resource_id, active, created_at, generated, mcp) VALUES ('e56223e5-dffa-4a04-9b2b-387d36229580', '019c4f61-51dd-733a-baea-c994866d65c0', true, '2026-02-23T14:09:37.222956+00:00', false, false) ON CONFLICT (tool_id, resource_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('e56223e5-dffa-4a04-9b2b-387d36229580', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('e56223e5-dffa-4a04-9b2b-387d36229580', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('e56223e5-dffa-4a04-9b2b-387d36229580', '019c82b8-5d89-7503-9c4d-eb7d379d18eb', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('e56223e5-dffa-4a04-9b2b-387d36229580', '9a1122c5-f078-4eae-ae6a-1ce90068d8f2', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
