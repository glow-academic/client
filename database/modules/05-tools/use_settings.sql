-- Module: use_settings
-- Category: tool
-- Description: use_settings MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019c4f27-1784-733f-a6b0-29152236cd21', 'setting_id', '', 'string', true, '', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4f27-1784-73e1-b1fd-5ed980bf1d87', '019c4f27-1784-733f-a6b0-29152236cd21', 0, '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c4f27-1784-7251-abe6-52ad9dca7405', 'Use an existing setting resource instead of creating a new one', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c4f27-1784-71b7-84da-5c3f0aee6340', 'use_settings', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids) VALUES ('019c4f27-1784-7127-9b62-b1b57aac5b54', '2026-02-12T00:01:27.881501+00:00', false, false, true, 'use_settings', 'Use an existing setting resource instead of creating a new one', '{}', false, '{019c4f27-1784-733f-a6b0-29152236cd21}', '{}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c4f27-1784-7144-9dc9-343f19a8d990', '2026-02-12T00:01:27.881501+00:00', '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c4f27-1784-7144-9dc9-343f19a8d990', '019c4f27-1784-73e1-b1fd-5ed980bf1d87', '2026-02-12T00:01:27.881501+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c4f27-1784-7144-9dc9-343f19a8d990', '019c4f27-1784-733f-a6b0-29152236cd21', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019c4f27-1784-7144-9dc9-343f19a8d990', '019c4f27-1784-7251-abe6-52ad9dca7405', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019c4f27-1784-7144-9dc9-343f19a8d990', '019bbeb4-5115-7282-b3e6-f07cde27cb35', true, '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4f27-1784-7144-9dc9-343f19a8d990', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4f27-1784-7144-9dc9-343f19a8d990', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c4f27-1784-7144-9dc9-343f19a8d990', '019c4f27-1784-71b7-84da-5c3f0aee6340', '2026-02-12T00:01:27.881501+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c4f27-1784-7144-9dc9-343f19a8d990', '019c4f27-1784-7127-9b62-b1b57aac5b54', true, '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
