-- Module: use_simulation_positions
-- Category: tool
-- Description: use_simulation_positions MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('73daa13b-c37a-42dc-8d55-368bc5a629af', 'simulation_position_id', '', 'string', true, '', '2026-02-21T22:16:39.602906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('8049f1da-3434-42e1-88f0-bf156ce31a85', '73daa13b-c37a-42dc-8d55-368bc5a629af', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('01c567f0-8fec-4522-84f0-85fe8bc9eaeb', '73daa13b-c37a-42dc-8d55-368bc5a629af', 'id', '{{ simulation_position_id }}', '2026-02-21T22:16:39.604747+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d8a-75e1-8a1b-530a2d4fe922', 'Use an existing simulation positions resource instead of creating a new one', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d8a-7560-9106-558929e659cc', 'use_simulation_positions', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource) VALUES ('45902714-adea-43d4-8068-42a1913f6a45', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'use_simulation_positions', 'Use an existing simulation position by its ID', '{}', false, '{}', '{}', NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('e3be4229-a932-4544-b9fe-612e2e512eab', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('e3be4229-a932-4544-b9fe-612e2e512eab', '8049f1da-3434-42e1-88f0-bf156ce31a85', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('e3be4229-a932-4544-b9fe-612e2e512eab', '73daa13b-c37a-42dc-8d55-368bc5a629af', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('e3be4229-a932-4544-b9fe-612e2e512eab', '01c567f0-8fec-4522-84f0-85fe8bc9eaeb', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('e3be4229-a932-4544-b9fe-612e2e512eab', '019c82b8-5d8a-75e1-8a1b-530a2d4fe922', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('e3be4229-a932-4544-b9fe-612e2e512eab', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('e3be4229-a932-4544-b9fe-612e2e512eab', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-02-22T12:36:03.817884+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('e3be4229-a932-4544-b9fe-612e2e512eab', '019c82b8-5d8a-7560-9106-558929e659cc', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('e3be4229-a932-4544-b9fe-612e2e512eab', '45902714-adea-43d4-8068-42a1913f6a45', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
