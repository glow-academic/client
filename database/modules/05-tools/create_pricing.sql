-- Module: create_pricing
-- Category: tool
-- Description: create_pricing MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-75a4-9e6c-d441e8dd9326', 'pricing_type', '', 'string', true, '', '2026-01-14T14:25:41.871501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-78b1-8f0c-6b07ce3c2cba', '019bbf87-091f-75a4-9e6c-d441e8dd9326', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-741e-9750-ffa018c4a030', 'active', '', 'boolean', true, 'true', '2026-01-13T03:25:29.718071+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-78b7-89c3-d81f6c5b55b5', '019bbf87-091f-741e-9750-ffa018c4a030', 1, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-75ca-aab8-283cc10f1b5b', 'price', '', 'number', true, '', '2026-01-14T14:25:41.871501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-78b8-bf26-6d1cbd5c20da', '019bbf87-091f-75ca-aab8-283cc10f1b5b', 2, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-75e9-9af5-7d2da24c2050', 'unit_id', '', 'string', true, '', '2026-01-14T14:25:41.871501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-78bd-8069-b67e67058ed5', '019bbf87-091f-75e9-9af5-7d2da24c2050', 3, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-096c-7826-a67e-a8786d4f3811', '019bbf87-091f-75a4-9e6c-d441e8dd9326', 'pricing_type', '{{ pricing_type }}', '2026-01-14T14:25:41.871501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-096c-7950-a100-a0954e8a7beb', '019bbf87-091f-75ca-aab8-283cc10f1b5b', 'price', '{{ price }}', '2026-01-14T14:25:41.871501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-096c-79f7-9d76-32153a640f21', '019bbf87-091f-75e9-9af5-7d2da24c2050', 'unit_id', '{{ unit_id }}', '2026-01-14T14:25:41.871501+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0965-723f-9fa6-99aaa445f4fc', '019bbf87-091f-741e-9750-ffa018c4a030', 'active', '{{ active }}', '2026-01-14T18:39:46.698365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbdce-8407-73c6-a1ef-e3fc35fe6497', 'Create a new pricing resource', '2026-01-14T18:39:46.667548+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbdce-8407-7169-b1ab-973299ca2fca', 'create_pricing', '2026-01-14T18:39:46.667548+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids) VALUES ('019bebc4-d436-7cec-b8a7-a31628d74ae4', '2026-01-17T17:57:40.647526+00:00', false, false, true, 'create_pricing', 'Create a new pricing resource', '{}', false, '{019bbf87-091f-741e-9750-ffa018c4a030,019bbf87-091f-75e9-9af5-7d2da24c2050,019bbf87-091f-75a4-9e6c-d441e8dd9326,019bbf87-091f-75ca-aab8-283cc10f1b5b}', '{019bbf87-096c-7826-a67e-a8786d4f3811,019bbf87-096c-7950-a100-a0954e8a7beb,019bbf87-096c-79f7-9d76-32153a640f21,019bbf87-0965-723f-9fa6-99aaa445f4fc}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bbdce-8407-7072-acff-f9e6ec5cd57c', '2026-01-14T18:39:46.667548+00:00', '2026-01-14T18:39:46.667548+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019bbdce-8407-7072-acff-f9e6ec5cd57c', '019c4e6b-2c29-78b1-8f0c-6b07ce3c2cba', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019bbdce-8407-7072-acff-f9e6ec5cd57c', '019c4e6b-2c29-78b7-89c3-d81f6c5b55b5', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019bbdce-8407-7072-acff-f9e6ec5cd57c', '019c4e6b-2c29-78b8-bf26-6d1cbd5c20da', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019bbdce-8407-7072-acff-f9e6ec5cd57c', '019c4e6b-2c29-78bd-8069-b67e67058ed5', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8407-7072-acff-f9e6ec5cd57c', '019bbf87-091f-741e-9750-ffa018c4a030', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8407-7072-acff-f9e6ec5cd57c', '019bbf87-091f-75e9-9af5-7d2da24c2050', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8407-7072-acff-f9e6ec5cd57c', '019bbf87-091f-75a4-9e6c-d441e8dd9326', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8407-7072-acff-f9e6ec5cd57c', '019bbf87-091f-75ca-aab8-283cc10f1b5b', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8407-7072-acff-f9e6ec5cd57c', '019bbf87-096c-7826-a67e-a8786d4f3811', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8407-7072-acff-f9e6ec5cd57c', '019bbf87-096c-7950-a100-a0954e8a7beb', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8407-7072-acff-f9e6ec5cd57c', '019bbf87-096c-79f7-9d76-32153a640f21', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8407-7072-acff-f9e6ec5cd57c', '019bbf87-0965-723f-9fa6-99aaa445f4fc', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bbdce-8407-7072-acff-f9e6ec5cd57c', '019bbdce-8407-73c6-a1ef-e3fc35fe6497', '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019bbdce-8407-7072-acff-f9e6ec5cd57c', '019bbeb4-5112-7a00-bd3a-06796620f457', true, '2026-01-14T22:50:46.919286+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bbdce-8407-7072-acff-f9e6ec5cd57c', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bbdce-8407-7072-acff-f9e6ec5cd57c', '019bbdce-8407-7169-b1ab-973299ca2fca', '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bbdce-8407-7072-acff-f9e6ec5cd57c', '019bebc4-d436-7cec-b8a7-a31628d74ae4', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
