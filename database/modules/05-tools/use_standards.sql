-- Module: use_standards
-- Category: tool
-- Description: use_standards MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('9cc9417b-943e-4b4f-97de-c93d184c7e36', 'standard_id', '', 'string', true, '', '2026-02-21T22:16:39.602906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('beed06ed-f4c5-49bc-8556-6e0b2c8dbfa2', '9cc9417b-943e-4b4f-97de-c93d184c7e36', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('c73fb5bc-e65f-4f28-b78c-aa0e56549123', '9cc9417b-943e-4b4f-97de-c93d184c7e36', 'id', '{{ standard_id }}', '2026-02-21T22:16:39.604747+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d8b-7cc1-8fa1-17fee2b31222', 'Use an existing standards resource instead of creating a new one', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d8b-7c3e-899c-6098f793fb35', 'use_standards', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('e234b7b3-fd49-4179-9a96-ea5c355bf919', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'use_standards', 'Use an existing standard by its ID', '{}', 'link', '{9cc9417b-943e-4b4f-97de-c93d184c7e36}', '{c73fb5bc-e65f-4f28-b78c-aa0e56549123}', '{}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('21bdf1f8-3ffe-443d-9fea-9a96725eac3d', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('21bdf1f8-3ffe-443d-9fea-9a96725eac3d', 'beed06ed-f4c5-49bc-8556-6e0b2c8dbfa2', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('21bdf1f8-3ffe-443d-9fea-9a96725eac3d', '9cc9417b-943e-4b4f-97de-c93d184c7e36', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('21bdf1f8-3ffe-443d-9fea-9a96725eac3d', 'c73fb5bc-e65f-4f28-b78c-aa0e56549123', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, descriptions_id, created_at, generated, mcp, active) VALUES ('21bdf1f8-3ffe-443d-9fea-9a96725eac3d', '019c82b8-5d8b-7cc1-8fa1-17fee2b31222', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, descriptions_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flags_id, created_at, generated, mcp, active) VALUES ('21bdf1f8-3ffe-443d-9fea-9a96725eac3d', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flags_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operations_id, created_at, active, generated, mcp) VALUES ('21bdf1f8-3ffe-443d-9fea-9a96725eac3d', '019d0000-0001-7000-8000-000000000003', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operations_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, names_id, created_at, generated, mcp, active) VALUES ('21bdf1f8-3ffe-443d-9fea-9a96725eac3d', '019c82b8-5d8b-7c3e-899c-6098f793fb35', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, names_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('21bdf1f8-3ffe-443d-9fea-9a96725eac3d', 'e234b7b3-fd49-4179-9a96-ea5c355bf919', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
