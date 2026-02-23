-- Module: create_reasoning_levels
-- Category: tool
-- Description: create_reasoning_levels MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-743d-aaa1-fc3b2f0b8773', 'reasoning_level_id', '', 'string', true, '', '2026-01-13T04:12:23.636838+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-784d-8cbe-1bbde5dffd12', '019bbf87-091f-743d-aaa1-fc3b2f0b8773', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-741e-9750-ffa018c4a030', 'active', '', 'boolean', true, 'true', '2026-01-13T03:25:29.718071+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7852-9c37-d7e0882dbf0d', '019bbf87-091f-741e-9750-ffa018c4a030', 1, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-7463-ac69-28fe806f87bd', 'reasoning_level', '', 'string', true, '', '2026-01-13T04:12:23.636838+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7854-b9b4-ae3d41e29121', '019bbf87-091f-7463-ac69-28fe806f87bd', 2, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0967-7b32-bb96-972e1ea88687', '019bbf87-091f-743d-aaa1-fc3b2f0b8773', 'id', '{{ reasoning_level_id }}', '2026-01-13T04:12:23.636838+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0967-7bf2-b5ab-6d792c04add7', '019bbf87-091f-7463-ac69-28fe806f87bd', 'reasoning_level', '{{ reasoning_level }}', '2026-01-13T04:12:23.636838+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0965-723f-9fa6-99aaa445f4fc', '019bbf87-091f-741e-9750-ffa018c4a030', 'active', '{{ active }}', '2026-01-14T18:39:46.698365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-7e01-bb91-df3b8be71c02', 'Create a new reasoning level resource', '2026-01-13T04:12:23.642151+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-7d65-b8b3-404c1b91280f', 'create_reasoning_levels', '2026-01-13T04:12:23.642151+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource, entry) VALUES ('019bebc4-d436-7cc0-a482-5c0fad4f04e9', '2026-01-17T17:57:40.647526+00:00', false, false, true, 'create_reasoning_levels', 'Create a new reasoning level resource', '{}', true, '{019bbf87-091f-743d-aaa1-fc3b2f0b8773,019bbf87-091f-741e-9750-ffa018c4a030,019bbf87-091f-7463-ac69-28fe806f87bd}', '{019bbf87-0967-7b32-bb96-972e1ea88687,019bbf87-0967-7bf2-b5ab-6d792c04add7,019bbf87-0965-723f-9fa6-99aaa445f4fc}', 'reasoning_levels', NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bb58e-0ada-7886-8db7-c68c05efa549', '2026-01-13T04:12:23.642151+00:00', '2026-01-13T04:12:23.642151+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019bb58e-0ada-7886-8db7-c68c05efa549', '019c4e6b-2c29-784d-8cbe-1bbde5dffd12', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019bb58e-0ada-7886-8db7-c68c05efa549', '019c4e6b-2c29-7852-9c37-d7e0882dbf0d', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019bb58e-0ada-7886-8db7-c68c05efa549', '019c4e6b-2c29-7854-b9b4-ae3d41e29121', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb58e-0ada-7886-8db7-c68c05efa549', '019bbf87-091f-743d-aaa1-fc3b2f0b8773', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb58e-0ada-7886-8db7-c68c05efa549', '019bbf87-091f-741e-9750-ffa018c4a030', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb58e-0ada-7886-8db7-c68c05efa549', '019bbf87-091f-7463-ac69-28fe806f87bd', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb58e-0ada-7886-8db7-c68c05efa549', '019bbf87-0967-7b32-bb96-972e1ea88687', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb58e-0ada-7886-8db7-c68c05efa549', '019bbf87-0967-7bf2-b5ab-6d792c04add7', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb58e-0ada-7886-8db7-c68c05efa549', '019bbf87-0965-723f-9fa6-99aaa445f4fc', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bb58e-0ada-7886-8db7-c68c05efa549', '019bbabc-5a32-7e01-bb91-df3b8be71c02', '2026-01-13T04:12:23.642151+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019bb58e-0ada-7886-8db7-c68c05efa549', '019bbeb4-5113-77a6-82d8-be8928536557', true, '2026-01-13T04:12:23.642151+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bb58e-0ada-7886-8db7-c68c05efa549', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-13T04:12:23.642151+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bb58e-0ada-7886-8db7-c68c05efa549', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-02-22T12:36:03.817884+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bb58e-0ada-7886-8db7-c68c05efa549', '019bbabc-5a32-7d65-b8b3-404c1b91280f', '2026-01-13T04:12:23.642151+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bb58e-0ada-7886-8db7-c68c05efa549', '019bebc4-d436-7cc0-a482-5c0fad4f04e9', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
