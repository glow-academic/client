-- Module: use_arg_positions
-- Category: tool
-- Description: use_arg_positions MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('ce1cf75b-cd9a-4c00-a352-1092ec80dae3', 'arg_position_id', '', 'string', true, '', '2026-02-21T22:16:39.602906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('bbb38448-9f5f-464a-84ce-9cc860227c3d', 'ce1cf75b-cd9a-4c00-a352-1092ec80dae3', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('f6cb8f3a-553f-4eb1-82a3-79e847e28530', 'ce1cf75b-cd9a-4c00-a352-1092ec80dae3', 'id', '{{ arg_position_id }}', '2026-02-21T22:16:39.604747+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d8c-735e-8fd8-c06a9f7e8665', 'Use an existing arg positions resource instead of creating a new one', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d8c-72db-ba73-a0b48d5c4754', 'use_arg_positions', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids) VALUES ('56263d13-2025-498c-9632-87300a83b5cc', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'use_arg_positions', 'Use an existing arg position by its ID', '{}', false, '{}', '{}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('a729f154-b12e-490e-b2d3-a65e56e71b0e', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('a729f154-b12e-490e-b2d3-a65e56e71b0e', 'bbb38448-9f5f-464a-84ce-9cc860227c3d', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('a729f154-b12e-490e-b2d3-a65e56e71b0e', 'ce1cf75b-cd9a-4c00-a352-1092ec80dae3', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('a729f154-b12e-490e-b2d3-a65e56e71b0e', 'f6cb8f3a-553f-4eb1-82a3-79e847e28530', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('a729f154-b12e-490e-b2d3-a65e56e71b0e', '019c82b8-5d8c-735e-8fd8-c06a9f7e8665', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('a729f154-b12e-490e-b2d3-a65e56e71b0e', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('a729f154-b12e-490e-b2d3-a65e56e71b0e', '019c82b8-5d8c-72db-ba73-a0b48d5c4754', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('a729f154-b12e-490e-b2d3-a65e56e71b0e', '56263d13-2025-498c-9632-87300a83b5cc', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
