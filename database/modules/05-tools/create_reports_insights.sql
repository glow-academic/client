-- Module: create_reports_insights
-- Category: tool
-- Description: create_reports_insights MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('6e1477b2-27b4-4fe5-b62d-19b5b26f3b82', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('318ebcc0-76ec-4e3f-bac1-715e3d92e313', '6e1477b2-27b4-4fe5-b62d-19b5b26f3b82', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('4b29e2ee-2431-4164-9017-b1766dcd1942', '6e1477b2-27b4-4fe5-b62d-19b5b26f3b82', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('553f00bc-333c-4106-bb7f-307581d4e0e8', 'group_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('6c2355a3-043c-42b6-8530-550b834b874c', '553f00bc-333c-4106-bb7f-307581d4e0e8', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('cdb58518-c555-4e56-90f8-cdc4e0e162fc', '553f00bc-333c-4106-bb7f-307581d4e0e8', 'group_id', '{{ group_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('74d60560-24f2-4175-b049-5d145f327d89', 'content', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('c3f59392-1e0c-4511-8f70-a4de286c6ecb', '74d60560-24f2-4175-b049-5d145f327d89', 2, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('7998c4be-0d37-4374-9083-bf9c2ceeec61', '74d60560-24f2-4175-b049-5d145f327d89', 'content', '{{ content }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('869590b4-112a-4e47-aa28-c8c9d01378e0', 'Create a new reports insights entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('1095eb18-e85d-4029-9369-c2dab985405d', 'create_reports_insights', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('02464014-122f-419d-b3a3-7f0acbd54382', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_reports_insights', 'Create a new reports insights entry', '{}', 'create', '{6e1477b2-27b4-4fe5-b62d-19b5b26f3b82,553f00bc-333c-4106-bb7f-307581d4e0e8,74d60560-24f2-4175-b049-5d145f327d89}', '{4b29e2ee-2431-4164-9017-b1766dcd1942,cdb58518-c555-4e56-90f8-cdc4e0e162fc,7998c4be-0d37-4374-9083-bf9c2ceeec61}', '{}'::text[], '{reports_insights}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('5ae54a29-7eeb-495c-b741-3be426350cd6', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('5ae54a29-7eeb-495c-b741-3be426350cd6', '318ebcc0-76ec-4e3f-bac1-715e3d92e313', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('5ae54a29-7eeb-495c-b741-3be426350cd6', '6c2355a3-043c-42b6-8530-550b834b874c', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('5ae54a29-7eeb-495c-b741-3be426350cd6', 'c3f59392-1e0c-4511-8f70-a4de286c6ecb', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('5ae54a29-7eeb-495c-b741-3be426350cd6', '6e1477b2-27b4-4fe5-b62d-19b5b26f3b82', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('5ae54a29-7eeb-495c-b741-3be426350cd6', '553f00bc-333c-4106-bb7f-307581d4e0e8', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('5ae54a29-7eeb-495c-b741-3be426350cd6', '74d60560-24f2-4175-b049-5d145f327d89', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('5ae54a29-7eeb-495c-b741-3be426350cd6', '4b29e2ee-2431-4164-9017-b1766dcd1942', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('5ae54a29-7eeb-495c-b741-3be426350cd6', 'cdb58518-c555-4e56-90f8-cdc4e0e162fc', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('5ae54a29-7eeb-495c-b741-3be426350cd6', '7998c4be-0d37-4374-9083-bf9c2ceeec61', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('5ae54a29-7eeb-495c-b741-3be426350cd6', '018f0004-0001-7000-8000-00000000000b', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('5ae54a29-7eeb-495c-b741-3be426350cd6', '869590b4-112a-4e47-aa28-c8c9d01378e0', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('5ae54a29-7eeb-495c-b741-3be426350cd6', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('5ae54a29-7eeb-495c-b741-3be426350cd6', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('5ae54a29-7eeb-495c-b741-3be426350cd6', '1095eb18-e85d-4029-9369-c2dab985405d', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('5ae54a29-7eeb-495c-b741-3be426350cd6', '02464014-122f-419d-b3a3-7f0acbd54382', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
