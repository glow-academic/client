-- Module: use_reasoning_levels
-- Category: tool
-- Description: use_reasoning_levels MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-743d-aaa1-fc3b2f0b8773', 'reasoning_level_id', '', 'string', true, '', '2026-01-13T04:12:23.636838+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4f27-1782-7b3e-9f1d-c4373a660d3d', '019bbf87-091f-743d-aaa1-fc3b2f0b8773', 0, '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c4f27-1782-79d9-95bc-1a91bfc6b6b8', 'Use an existing reasoning level resource instead of creating a new one', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c4f27-1782-7930-ad92-64f36c520593', 'use_reasoning_levels', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('019c4f27-1782-77f6-8e39-d193b8240237', '2026-02-12T00:01:27.881501+00:00', false, false, true, 'use_reasoning_levels', 'Use an existing reasoning level resource instead of creating a new one', '{}', 'link', '{019bbf87-091f-743d-aaa1-fc3b2f0b8773}', '{019bbf87-0967-7b32-bb96-972e1ea88687}', '{reasoning_levels}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c4f27-1782-7823-a811-f3170d6842cc', '2026-02-12T00:01:27.881501+00:00', '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c4f27-1782-7823-a811-f3170d6842cc', '019c4f27-1782-7b3e-9f1d-c4373a660d3d', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c4f27-1782-7823-a811-f3170d6842cc', '019bbf87-091f-743d-aaa1-fc3b2f0b8773', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019c4f27-1782-7823-a811-f3170d6842cc', '019c4f27-1782-79d9-95bc-1a91bfc6b6b8', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_resources_junction
INSERT INTO public.tool_resources_junction (tool_id, resource_id, active, created_at, generated, mcp) VALUES ('019c4f27-1782-7823-a811-f3170d6842cc', '019bbeb4-5113-77a6-82d8-be8928536557', true, '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (tool_id, resource_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('019c4f27-1782-7823-a811-f3170d6842cc', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('019c4f27-1782-7823-a811-f3170d6842cc', '019d0000-0001-7000-8000-000000000003', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c4f27-1782-7823-a811-f3170d6842cc', '019c4f27-1782-7930-ad92-64f36c520593', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c4f27-1782-7823-a811-f3170d6842cc', '019c4f27-1782-77f6-8e39-d193b8240237', true, '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
