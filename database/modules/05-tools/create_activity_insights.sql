-- Module: create_activity_insights
-- Category: tool
-- Description: create_activity_insights MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('359bfbb2-562a-4f98-a7d1-4d877a673360', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('56552347-86fc-4d46-8f77-9eb39c93d64a', '359bfbb2-562a-4f98-a7d1-4d877a673360', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('7d4c4d31-c72d-4aec-ab20-8d17ef9cecae', '359bfbb2-562a-4f98-a7d1-4d877a673360', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('694a6c1b-0ae4-42c1-ac91-c01a4f790476', 'group_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('ac640c25-7480-4418-b2e9-da9f9b54d76b', '694a6c1b-0ae4-42c1-ac91-c01a4f790476', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('d4430138-0186-4f44-a262-3cb455818f5d', '694a6c1b-0ae4-42c1-ac91-c01a4f790476', 'group_id', '{{ group_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('e35850ca-c6bb-44c8-916d-ac061c2b0305', 'content', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('f2eb900a-50fe-412c-b974-f963c6a12c60', 'e35850ca-c6bb-44c8-916d-ac061c2b0305', 2, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('b63ee870-97ad-4bd4-8343-23adde222a97', 'e35850ca-c6bb-44c8-916d-ac061c2b0305', 'content', '{{ content }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('34098f04-3ea1-4164-8cdd-6d690d0b8f64', 'Create a new activity insights entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('c886f17c-ade0-49de-9d70-d5f4077536b2', 'create_activity_insights', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('14f68f99-d249-4544-b725-73b9a67a871b', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_activity_insights', 'Create a new activity insights entry', '{}', 'create', '{359bfbb2-562a-4f98-a7d1-4d877a673360,694a6c1b-0ae4-42c1-ac91-c01a4f790476,e35850ca-c6bb-44c8-916d-ac061c2b0305}', '{7d4c4d31-c72d-4aec-ab20-8d17ef9cecae,d4430138-0186-4f44-a262-3cb455818f5d,b63ee870-97ad-4bd4-8343-23adde222a97}', '{}'::text[], '{activity_insights}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('debf6d2c-865d-40ce-8619-ff61ef785990', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('debf6d2c-865d-40ce-8619-ff61ef785990', '56552347-86fc-4d46-8f77-9eb39c93d64a', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('debf6d2c-865d-40ce-8619-ff61ef785990', 'ac640c25-7480-4418-b2e9-da9f9b54d76b', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('debf6d2c-865d-40ce-8619-ff61ef785990', 'f2eb900a-50fe-412c-b974-f963c6a12c60', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('debf6d2c-865d-40ce-8619-ff61ef785990', '359bfbb2-562a-4f98-a7d1-4d877a673360', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('debf6d2c-865d-40ce-8619-ff61ef785990', '694a6c1b-0ae4-42c1-ac91-c01a4f790476', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('debf6d2c-865d-40ce-8619-ff61ef785990', 'e35850ca-c6bb-44c8-916d-ac061c2b0305', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('debf6d2c-865d-40ce-8619-ff61ef785990', '7d4c4d31-c72d-4aec-ab20-8d17ef9cecae', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('debf6d2c-865d-40ce-8619-ff61ef785990', 'd4430138-0186-4f44-a262-3cb455818f5d', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('debf6d2c-865d-40ce-8619-ff61ef785990', 'b63ee870-97ad-4bd4-8343-23adde222a97', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('debf6d2c-865d-40ce-8619-ff61ef785990', '018f0004-0001-7000-8000-000000000001', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('debf6d2c-865d-40ce-8619-ff61ef785990', '34098f04-3ea1-4164-8cdd-6d690d0b8f64', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('debf6d2c-865d-40ce-8619-ff61ef785990', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('debf6d2c-865d-40ce-8619-ff61ef785990', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('debf6d2c-865d-40ce-8619-ff61ef785990', 'c886f17c-ade0-49de-9d70-d5f4077536b2', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('debf6d2c-865d-40ce-8619-ff61ef785990', '14f68f99-d249-4544-b725-73b9a67a871b', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
