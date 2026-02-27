-- Module: use_standard_groups
-- Category: tool
-- Description: use_standard_groups MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('19c46603-8edc-4af6-823b-6fb7b3bf46b9', 'standard_group_id', '', 'string', true, '', '2026-02-21T22:16:39.602906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('0e5bbb01-a71c-4f7f-a437-c4c56e754e28', '19c46603-8edc-4af6-823b-6fb7b3bf46b9', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('9432a763-d34a-418c-b126-f847a8e93f1b', '19c46603-8edc-4af6-823b-6fb7b3bf46b9', 'id', '{{ standard_group_id }}', '2026-02-21T22:16:39.604747+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d8b-7b70-9680-11539c56f825', 'Use an existing standard groups resource instead of creating a new one', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d8b-7aef-9c6f-a42480b664f0', 'use_standard_groups', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('d0e82950-8f92-46b9-90d6-0fdbeaebc9bb', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'use_standard_groups', 'Use an existing standard group by its ID', '{}', 'link', '{19c46603-8edc-4af6-823b-6fb7b3bf46b9}', '{9432a763-d34a-418c-b126-f847a8e93f1b}', '{}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('16200cb6-49a2-4bbd-b7c7-1d8af7052995', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('16200cb6-49a2-4bbd-b7c7-1d8af7052995', '0e5bbb01-a71c-4f7f-a437-c4c56e754e28', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('16200cb6-49a2-4bbd-b7c7-1d8af7052995', '19c46603-8edc-4af6-823b-6fb7b3bf46b9', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('16200cb6-49a2-4bbd-b7c7-1d8af7052995', '9432a763-d34a-418c-b126-f847a8e93f1b', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('16200cb6-49a2-4bbd-b7c7-1d8af7052995', '019c82b8-5d8b-7b70-9680-11539c56f825', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('16200cb6-49a2-4bbd-b7c7-1d8af7052995', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('16200cb6-49a2-4bbd-b7c7-1d8af7052995', '019d0000-0001-7000-8000-000000000003', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('16200cb6-49a2-4bbd-b7c7-1d8af7052995', '019c82b8-5d8b-7aef-9c6f-a42480b664f0', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('16200cb6-49a2-4bbd-b7c7-1d8af7052995', 'd0e82950-8f92-46b9-90d6-0fdbeaebc9bb', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
