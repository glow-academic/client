-- Module: create_attempt_insights
-- Category: tool
-- Description: create_attempt_insights MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('9648660b-c305-40d4-963a-b0a39a4b0261', 'group_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('cf8c1f6c-5fcf-497a-9c19-19a6fc4d057d', '9648660b-c305-40d4-963a-b0a39a4b0261', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('324f3980-497c-4629-bceb-5e5d1702063e', '9648660b-c305-40d4-963a-b0a39a4b0261', 'group_id', '{{ group_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('35d6ab2b-ba62-4ded-8202-20ffa7dc43cd', 'content', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('200ac46b-285a-49c6-a482-cd0085f8cf70', '35d6ab2b-ba62-4ded-8202-20ffa7dc43cd', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('5c0c3d1e-7aec-4805-8e0a-284e5eb1fc6a', '35d6ab2b-ba62-4ded-8202-20ffa7dc43cd', 'content', '{{ content }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('bc08c6ad-bdcf-4c06-a30b-1286a3a98122', 'Create a new attempt insights entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('3b5fcccd-d20e-4547-9952-b2e034f1a506', 'create_attempt_insights', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('44522400-ce6d-4f1d-8710-3c476c3060f2', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_attempt_insights', 'Create a new attempt insights entry', '{}', 'create', '{9648660b-c305-40d4-963a-b0a39a4b0261,35d6ab2b-ba62-4ded-8202-20ffa7dc43cd}', '{324f3980-497c-4629-bceb-5e5d1702063e,5c0c3d1e-7aec-4805-8e0a-284e5eb1fc6a}', '{}'::text[], '{attempt_insights}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('8f3a8d4c-d7d0-4bb4-8f04-2ccb6f7c348f', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('8f3a8d4c-d7d0-4bb4-8f04-2ccb6f7c348f', 'cf8c1f6c-5fcf-497a-9c19-19a6fc4d057d', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('8f3a8d4c-d7d0-4bb4-8f04-2ccb6f7c348f', '200ac46b-285a-49c6-a482-cd0085f8cf70', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('8f3a8d4c-d7d0-4bb4-8f04-2ccb6f7c348f', '9648660b-c305-40d4-963a-b0a39a4b0261', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('8f3a8d4c-d7d0-4bb4-8f04-2ccb6f7c348f', '35d6ab2b-ba62-4ded-8202-20ffa7dc43cd', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('8f3a8d4c-d7d0-4bb4-8f04-2ccb6f7c348f', '324f3980-497c-4629-bceb-5e5d1702063e', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('8f3a8d4c-d7d0-4bb4-8f04-2ccb6f7c348f', '5c0c3d1e-7aec-4805-8e0a-284e5eb1fc6a', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('8f3a8d4c-d7d0-4bb4-8f04-2ccb6f7c348f', '018f0004-0001-7000-8000-000000000002', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('8f3a8d4c-d7d0-4bb4-8f04-2ccb6f7c348f', 'bc08c6ad-bdcf-4c06-a30b-1286a3a98122', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('8f3a8d4c-d7d0-4bb4-8f04-2ccb6f7c348f', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('8f3a8d4c-d7d0-4bb4-8f04-2ccb6f7c348f', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('8f3a8d4c-d7d0-4bb4-8f04-2ccb6f7c348f', '3b5fcccd-d20e-4547-9952-b2e034f1a506', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('8f3a8d4c-d7d0-4bb4-8f04-2ccb6f7c348f', '44522400-ce6d-4f1d-8710-3c476c3060f2', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
