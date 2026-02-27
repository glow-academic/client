-- Module: use_groups_rubrics
-- Category: tool
-- Description: use_groups_rubrics MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('626de89a-072f-4bb4-87b3-8176f3165870', 'groups_rubric_id', '', 'string', true, '', '2026-02-21T22:16:39.602906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('63e64530-470b-459c-b8a1-8e0044da8235', '626de89a-072f-4bb4-87b3-8176f3165870', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('bbe4a7c6-1414-42f7-904d-d9e83d72f32d', '626de89a-072f-4bb4-87b3-8176f3165870', 'id', '{{ groups_rubric_id }}', '2026-02-21T22:16:39.604747+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d8a-7b0e-8816-5f22a024d0cd', 'Use an existing groups rubrics resource instead of creating a new one', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d8a-7a8c-bc61-bb118381c0df', 'use_groups_rubrics', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('eb7d2884-cc40-4d92-bed8-b23f604c0f0c', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'use_groups_rubrics', 'Use an existing group-rubric binding by its ID', '{}', 'link', '{626de89a-072f-4bb4-87b3-8176f3165870}', '{bbe4a7c6-1414-42f7-904d-d9e83d72f32d}', '{}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('42fa4cc2-348b-435c-a5b2-fb2d045af785', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('42fa4cc2-348b-435c-a5b2-fb2d045af785', '63e64530-470b-459c-b8a1-8e0044da8235', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('42fa4cc2-348b-435c-a5b2-fb2d045af785', '626de89a-072f-4bb4-87b3-8176f3165870', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('42fa4cc2-348b-435c-a5b2-fb2d045af785', 'bbe4a7c6-1414-42f7-904d-d9e83d72f32d', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('42fa4cc2-348b-435c-a5b2-fb2d045af785', '019c82b8-5d8a-7b0e-8816-5f22a024d0cd', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('42fa4cc2-348b-435c-a5b2-fb2d045af785', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('42fa4cc2-348b-435c-a5b2-fb2d045af785', '019d0000-0001-7000-8000-000000000003', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('42fa4cc2-348b-435c-a5b2-fb2d045af785', '019c82b8-5d8a-7a8c-bc61-bb118381c0df', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('42fa4cc2-348b-435c-a5b2-fb2d045af785', 'eb7d2884-cc40-4d92-bed8-b23f604c0f0c', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
