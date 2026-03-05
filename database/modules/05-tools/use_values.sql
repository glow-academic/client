-- Module: use_values
-- Category: tool
-- Description: use_values MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('6eeac71b-1c59-4126-83f0-a85f227a2f9d', 'value_id', '', 'string', true, '', '2026-02-21T22:16:39.602906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('d21617ea-f660-40c1-a983-590ae91b9149', '6eeac71b-1c59-4126-83f0-a85f227a2f9d', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('043283bf-bbbb-4a8e-84d6-d2881dfe2da3', '6eeac71b-1c59-4126-83f0-a85f227a2f9d', 'id', '{{ value_id }}', '2026-02-21T22:16:39.604747+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d8b-72d7-ae01-6e119e3b48ec', 'Use an existing values resource instead of creating a new one', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d8b-7255-9908-0b923c433e9c', 'use_values', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('16e7c53f-f4ed-409b-86f9-dfbcdec5e0c3', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'use_values', 'Use an existing value by its ID', '{}', 'link', '{6eeac71b-1c59-4126-83f0-a85f227a2f9d}', '{043283bf-bbbb-4a8e-84d6-d2881dfe2da3}', '{}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('7b111e17-a95b-4a3d-ad3d-ef995a45e258', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('7b111e17-a95b-4a3d-ad3d-ef995a45e258', 'd21617ea-f660-40c1-a983-590ae91b9149', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('7b111e17-a95b-4a3d-ad3d-ef995a45e258', '6eeac71b-1c59-4126-83f0-a85f227a2f9d', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('7b111e17-a95b-4a3d-ad3d-ef995a45e258', '043283bf-bbbb-4a8e-84d6-d2881dfe2da3', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('7b111e17-a95b-4a3d-ad3d-ef995a45e258', '019c82b8-5d8b-72d7-ae01-6e119e3b48ec', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('7b111e17-a95b-4a3d-ad3d-ef995a45e258', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('7b111e17-a95b-4a3d-ad3d-ef995a45e258', '019d0000-0001-7000-8000-000000000003', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('7b111e17-a95b-4a3d-ad3d-ef995a45e258', '019c82b8-5d8b-7255-9908-0b923c433e9c', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('7b111e17-a95b-4a3d-ad3d-ef995a45e258', '16e7c53f-f4ed-409b-86f9-dfbcdec5e0c3', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
