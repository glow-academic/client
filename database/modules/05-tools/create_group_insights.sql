-- Module: create_group_insights
-- Category: tool
-- Description: create_group_insights MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('5942c09b-512d-4bad-b58c-ab151abab24d', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('f90f7094-d54b-4620-81a4-364d4d8d4613', '5942c09b-512d-4bad-b58c-ab151abab24d', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('7ae34c14-066c-4274-890c-b7fe1a6ebaa5', '5942c09b-512d-4bad-b58c-ab151abab24d', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('ed257089-08eb-4670-8edc-ddf1db7e02b7', 'group_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('8c8b7e1c-fd1f-4386-8183-a10fd15cab6f', 'ed257089-08eb-4670-8edc-ddf1db7e02b7', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('aa130509-f581-444c-b410-b136b52a5106', 'ed257089-08eb-4670-8edc-ddf1db7e02b7', 'group_id', '{{ group_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('45e42664-c620-4b95-bf64-27199d115ce0', 'content', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('608ed025-0e05-4572-a5b4-05c16335d579', '45e42664-c620-4b95-bf64-27199d115ce0', 2, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('bcf55251-8b54-4efe-a582-1339d0051af7', '45e42664-c620-4b95-bf64-27199d115ce0', 'content', '{{ content }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('121232a1-c1b0-4558-b6e6-76378c8be66c', 'Create a new group insights entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('5b98e906-73fe-41f2-9011-8cbd33a05c1e', 'create_group_insights', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('00815c85-c56b-44fc-86fd-833edc71468c', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_group_insights', 'Create a new group insights entry', '{}', 'create', '{5942c09b-512d-4bad-b58c-ab151abab24d,ed257089-08eb-4670-8edc-ddf1db7e02b7,45e42664-c620-4b95-bf64-27199d115ce0}', '{7ae34c14-066c-4274-890c-b7fe1a6ebaa5,aa130509-f581-444c-b410-b136b52a5106,bcf55251-8b54-4efe-a582-1339d0051af7}', '{}'::text[], '{group_insights}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('d54cabaf-cdf7-481f-95d7-1a56f3008bbb', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('d54cabaf-cdf7-481f-95d7-1a56f3008bbb', 'f90f7094-d54b-4620-81a4-364d4d8d4613', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('d54cabaf-cdf7-481f-95d7-1a56f3008bbb', '8c8b7e1c-fd1f-4386-8183-a10fd15cab6f', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('d54cabaf-cdf7-481f-95d7-1a56f3008bbb', '608ed025-0e05-4572-a5b4-05c16335d579', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('d54cabaf-cdf7-481f-95d7-1a56f3008bbb', '5942c09b-512d-4bad-b58c-ab151abab24d', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('d54cabaf-cdf7-481f-95d7-1a56f3008bbb', 'ed257089-08eb-4670-8edc-ddf1db7e02b7', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('d54cabaf-cdf7-481f-95d7-1a56f3008bbb', '45e42664-c620-4b95-bf64-27199d115ce0', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('d54cabaf-cdf7-481f-95d7-1a56f3008bbb', '7ae34c14-066c-4274-890c-b7fe1a6ebaa5', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('d54cabaf-cdf7-481f-95d7-1a56f3008bbb', 'aa130509-f581-444c-b410-b136b52a5106', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('d54cabaf-cdf7-481f-95d7-1a56f3008bbb', 'bcf55251-8b54-4efe-a582-1339d0051af7', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('d54cabaf-cdf7-481f-95d7-1a56f3008bbb', '018f0004-0001-7000-8000-00000000000e', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('d54cabaf-cdf7-481f-95d7-1a56f3008bbb', '121232a1-c1b0-4558-b6e6-76378c8be66c', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('d54cabaf-cdf7-481f-95d7-1a56f3008bbb', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('d54cabaf-cdf7-481f-95d7-1a56f3008bbb', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('d54cabaf-cdf7-481f-95d7-1a56f3008bbb', '5b98e906-73fe-41f2-9011-8cbd33a05c1e', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('d54cabaf-cdf7-481f-95d7-1a56f3008bbb', '00815c85-c56b-44fc-86fd-833edc71468c', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
