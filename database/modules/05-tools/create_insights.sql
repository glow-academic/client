-- Module: create_insights
-- Category: tool
-- Description: create_insights MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('ec99d307-614c-48f5-8700-1b9fb0e383e3', 'title', '', 'string', true, '', '2026-02-21T22:16:39.602906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('cb79b207-dd75-456c-9730-d9c5a6664f5d', 'ec99d307-614c-48f5-8700-1b9fb0e383e3', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('3ca2711d-11f0-4af2-91a3-82a0edd310f1', 'insight', '', 'string', true, '', '2026-02-21T22:16:39.602906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('e317dd2f-7c69-4560-b1a2-d5d1baf61367', '3ca2711d-11f0-4af2-91a3-82a0edd310f1', 1, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('12df5482-1e0c-419d-b709-5b1937da3006', 'category', '', 'string', false, '', '2026-02-21T22:16:39.602906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('bf5b8083-12ea-4d69-a590-62f96d32281c', '12df5482-1e0c-419d-b709-5b1937da3006', 2, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('3b8d382d-217a-4cc7-9d53-bbca1b4795d0', 'severity', '', 'string', false, '', '2026-02-21T22:16:39.602906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('47481407-1fab-401f-8ca3-6b8a53c038b9', '3b8d382d-217a-4cc7-9d53-bbca1b4795d0', 3, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('26f7b224-6fc8-4dc1-949c-62c22165a1f5', 'ec99d307-614c-48f5-8700-1b9fb0e383e3', 'title', '{{ title }}', '2026-02-21T22:16:39.604747+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('ee4c8ce9-e79f-45fa-90f6-a4927538fdd6', '3ca2711d-11f0-4af2-91a3-82a0edd310f1', 'insight', '{{ insight }}', '2026-02-21T22:16:39.604747+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('1eeae496-f0a3-47e3-bca5-fd57262a1795', '12df5482-1e0c-419d-b709-5b1937da3006', 'category', '{{ category }}', '2026-02-21T22:16:39.604747+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('41e660af-8ea1-4bbf-8acf-eb97038084f0', '3b8d382d-217a-4cc7-9d53-bbca1b4795d0', 'severity', '{{ severity }}', '2026-02-21T22:16:39.604747+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d8c-7a39-9e49-87a4fedc514f', 'Create a new insights resource', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d8c-79b7-88a8-058cdb934bbc', 'create_insights', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource, entry) VALUES ('8abd2bea-d252-4a7c-857c-475147ff6877', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'create_insights', 'Create an analytical insight entry', '{}', true, '{12df5482-1e0c-419d-b709-5b1937da3006,3b8d382d-217a-4cc7-9d53-bbca1b4795d0,3ca2711d-11f0-4af2-91a3-82a0edd310f1,ec99d307-614c-48f5-8700-1b9fb0e383e3}', '{1eeae496-f0a3-47e3-bca5-fd57262a1795,26f7b224-6fc8-4dc1-949c-62c22165a1f5,41e660af-8ea1-4bbf-8acf-eb97038084f0,ee4c8ce9-e79f-45fa-90f6-a4927538fdd6}', NULL, 'insights') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('7d075304-0d70-4293-a7d4-27479ad7b913', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('7d075304-0d70-4293-a7d4-27479ad7b913', 'cb79b207-dd75-456c-9730-d9c5a6664f5d', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('7d075304-0d70-4293-a7d4-27479ad7b913', 'e317dd2f-7c69-4560-b1a2-d5d1baf61367', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('7d075304-0d70-4293-a7d4-27479ad7b913', 'bf5b8083-12ea-4d69-a590-62f96d32281c', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('7d075304-0d70-4293-a7d4-27479ad7b913', '47481407-1fab-401f-8ca3-6b8a53c038b9', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('7d075304-0d70-4293-a7d4-27479ad7b913', 'ec99d307-614c-48f5-8700-1b9fb0e383e3', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('7d075304-0d70-4293-a7d4-27479ad7b913', '3ca2711d-11f0-4af2-91a3-82a0edd310f1', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('7d075304-0d70-4293-a7d4-27479ad7b913', '12df5482-1e0c-419d-b709-5b1937da3006', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('7d075304-0d70-4293-a7d4-27479ad7b913', '3b8d382d-217a-4cc7-9d53-bbca1b4795d0', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('7d075304-0d70-4293-a7d4-27479ad7b913', '26f7b224-6fc8-4dc1-949c-62c22165a1f5', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('7d075304-0d70-4293-a7d4-27479ad7b913', 'ee4c8ce9-e79f-45fa-90f6-a4927538fdd6', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('7d075304-0d70-4293-a7d4-27479ad7b913', '1eeae496-f0a3-47e3-bca5-fd57262a1795', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('7d075304-0d70-4293-a7d4-27479ad7b913', '41e660af-8ea1-4bbf-8acf-eb97038084f0', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_bindings_junction
INSERT INTO public.tool_bindings_junction (tool_id, binding_id, active, created_at, generated, mcp) VALUES ('7d075304-0d70-4293-a7d4-27479ad7b913', 'aa7f2c44-5117-4319-bb50-6f425a3e346c', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, binding_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('7d075304-0d70-4293-a7d4-27479ad7b913', '019c82b8-5d8c-7a39-9e49-87a4fedc514f', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('7d075304-0d70-4293-a7d4-27479ad7b913', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('7d075304-0d70-4293-a7d4-27479ad7b913', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-02-22T12:36:03.817884+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('7d075304-0d70-4293-a7d4-27479ad7b913', '019c82b8-5d8c-79b7-88a8-058cdb934bbc', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('7d075304-0d70-4293-a7d4-27479ad7b913', '8abd2bea-d252-4a7c-857c-475147ff6877', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
