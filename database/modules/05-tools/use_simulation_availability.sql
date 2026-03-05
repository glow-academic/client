-- Module: use_simulation_availability
-- Category: tool
-- Description: use_simulation_availability MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('30313b69-ba2a-4cd9-8719-e6b4d15daba6', 'simulation_availability_id', '', 'string', true, '', '2026-02-21T22:16:39.602906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('d7e0d955-5088-4c3c-b1f8-e35ba707faa7', '30313b69-ba2a-4cd9-8719-e6b4d15daba6', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('810748a1-d6ba-402e-a315-648d8678c201', '30313b69-ba2a-4cd9-8719-e6b4d15daba6', 'id', '{{ simulation_availability_id }}', '2026-02-21T22:16:39.604747+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d8a-7490-a57c-a3e539e6c2ae', 'Use an existing simulation availability resource instead of creating a new one', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d8a-7411-80f0-c2fe4b03ea49', 'use_simulation_availability', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('35d3af95-db6a-430b-bc78-2fd51c5ff45c', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'use_simulation_availability', 'Use an existing simulation availability by its ID', '{}', 'link', '{30313b69-ba2a-4cd9-8719-e6b4d15daba6}', '{810748a1-d6ba-402e-a315-648d8678c201}', '{simulation_availability}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('966da328-662c-4bd6-b749-042205eb0fb0', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('966da328-662c-4bd6-b749-042205eb0fb0', 'd7e0d955-5088-4c3c-b1f8-e35ba707faa7', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('966da328-662c-4bd6-b749-042205eb0fb0', '30313b69-ba2a-4cd9-8719-e6b4d15daba6', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('966da328-662c-4bd6-b749-042205eb0fb0', '810748a1-d6ba-402e-a315-648d8678c201', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('966da328-662c-4bd6-b749-042205eb0fb0', '019c82b8-5d8a-7490-a57c-a3e539e6c2ae', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_resources_junction
INSERT INTO public.tool_resources_junction (tool_id, resource_id, active, created_at, generated, mcp) VALUES ('966da328-662c-4bd6-b749-042205eb0fb0', '9f42547f-1e25-49ba-97dc-8b85e1398666', '2026-02-23T14:09:37.222956+00:00', false, false) ON CONFLICT (tool_id, resource_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('966da328-662c-4bd6-b749-042205eb0fb0', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('966da328-662c-4bd6-b749-042205eb0fb0', '019d0000-0001-7000-8000-000000000003', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('966da328-662c-4bd6-b749-042205eb0fb0', '019c82b8-5d8a-7411-80f0-c2fe4b03ea49', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('966da328-662c-4bd6-b749-042205eb0fb0', '35d3af95-db6a-430b-bc78-2fd51c5ff45c', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
