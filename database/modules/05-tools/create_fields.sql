-- Module: create_fields
-- Category: tool
-- Description: create_fields MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-7940-9825-c757e353ed6d', 'id', '', 'string', true, '', '2026-01-07T07:25:51.781825+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('fede816d-a7a6-43e6-b081-243490f3ae78', '019bbf87-091e-7940-9825-c757e353ed6d', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d88-7a7c-9d44-82a70c5ebeed', 'Create a new fields resource', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d88-79ee-8ebb-9503b0f16f69', 'create_fields', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource) VALUES ('98194c0a-97af-4bf8-8c30-12a87bfbacb2', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'create_fields', 'Create a new field binding', '{}', true, '{}', '{}', NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('b3452c85-3aa4-410d-be88-aa22ef824930', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('b3452c85-3aa4-410d-be88-aa22ef824930', 'fede816d-a7a6-43e6-b081-243490f3ae78', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('b3452c85-3aa4-410d-be88-aa22ef824930', '019bbf87-091e-7940-9825-c757e353ed6d', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('b3452c85-3aa4-410d-be88-aa22ef824930', '019c82b8-5d88-7a7c-9d44-82a70c5ebeed', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('b3452c85-3aa4-410d-be88-aa22ef824930', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('b3452c85-3aa4-410d-be88-aa22ef824930', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-02-22T12:36:03.817884+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('b3452c85-3aa4-410d-be88-aa22ef824930', '019c82b8-5d88-79ee-8ebb-9503b0f16f69', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('b3452c85-3aa4-410d-be88-aa22ef824930', '98194c0a-97af-4bf8-8c30-12a87bfbacb2', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
