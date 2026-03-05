-- Module: use_auths
-- Category: tool
-- Description: use_auths MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019c4f27-1773-7e98-80e4-c94c03867ee0', 'auth_id', '', 'string', true, '', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4f27-1774-702a-af43-6c0ed5dbefb3', '019c4f27-1773-7e98-80e4-c94c03867ee0', 0, '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c4f27-1773-7c0b-b97c-ef1106ff189a', 'Use an existing auth resource instead of creating a new one', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c4f27-1773-7a5e-acb8-6f05e4d374f0', 'use_auths', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('019c4f27-1773-786b-bdec-19c9c969bde5', '2026-02-12T00:01:27.881501+00:00', false, false, true, 'use_auths', 'Use an existing auth resource instead of creating a new one', '{}', 'link', '{019c4f27-1773-7e98-80e4-c94c03867ee0}', '{a0000515-0002-0000-0000-000000000001}', '{auths}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c4f27-1773-7967-85eb-fc7c1c9c2dc1', '2026-02-12T00:01:27.881501+00:00', '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c4f27-1773-7967-85eb-fc7c1c9c2dc1', '019c4f27-1774-702a-af43-6c0ed5dbefb3', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c4f27-1773-7967-85eb-fc7c1c9c2dc1', '019c4f27-1773-7e98-80e4-c94c03867ee0', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019c4f27-1773-7967-85eb-fc7c1c9c2dc1', '019c4f27-1773-7c0b-b97c-ef1106ff189a', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, descriptions_id) DO NOTHING;
-- tool_resources_junction
INSERT INTO public.tool_resources_junction (tool_id, resources_id, active, created_at, generated, mcp) VALUES ('019c4f27-1773-7967-85eb-fc7c1c9c2dc1', '019bbeb4-510b-7cb0-b8ff-b817a0f2cbf5', true, '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (tool_id, resources_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flags_id, created_at, generated, mcp, active) VALUES ('019c4f27-1773-7967-85eb-fc7c1c9c2dc1', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, flags_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operations_id, created_at, active, generated, mcp) VALUES ('019c4f27-1773-7967-85eb-fc7c1c9c2dc1', '019d0000-0001-7000-8000-000000000003', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operations_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, names_id, created_at, generated, mcp, active) VALUES ('019c4f27-1773-7967-85eb-fc7c1c9c2dc1', '019c4f27-1773-7a5e-acb8-6f05e4d374f0', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, names_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c4f27-1773-7967-85eb-fc7c1c9c2dc1', '019c4f27-1773-786b-bdec-19c9c969bde5', true, '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
