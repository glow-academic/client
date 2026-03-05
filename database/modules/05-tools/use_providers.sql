-- Module: use_providers
-- Category: tool
-- Description: use_providers MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-7713-8183-d5f81f342c75', 'provider_id', '', 'string', true, '', '2026-01-14T18:39:46.747769+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4f27-1781-7e46-a0f7-e0d1848b5741', '019bbf87-091f-7713-8183-d5f81f342c75', 0, '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c4f27-1781-7b9c-b0f7-54bdead47882', 'Use an existing provider resource instead of creating a new one', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c4f27-1781-7a0f-a61d-565d67e5d860', 'use_providers', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('019c4f27-1781-78eb-922b-095e42cb9438', '2026-02-12T00:01:27.881501+00:00', false, false, true, 'use_providers', 'Use an existing provider resource instead of creating a new one', '{}', 'link', '{019bbf87-091f-7713-8183-d5f81f342c75}', '{019bbf87-0966-7981-9b50-b7ac4f8bbb63}', '{providers}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c4f27-1781-790f-9ff0-a576dd55678c', '2026-02-12T00:01:27.881501+00:00', '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c4f27-1781-790f-9ff0-a576dd55678c', '019c4f27-1781-7e46-a0f7-e0d1848b5741', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c4f27-1781-790f-9ff0-a576dd55678c', '019bbf87-091f-7713-8183-d5f81f342c75', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019c4f27-1781-790f-9ff0-a576dd55678c', '019c4f27-1781-7b9c-b0f7-54bdead47882', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, descriptions_id) DO NOTHING;
-- tool_resources_junction
INSERT INTO public.tool_resources_junction (tool_id, resources_id, active, created_at, generated, mcp) VALUES ('019c4f27-1781-790f-9ff0-a576dd55678c', '019bbeb4-5113-7030-b93a-5ab053c805e3', true, '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (tool_id, resources_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flags_id, created_at, generated, mcp, active) VALUES ('019c4f27-1781-790f-9ff0-a576dd55678c', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, flags_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operations_id, created_at, active, generated, mcp) VALUES ('019c4f27-1781-790f-9ff0-a576dd55678c', '019d0000-0001-7000-8000-000000000003', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operations_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, names_id, created_at, generated, mcp, active) VALUES ('019c4f27-1781-790f-9ff0-a576dd55678c', '019c4f27-1781-7a0f-a61d-565d67e5d860', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, names_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c4f27-1781-790f-9ff0-a576dd55678c', '019c4f27-1781-78eb-922b-095e42cb9438', true, '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
