-- Module: use_modalities
-- Category: tool
-- Description: use_modalities MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019c4f27-177f-7318-8e65-b129bfb42f86', 'modality_id', '', 'string', true, '', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4f27-177f-747d-87f4-e08694fd5936', '019c4f27-177f-7318-8e65-b129bfb42f86', 0, '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c4f27-177e-7611-9779-b95fd3c0a8e4', 'Use an existing modality resource instead of creating a new one', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c4f27-177d-7785-ae8b-e5a0753002c5', 'use_modalities', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource, entry) VALUES ('019c4f27-177d-7066-8f89-2089560e5d4f', '2026-02-12T00:01:27.881501+00:00', false, false, true, 'use_modalities', 'Use an existing modality resource instead of creating a new one', '{}', false, '{019c4f27-177f-7318-8e65-b129bfb42f86}', '{}', 'modalities', NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c4f27-177d-7093-82ea-c0c0caf2fb88', '2026-02-12T00:01:27.881501+00:00', '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c4f27-177d-7093-82ea-c0c0caf2fb88', '019c4f27-177f-747d-87f4-e08694fd5936', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c4f27-177d-7093-82ea-c0c0caf2fb88', '019c4f27-177f-7318-8e65-b129bfb42f86', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019c4f27-177d-7093-82ea-c0c0caf2fb88', '019c4f27-177e-7611-9779-b95fd3c0a8e4', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019c4f27-177d-7093-82ea-c0c0caf2fb88', '019bbeb4-5111-7c8a-b167-11514bc1e2fa', true, '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4f27-177d-7093-82ea-c0c0caf2fb88', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4f27-177d-7093-82ea-c0c0caf2fb88', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c4f27-177d-7093-82ea-c0c0caf2fb88', '019c4f27-177d-7785-ae8b-e5a0753002c5', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c4f27-177d-7093-82ea-c0c0caf2fb88', '019c4f27-177d-7066-8f89-2089560e5d4f', true, '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
