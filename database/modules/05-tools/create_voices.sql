-- Module: create_voices
-- Category: tool
-- Description: create_voices MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-7506-a258-7c1e4bf24a41', 'voice_id', '', 'string', true, '', '2026-01-13T04:12:23.641609+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-786b-879c-ad98b42798d6', '019bbf87-091f-7506-a258-7c1e4bf24a41', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-741e-9750-ffa018c4a030', 'active', '', 'boolean', true, 'true', '2026-01-13T03:25:29.718071+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-786d-a924-22818470a276', '019bbf87-091f-741e-9750-ffa018c4a030', 1, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-7522-aff7-504c504c64c0', 'voice', '', 'string', true, '', '2026-01-13T04:12:23.641609+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7872-a351-86d0498a972e', '019bbf87-091f-7522-aff7-504c504c64c0', 2, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-096c-7f84-9de3-3633a716c6be', '019bbf87-091f-7506-a258-7c1e4bf24a41', 'voice_id', '{{ voice_id }}', '2026-01-13T04:12:23.641609+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-096d-702e-a3af-4518928bca79', '019bbf87-091f-7522-aff7-504c504c64c0', 'voice', '{{ voice }}', '2026-01-13T04:12:23.641609+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0965-723f-9fa6-99aaa445f4fc', '019bbf87-091f-741e-9750-ffa018c4a030', 'active', '{{ active }}', '2026-01-14T18:39:46.698365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a33-7016-9ebf-70bef136f762', 'Create a new voice resource', '2026-01-13T04:12:23.646486+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-7f7b-83c2-dc9fb54eb87f', 'create_voices', '2026-01-13T04:12:23.646486+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('019bebc4-d436-7ccc-9e9c-6f4b2a633f9d', '2026-01-17T17:57:40.647526+00:00', false, false, true, 'create_voices', 'Create a new voice resource', '{}', 'create', '{019bbf87-091f-741e-9750-ffa018c4a030,019bbf87-091f-7522-aff7-504c504c64c0,019bbf87-091f-7506-a258-7c1e4bf24a41}', '{019bbf87-096c-7f84-9de3-3633a716c6be,019bbf87-096d-702e-a3af-4518928bca79,019bbf87-0965-723f-9fa6-99aaa445f4fc}', '{voices}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bb58e-0ade-7a67-ab34-102bdfba34f3', '2026-01-13T04:12:23.646486+00:00', '2026-01-13T04:12:23.646486+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019bb58e-0ade-7a67-ab34-102bdfba34f3', '019c4e6b-2c29-786b-879c-ad98b42798d6', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019bb58e-0ade-7a67-ab34-102bdfba34f3', '019c4e6b-2c29-786d-a924-22818470a276', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019bb58e-0ade-7a67-ab34-102bdfba34f3', '019c4e6b-2c29-7872-a351-86d0498a972e', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb58e-0ade-7a67-ab34-102bdfba34f3', '019bbf87-091f-741e-9750-ffa018c4a030', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb58e-0ade-7a67-ab34-102bdfba34f3', '019bbf87-091f-7522-aff7-504c504c64c0', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb58e-0ade-7a67-ab34-102bdfba34f3', '019bbf87-091f-7506-a258-7c1e4bf24a41', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb58e-0ade-7a67-ab34-102bdfba34f3', '019bbf87-096c-7f84-9de3-3633a716c6be', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb58e-0ade-7a67-ab34-102bdfba34f3', '019bbf87-096d-702e-a3af-4518928bca79', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb58e-0ade-7a67-ab34-102bdfba34f3', '019bbf87-0965-723f-9fa6-99aaa445f4fc', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019bb58e-0ade-7a67-ab34-102bdfba34f3', '019bbabc-5a33-7016-9ebf-70bef136f762', '2026-01-13T04:12:23.646486+00:00', false, false, true) ON CONFLICT (tool_id, descriptions_id) DO NOTHING;
-- tool_resources_junction
INSERT INTO public.tool_resources_junction (tool_id, resources_id, active, created_at, generated, mcp) VALUES ('019bb58e-0ade-7a67-ab34-102bdfba34f3', '019bbeb4-5117-755b-bd86-1217918c1a46', true, '2026-01-13T04:12:23.646486+00:00', false, false) ON CONFLICT (tool_id, resources_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flags_id, created_at, generated, mcp, active) VALUES ('019bb58e-0ade-7a67-ab34-102bdfba34f3', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-01-13T04:12:23.646486+00:00', false, false, true) ON CONFLICT (tool_id, flags_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operations_id, created_at, active, generated, mcp) VALUES ('019bb58e-0ade-7a67-ab34-102bdfba34f3', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operations_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, names_id, created_at, generated, mcp, active) VALUES ('019bb58e-0ade-7a67-ab34-102bdfba34f3', '019bbabc-5a32-7f7b-83c2-dc9fb54eb87f', '2026-01-13T04:12:23.646486+00:00', false, false, true) ON CONFLICT (tool_id, names_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bb58e-0ade-7a67-ab34-102bdfba34f3', '019bebc4-d436-7ccc-9e9c-6f4b2a633f9d', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
