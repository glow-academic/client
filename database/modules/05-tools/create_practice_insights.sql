-- Module: create_practice_insights
-- Category: tool
-- Description: create_practice_insights MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('8a43dd2f-976b-42b0-ab87-5d9730e89cbb', 'group_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('603e7a32-f81b-441d-9fbd-7c867db80f78', '8a43dd2f-976b-42b0-ab87-5d9730e89cbb', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('bdef04fd-bd04-4e29-a5df-20f296bdac20', '8a43dd2f-976b-42b0-ab87-5d9730e89cbb', 'group_id', '{{ group_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('439f402d-33dc-4673-9909-e0d75d5bebeb', 'content', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('ec05763c-4708-4a57-817d-57b4c5f3624c', '439f402d-33dc-4673-9909-e0d75d5bebeb', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('ad3bd59c-05d5-4676-bb4c-ee63543b73c8', '439f402d-33dc-4673-9909-e0d75d5bebeb', 'content', '{{ content }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('ffdbfebc-9500-42fa-a57a-1a24bf015773', 'Create a new practice insights entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('6f95f97a-c0d6-4bbb-8891-33b0458fff11', 'create_practice_insights', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('5078d3ab-1623-4ece-921a-c469b648fb7b', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_practice_insights', 'Create a new practice insights entry', '{}', 'create', '{8a43dd2f-976b-42b0-ab87-5d9730e89cbb,439f402d-33dc-4673-9909-e0d75d5bebeb}', '{bdef04fd-bd04-4e29-a5df-20f296bdac20,ad3bd59c-05d5-4676-bb4c-ee63543b73c8}', '{}'::text[], '{practice_insights}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('ae97c4ca-62aa-4e48-9744-4728f086570e', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('ae97c4ca-62aa-4e48-9744-4728f086570e', '603e7a32-f81b-441d-9fbd-7c867db80f78', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('ae97c4ca-62aa-4e48-9744-4728f086570e', 'ec05763c-4708-4a57-817d-57b4c5f3624c', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('ae97c4ca-62aa-4e48-9744-4728f086570e', '8a43dd2f-976b-42b0-ab87-5d9730e89cbb', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('ae97c4ca-62aa-4e48-9744-4728f086570e', '439f402d-33dc-4673-9909-e0d75d5bebeb', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('ae97c4ca-62aa-4e48-9744-4728f086570e', 'bdef04fd-bd04-4e29-a5df-20f296bdac20', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('ae97c4ca-62aa-4e48-9744-4728f086570e', 'ad3bd59c-05d5-4676-bb4c-ee63543b73c8', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('ae97c4ca-62aa-4e48-9744-4728f086570e', '018f0004-0001-7000-8000-000000000008', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('ae97c4ca-62aa-4e48-9744-4728f086570e', 'ffdbfebc-9500-42fa-a57a-1a24bf015773', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('ae97c4ca-62aa-4e48-9744-4728f086570e', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('ae97c4ca-62aa-4e48-9744-4728f086570e', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('ae97c4ca-62aa-4e48-9744-4728f086570e', '6f95f97a-c0d6-4bbb-8891-33b0458fff11', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('ae97c4ca-62aa-4e48-9744-4728f086570e', '5078d3ab-1623-4ece-921a-c469b648fb7b', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
