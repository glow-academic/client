-- Module: use_endpoints
-- Category: tool
-- Description: use_endpoints MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('c4416a36-58e3-429a-810d-3a2c5a45d955', 'endpoint_id', '', 'string', true, '', '2026-02-21T22:16:39.602906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('7be2601e-5d31-4082-ae63-7f761f0a0cf7', 'c4416a36-58e3-429a-810d-3a2c5a45d955', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('065c41fe-713c-465e-b8ea-0bb5c5063314', 'c4416a36-58e3-429a-810d-3a2c5a45d955', 'id', '{{ endpoint_id }}', '2026-02-21T22:16:39.604747+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d8b-78cd-95d1-091ebcacddd1', 'Use an existing endpoints resource instead of creating a new one', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d8b-7848-954f-d7030fe75e9d', 'use_endpoints', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource) VALUES ('99022425-d75d-40f1-9886-cba63505a99e', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'use_endpoints', 'Use an existing endpoint by its ID', '{}', false, '{c4416a36-58e3-429a-810d-3a2c5a45d955}', '{065c41fe-713c-465e-b8ea-0bb5c5063314}', NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('9c599e7b-2814-442b-a4f6-3b5e9bf27f64', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('9c599e7b-2814-442b-a4f6-3b5e9bf27f64', '7be2601e-5d31-4082-ae63-7f761f0a0cf7', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('9c599e7b-2814-442b-a4f6-3b5e9bf27f64', 'c4416a36-58e3-429a-810d-3a2c5a45d955', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('9c599e7b-2814-442b-a4f6-3b5e9bf27f64', '065c41fe-713c-465e-b8ea-0bb5c5063314', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('9c599e7b-2814-442b-a4f6-3b5e9bf27f64', '019c82b8-5d8b-78cd-95d1-091ebcacddd1', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('9c599e7b-2814-442b-a4f6-3b5e9bf27f64', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('9c599e7b-2814-442b-a4f6-3b5e9bf27f64', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-02-22T12:36:03.817884+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('9c599e7b-2814-442b-a4f6-3b5e9bf27f64', '019c82b8-5d8b-7848-954f-d7030fe75e9d', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('9c599e7b-2814-442b-a4f6-3b5e9bf27f64', '99022425-d75d-40f1-9886-cba63505a99e', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
