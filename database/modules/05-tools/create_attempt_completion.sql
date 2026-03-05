-- Module: create_attempt_completion
-- Category: tool
-- Description: create_attempt_completion MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('c96f7346-61f6-4eb5-a4d0-f6946d615211', 'attempt_completions', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('d5c14fe7-71b4-4035-a052-f45cfeaa2ce5', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('2cb128d5-c62a-457e-a1fa-41ee8e42042c', 'd5c14fe7-71b4-4035-a052-f45cfeaa2ce5', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('ae31fd27-8784-454f-be13-18e1aac017a9', 'd5c14fe7-71b4-4035-a052-f45cfeaa2ce5', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('e4cb4d80-574e-498f-b57f-2819c9393bf5', 'chat_id', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('dbcd42a6-2ace-478c-80db-ed939e2aef95', 'e4cb4d80-574e-498f-b57f-2819c9393bf5', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('cd5395bd-762c-4f7b-a5c9-118adba632cc', 'e4cb4d80-574e-498f-b57f-2819c9393bf5', 'chat_id', '{{ chat_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('f4d83660-f1e0-459d-ac1a-5c618b7be076', 'end_reason', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('accb2a43-37e8-4ee0-8751-3aa2784f559c', 'f4d83660-f1e0-459d-ac1a-5c618b7be076', 2, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('57b9dcc7-62ff-45f5-84bb-6a5b1d1cd5cc', 'f4d83660-f1e0-459d-ac1a-5c618b7be076', 'end_reason', '{{ end_reason }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('8bfc4e10-5e8c-4324-b8a0-b297c95a32ce', 'Create a new attempt completion entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('34ade100-4ba3-4ab8-870f-2733836547af', 'create_attempt_completion', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('39a93077-c899-496b-957e-062439325193', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_attempt_completion', 'Create a new attempt completion entry', '{}', 'create', '{d5c14fe7-71b4-4035-a052-f45cfeaa2ce5,e4cb4d80-574e-498f-b57f-2819c9393bf5,f4d83660-f1e0-459d-ac1a-5c618b7be076}', '{ae31fd27-8784-454f-be13-18e1aac017a9,cd5395bd-762c-4f7b-a5c9-118adba632cc,57b9dcc7-62ff-45f5-84bb-6a5b1d1cd5cc}', '{}'::text[], '{attempt_completions}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('9742c46c-b7e7-4faf-9d90-e7ddaf30c368', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('9742c46c-b7e7-4faf-9d90-e7ddaf30c368', '2cb128d5-c62a-457e-a1fa-41ee8e42042c', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('9742c46c-b7e7-4faf-9d90-e7ddaf30c368', 'dbcd42a6-2ace-478c-80db-ed939e2aef95', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('9742c46c-b7e7-4faf-9d90-e7ddaf30c368', 'accb2a43-37e8-4ee0-8751-3aa2784f559c', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('9742c46c-b7e7-4faf-9d90-e7ddaf30c368', 'd5c14fe7-71b4-4035-a052-f45cfeaa2ce5', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('9742c46c-b7e7-4faf-9d90-e7ddaf30c368', 'e4cb4d80-574e-498f-b57f-2819c9393bf5', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('9742c46c-b7e7-4faf-9d90-e7ddaf30c368', 'f4d83660-f1e0-459d-ac1a-5c618b7be076', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('9742c46c-b7e7-4faf-9d90-e7ddaf30c368', 'ae31fd27-8784-454f-be13-18e1aac017a9', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('9742c46c-b7e7-4faf-9d90-e7ddaf30c368', 'cd5395bd-762c-4f7b-a5c9-118adba632cc', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('9742c46c-b7e7-4faf-9d90-e7ddaf30c368', '57b9dcc7-62ff-45f5-84bb-6a5b1d1cd5cc', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('9742c46c-b7e7-4faf-9d90-e7ddaf30c368', 'c96f7346-61f6-4eb5-a4d0-f6946d615211', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('9742c46c-b7e7-4faf-9d90-e7ddaf30c368', '8bfc4e10-5e8c-4324-b8a0-b297c95a32ce', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('9742c46c-b7e7-4faf-9d90-e7ddaf30c368', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('9742c46c-b7e7-4faf-9d90-e7ddaf30c368', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('9742c46c-b7e7-4faf-9d90-e7ddaf30c368', '34ade100-4ba3-4ab8-870f-2733836547af', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('9742c46c-b7e7-4faf-9d90-e7ddaf30c368', '39a93077-c899-496b-957e-062439325193', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
