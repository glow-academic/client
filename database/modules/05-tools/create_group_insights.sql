-- Module: create_group_insights
-- Category: tool
-- Description: create_group_insights MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('84073ad2-21cd-47a2-b9b1-641e946d4779', 'group_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('2e0d1b2b-e5dc-49bf-9daa-7c460ab5c10e', '84073ad2-21cd-47a2-b9b1-641e946d4779', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('df84c421-a48a-4ecf-a268-18fb70105758', '84073ad2-21cd-47a2-b9b1-641e946d4779', 'group_id', '{{ group_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('8705b0f0-ed86-49d1-bea3-35d498a06e12', 'content', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('6a34d97c-2b22-43f1-8e6e-417ce038fdb9', '8705b0f0-ed86-49d1-bea3-35d498a06e12', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('c4abfc61-bf7f-4b21-8f88-cbea56466f2e', '8705b0f0-ed86-49d1-bea3-35d498a06e12', 'content', '{{ content }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('e93dea42-5f65-4868-b71b-6bb9f04c3fc4', 'Create a new group insights entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('2f0bcf6d-ac83-46b3-bda4-5cb3ee6c6e81', 'create_group_insights', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('3b020da0-f692-4d89-9565-dabcff9ea216', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_group_insights', 'Create a new group insights entry', '{}', 'create', '{84073ad2-21cd-47a2-b9b1-641e946d4779,8705b0f0-ed86-49d1-bea3-35d498a06e12}', '{df84c421-a48a-4ecf-a268-18fb70105758,c4abfc61-bf7f-4b21-8f88-cbea56466f2e}', '{}'::text[], '{group_insights}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('7e6d78c8-6f26-4fe2-b181-9a346ab22192', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('7e6d78c8-6f26-4fe2-b181-9a346ab22192', '2e0d1b2b-e5dc-49bf-9daa-7c460ab5c10e', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('7e6d78c8-6f26-4fe2-b181-9a346ab22192', '6a34d97c-2b22-43f1-8e6e-417ce038fdb9', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('7e6d78c8-6f26-4fe2-b181-9a346ab22192', '84073ad2-21cd-47a2-b9b1-641e946d4779', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('7e6d78c8-6f26-4fe2-b181-9a346ab22192', '8705b0f0-ed86-49d1-bea3-35d498a06e12', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('7e6d78c8-6f26-4fe2-b181-9a346ab22192', 'df84c421-a48a-4ecf-a268-18fb70105758', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('7e6d78c8-6f26-4fe2-b181-9a346ab22192', 'c4abfc61-bf7f-4b21-8f88-cbea56466f2e', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('7e6d78c8-6f26-4fe2-b181-9a346ab22192', '018f0004-0001-7000-8000-00000000000e', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('7e6d78c8-6f26-4fe2-b181-9a346ab22192', 'e93dea42-5f65-4868-b71b-6bb9f04c3fc4', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('7e6d78c8-6f26-4fe2-b181-9a346ab22192', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('7e6d78c8-6f26-4fe2-b181-9a346ab22192', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('7e6d78c8-6f26-4fe2-b181-9a346ab22192', '2f0bcf6d-ac83-46b3-bda4-5cb3ee6c6e81', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('7e6d78c8-6f26-4fe2-b181-9a346ab22192', '3b020da0-f692-4d89-9565-dabcff9ea216', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
