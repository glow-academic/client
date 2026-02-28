-- Module: create_benchmark_insights
-- Category: tool
-- Description: create_benchmark_insights MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('6ece1824-ec9c-4e5d-a260-fabd85d83ae0', 'group_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('44ebc7f1-aa68-437c-a4df-eb7c9b9b5091', '6ece1824-ec9c-4e5d-a260-fabd85d83ae0', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('2722b57e-03bf-4ca7-8c97-6f18899728ec', '6ece1824-ec9c-4e5d-a260-fabd85d83ae0', 'group_id', '{{ group_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('6b01726f-3a77-4d87-a4aa-8229f5d4fdb5', 'content', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('cfaf57b2-93b9-4b5a-9466-68e7f6f5bc97', '6b01726f-3a77-4d87-a4aa-8229f5d4fdb5', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('2093afdf-cdb4-4940-96f6-1ef3c437976d', '6b01726f-3a77-4d87-a4aa-8229f5d4fdb5', 'content', '{{ content }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('62f89808-fd02-4f64-a819-33872a966d81', 'Create a new benchmark insights entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('a6bee205-d568-496a-9644-07c445a1126d', 'create_benchmark_insights', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('18ecf5b1-3f1c-439d-bca2-ecd52cabd79f', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_benchmark_insights', 'Create a new benchmark insights entry', '{}', 'create', '{6ece1824-ec9c-4e5d-a260-fabd85d83ae0,6b01726f-3a77-4d87-a4aa-8229f5d4fdb5}', '{2722b57e-03bf-4ca7-8c97-6f18899728ec,2093afdf-cdb4-4940-96f6-1ef3c437976d}', '{}'::text[], '{benchmark_insights}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('0c84af5c-690d-46a4-a32f-e6a67878f2f2', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('0c84af5c-690d-46a4-a32f-e6a67878f2f2', '44ebc7f1-aa68-437c-a4df-eb7c9b9b5091', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('0c84af5c-690d-46a4-a32f-e6a67878f2f2', 'cfaf57b2-93b9-4b5a-9466-68e7f6f5bc97', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('0c84af5c-690d-46a4-a32f-e6a67878f2f2', '6ece1824-ec9c-4e5d-a260-fabd85d83ae0', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('0c84af5c-690d-46a4-a32f-e6a67878f2f2', '6b01726f-3a77-4d87-a4aa-8229f5d4fdb5', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('0c84af5c-690d-46a4-a32f-e6a67878f2f2', '2722b57e-03bf-4ca7-8c97-6f18899728ec', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('0c84af5c-690d-46a4-a32f-e6a67878f2f2', '2093afdf-cdb4-4940-96f6-1ef3c437976d', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('0c84af5c-690d-46a4-a32f-e6a67878f2f2', '018f0004-0001-7000-8000-000000000003', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('0c84af5c-690d-46a4-a32f-e6a67878f2f2', '62f89808-fd02-4f64-a819-33872a966d81', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('0c84af5c-690d-46a4-a32f-e6a67878f2f2', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('0c84af5c-690d-46a4-a32f-e6a67878f2f2', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('0c84af5c-690d-46a4-a32f-e6a67878f2f2', 'a6bee205-d568-496a-9644-07c445a1126d', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('0c84af5c-690d-46a4-a32f-e6a67878f2f2', '18ecf5b1-3f1c-439d-bca2-ecd52cabd79f', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
