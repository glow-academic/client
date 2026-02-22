-- Module: create_scenario_time_limits
-- Category: tool
-- Description: create_scenario_time_limits MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('543d8ecf-24a6-42c1-a5bf-780934e4efeb', 'time_limit', '', 'number', true, '', '2026-02-21T22:16:39.602906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('ab69d08d-62af-429e-8340-ba2a83bba63e', '543d8ecf-24a6-42c1-a5bf-780934e4efeb', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('bb1f8aab-759b-4ba9-9abf-4ccfe6f6ccc8', '543d8ecf-24a6-42c1-a5bf-780934e4efeb', 'time_limit', '{{ time_limit }}', '2026-02-21T22:16:39.604747+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d89-7844-9eb8-c00144d45f2b', 'Create a new scenario time limits resource', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d89-77bb-9b30-a944022e65d9', 'create_scenario_time_limits', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource) VALUES ('71082313-23e6-428e-a32f-86ea85aad6bb', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'create_scenario_time_limits', 'Create a scenario time limit', '{}', true, '{}', '{}', NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('6856a90b-03b9-4dbf-b858-8877217ba428', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('6856a90b-03b9-4dbf-b858-8877217ba428', 'ab69d08d-62af-429e-8340-ba2a83bba63e', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('6856a90b-03b9-4dbf-b858-8877217ba428', '543d8ecf-24a6-42c1-a5bf-780934e4efeb', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('6856a90b-03b9-4dbf-b858-8877217ba428', 'bb1f8aab-759b-4ba9-9abf-4ccfe6f6ccc8', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('6856a90b-03b9-4dbf-b858-8877217ba428', '019c82b8-5d89-7844-9eb8-c00144d45f2b', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('6856a90b-03b9-4dbf-b858-8877217ba428', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('6856a90b-03b9-4dbf-b858-8877217ba428', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-02-22T12:36:03.817884+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('6856a90b-03b9-4dbf-b858-8877217ba428', '019c82b8-5d89-77bb-9b30-a944022e65d9', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('6856a90b-03b9-4dbf-b858-8877217ba428', '71082313-23e6-428e-a32f-86ea85aad6bb', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
