-- Module: use_runs
-- Category: tool
-- Description: use_runs MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-76bc-b6e2-a34bca37f12d', 'run_id', '', 'string', true, '', '2026-01-14T18:39:46.698365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4f27-1783-7f53-8b45-e185782cc7c6', '019bbf87-091f-76bc-b6e2-a34bca37f12d', 0, '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c4f27-1783-7d59-9602-a3bee4dbbd02', 'Use an existing run resource instead of creating a new one', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c4f27-1783-7cbe-a208-08aa5ffaa52e', 'use_runs', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('019c4f27-1783-7c26-b0a1-3103c94891b6', '2026-02-12T00:01:27.881501+00:00', false, false, true, 'use_runs', 'Use an existing run resource instead of creating a new one', '{}', 'link', '{019bbf87-091f-76bc-b6e2-a34bca37f12d}', '{019bbf87-0967-72eb-9d83-366f75833a50}', '{runs}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c4f27-1783-7c4a-b83d-805f930b95d5', '2026-02-12T00:01:27.881501+00:00', '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c4f27-1783-7c4a-b83d-805f930b95d5', '019c4f27-1783-7f53-8b45-e185782cc7c6', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c4f27-1783-7c4a-b83d-805f930b95d5', '019bbf87-091f-76bc-b6e2-a34bca37f12d', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019c4f27-1783-7c4a-b83d-805f930b95d5', '019c4f27-1783-7d59-9602-a3bee4dbbd02', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, descriptions_id) DO NOTHING;
-- tool_resources_junction
INSERT INTO public.tool_resources_junction (tool_id, resources_id, active, created_at, generated, mcp) VALUES ('019c4f27-1783-7c4a-b83d-805f930b95d5', '019bbeb4-5114-72d4-b96a-9fd8355f0946', true, '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (tool_id, resources_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flags_id, created_at, generated, mcp, active) VALUES ('019c4f27-1783-7c4a-b83d-805f930b95d5', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, flags_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operations_id, created_at, active, generated, mcp) VALUES ('019c4f27-1783-7c4a-b83d-805f930b95d5', '019d0000-0001-7000-8000-000000000003', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operations_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, names_id, created_at, generated, mcp, active) VALUES ('019c4f27-1783-7c4a-b83d-805f930b95d5', '019c4f27-1783-7cbe-a208-08aa5ffaa52e', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, names_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c4f27-1783-7c4a-b83d-805f930b95d5', '019c4f27-1783-7c26-b0a1-3103c94891b6', true, '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
