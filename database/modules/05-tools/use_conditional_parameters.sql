-- Module: use_conditional_parameters
-- Category: tool
-- Description: use_conditional_parameters MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('ee76c7e0-e051-4d95-abbe-0d076df12c32', 'conditional_parameter_id', '', 'string', true, '', '2026-02-21T22:16:39.602906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('8a27a676-d39e-4a23-a5d7-2cab40a2c631', 'ee76c7e0-e051-4d95-abbe-0d076df12c32', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('a991539c-5fd7-4fda-a123-c179d5c6cd19', 'ee76c7e0-e051-4d95-abbe-0d076df12c32', 'id', '{{ conditional_parameter_id }}', '2026-02-21T22:16:39.604747+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d8a-7eec-9097-f506391af4d0', 'Use an existing conditional parameters resource instead of creating a new one', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d8a-7e6d-9a1c-c2b388408c7b', 'use_conditional_parameters', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource) VALUES ('a52e42b8-ecdc-4836-861a-e82007220ec5', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'use_conditional_parameters', 'Use an existing conditional parameter by its ID', '{}', false, '{ee76c7e0-e051-4d95-abbe-0d076df12c32}', '{a991539c-5fd7-4fda-a123-c179d5c6cd19}', NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('6ae56913-1860-4a51-9d50-4d21471879f1', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('6ae56913-1860-4a51-9d50-4d21471879f1', '8a27a676-d39e-4a23-a5d7-2cab40a2c631', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('6ae56913-1860-4a51-9d50-4d21471879f1', 'ee76c7e0-e051-4d95-abbe-0d076df12c32', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('6ae56913-1860-4a51-9d50-4d21471879f1', 'a991539c-5fd7-4fda-a123-c179d5c6cd19', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('6ae56913-1860-4a51-9d50-4d21471879f1', '019c82b8-5d8a-7eec-9097-f506391af4d0', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('6ae56913-1860-4a51-9d50-4d21471879f1', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('6ae56913-1860-4a51-9d50-4d21471879f1', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-02-22T12:36:03.817884+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('6ae56913-1860-4a51-9d50-4d21471879f1', '019c82b8-5d8a-7e6d-9a1c-c2b388408c7b', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('6ae56913-1860-4a51-9d50-4d21471879f1', 'a52e42b8-ecdc-4836-861a-e82007220ec5', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
