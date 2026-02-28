-- Module: create_leaderboard_insights
-- Category: tool
-- Description: create_leaderboard_insights MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('30cd82c9-bf3b-427e-b496-0c8bec0938f7', 'group_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('6cd72c97-3174-467f-8cb3-ce7a2064b41d', '30cd82c9-bf3b-427e-b496-0c8bec0938f7', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('914cb8de-a389-4517-bc87-6b0e0dd5fe4d', '30cd82c9-bf3b-427e-b496-0c8bec0938f7', 'group_id', '{{ group_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('5a7ad539-ed88-47b2-8278-c1b394b5ede8', 'content', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('16bb6c72-c697-4ad0-873e-6171ce561f65', '5a7ad539-ed88-47b2-8278-c1b394b5ede8', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('e40e9cec-285b-49e7-8d81-45ff431c3a1c', '5a7ad539-ed88-47b2-8278-c1b394b5ede8', 'content', '{{ content }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('23b8698f-7abb-497c-abe8-adb414da9a5a', 'Create a new leaderboard insights entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('e3233d23-c21c-4d7e-be5d-22516b05c288', 'create_leaderboard_insights', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('052771bb-04b4-4064-8533-4eaf7ff06bd9', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_leaderboard_insights', 'Create a new leaderboard insights entry', '{}', 'create', '{30cd82c9-bf3b-427e-b496-0c8bec0938f7,5a7ad539-ed88-47b2-8278-c1b394b5ede8}', '{914cb8de-a389-4517-bc87-6b0e0dd5fe4d,e40e9cec-285b-49e7-8d81-45ff431c3a1c}', '{}'::text[], '{leaderboard_insights}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('e6d4ab54-e9c2-466c-b573-7b87f3a0118f', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('e6d4ab54-e9c2-466c-b573-7b87f3a0118f', '6cd72c97-3174-467f-8cb3-ce7a2064b41d', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('e6d4ab54-e9c2-466c-b573-7b87f3a0118f', '16bb6c72-c697-4ad0-873e-6171ce561f65', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('e6d4ab54-e9c2-466c-b573-7b87f3a0118f', '30cd82c9-bf3b-427e-b496-0c8bec0938f7', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('e6d4ab54-e9c2-466c-b573-7b87f3a0118f', '5a7ad539-ed88-47b2-8278-c1b394b5ede8', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('e6d4ab54-e9c2-466c-b573-7b87f3a0118f', '914cb8de-a389-4517-bc87-6b0e0dd5fe4d', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('e6d4ab54-e9c2-466c-b573-7b87f3a0118f', 'e40e9cec-285b-49e7-8d81-45ff431c3a1c', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('e6d4ab54-e9c2-466c-b573-7b87f3a0118f', '018f0004-0001-7000-8000-000000000007', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('e6d4ab54-e9c2-466c-b573-7b87f3a0118f', '23b8698f-7abb-497c-abe8-adb414da9a5a', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('e6d4ab54-e9c2-466c-b573-7b87f3a0118f', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('e6d4ab54-e9c2-466c-b573-7b87f3a0118f', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('e6d4ab54-e9c2-466c-b573-7b87f3a0118f', 'e3233d23-c21c-4d7e-be5d-22516b05c288', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('e6d4ab54-e9c2-466c-b573-7b87f3a0118f', '052771bb-04b4-4064-8533-4eaf7ff06bd9', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
