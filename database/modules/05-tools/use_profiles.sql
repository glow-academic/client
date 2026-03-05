-- Module: use_profiles
-- Category: tool
-- Description: use_profiles MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019c4f27-1781-7589-8927-6eb5ddfb1472', 'profile_id', '', 'string', true, '', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4f27-1781-7641-8536-495366315796', '019c4f27-1781-7589-8927-6eb5ddfb1472', 0, '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c4f27-1781-70ce-ae18-47e7b237d42c', 'Use an existing profile resource instead of creating a new one', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c4f27-1781-7002-8ca7-74d2f2bb9f40', 'use_profiles', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('019c4f27-1780-7b67-ae67-f94f42caef57', '2026-02-12T00:01:27.881501+00:00', false, false, true, 'use_profiles', 'Use an existing profile resource instead of creating a new one', '{}', 'link', '{019c4f27-1781-7589-8927-6eb5ddfb1472}', '{8eff5cb8-809f-486e-b3a5-9580f22a3934}', '{profiles}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c4f27-1780-7b87-bd4e-cd7c1efe53e1', '2026-02-12T00:01:27.881501+00:00', '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c4f27-1780-7b87-bd4e-cd7c1efe53e1', '019c4f27-1781-7641-8536-495366315796', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c4f27-1780-7b87-bd4e-cd7c1efe53e1', '019c4f27-1781-7589-8927-6eb5ddfb1472', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019c4f27-1780-7b87-bd4e-cd7c1efe53e1', '019c4f27-1781-70ce-ae18-47e7b237d42c', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_resources_junction
INSERT INTO public.tool_resources_junction (tool_id, resource_id, active, created_at, generated, mcp) VALUES ('019c4f27-1780-7b87-bd4e-cd7c1efe53e1', '019bbeb4-5112-7c71-835b-15a300ba3d2a', '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (tool_id, resource_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('019c4f27-1780-7b87-bd4e-cd7c1efe53e1', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('019c4f27-1780-7b87-bd4e-cd7c1efe53e1', '019d0000-0001-7000-8000-000000000003', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c4f27-1780-7b87-bd4e-cd7c1efe53e1', '019c4f27-1781-7002-8ca7-74d2f2bb9f40', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c4f27-1780-7b87-bd4e-cd7c1efe53e1', '019c4f27-1780-7b67-ae67-f94f42caef57', '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
