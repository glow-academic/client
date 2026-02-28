-- Module: create_record_insights
-- Category: tool
-- Description: create_record_insights MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('26ae0b86-9d2f-4dcb-81bb-f266d9373981', 'group_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('75db83f6-8758-4952-a2bd-414cf34fc71f', '26ae0b86-9d2f-4dcb-81bb-f266d9373981', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('32fc3db8-80f9-4bea-8285-1682473fa8d3', '26ae0b86-9d2f-4dcb-81bb-f266d9373981', 'group_id', '{{ group_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('daf00b0f-3a11-465f-905e-43b42ab6a50a', 'content', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('2f884e80-8204-4ced-b069-aa2363ebea71', 'daf00b0f-3a11-465f-905e-43b42ab6a50a', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('31a2ba9c-c672-4c22-9ee3-f0ab3a387837', 'daf00b0f-3a11-465f-905e-43b42ab6a50a', 'content', '{{ content }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('123bfbbd-f678-4f03-b49d-3ac875b0eea1', 'Create a new record insights entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('946c1054-eecb-4d1e-923c-7694476e6119', 'create_record_insights', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('5d6eacc7-a94b-4607-8825-7d665df3e85a', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_record_insights', 'Create a new record insights entry', '{}', 'create', '{26ae0b86-9d2f-4dcb-81bb-f266d9373981,daf00b0f-3a11-465f-905e-43b42ab6a50a}', '{32fc3db8-80f9-4bea-8285-1682473fa8d3,31a2ba9c-c672-4c22-9ee3-f0ab3a387837}', '{}'::text[], '{record_insights}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('f6dd1000-db1d-4725-9840-309de7130cf9', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('f6dd1000-db1d-4725-9840-309de7130cf9', '75db83f6-8758-4952-a2bd-414cf34fc71f', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('f6dd1000-db1d-4725-9840-309de7130cf9', '2f884e80-8204-4ced-b069-aa2363ebea71', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('f6dd1000-db1d-4725-9840-309de7130cf9', '26ae0b86-9d2f-4dcb-81bb-f266d9373981', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('f6dd1000-db1d-4725-9840-309de7130cf9', 'daf00b0f-3a11-465f-905e-43b42ab6a50a', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('f6dd1000-db1d-4725-9840-309de7130cf9', '32fc3db8-80f9-4bea-8285-1682473fa8d3', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('f6dd1000-db1d-4725-9840-309de7130cf9', '31a2ba9c-c672-4c22-9ee3-f0ab3a387837', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('f6dd1000-db1d-4725-9840-309de7130cf9', '018f0004-0001-7000-8000-00000000000a', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('f6dd1000-db1d-4725-9840-309de7130cf9', '123bfbbd-f678-4f03-b49d-3ac875b0eea1', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('f6dd1000-db1d-4725-9840-309de7130cf9', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('f6dd1000-db1d-4725-9840-309de7130cf9', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('f6dd1000-db1d-4725-9840-309de7130cf9', '946c1054-eecb-4d1e-923c-7694476e6119', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('f6dd1000-db1d-4725-9840-309de7130cf9', '5d6eacc7-a94b-4607-8825-7d665df3e85a', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
