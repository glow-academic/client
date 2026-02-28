-- Module: create_health_insights
-- Category: tool
-- Description: create_health_insights MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('5bb58a1f-161b-4e89-8243-41f28a7c5b5b', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('6c6d41ec-e391-4155-8e37-2e2e98c2de98', '5bb58a1f-161b-4e89-8243-41f28a7c5b5b', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('33ef68df-ea17-49ca-927c-104218f7ea83', '5bb58a1f-161b-4e89-8243-41f28a7c5b5b', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('7b40ba58-b02a-4c5b-8b01-82e92d37cd83', 'group_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('0aafcf8c-820d-4406-a042-83ef631d211c', '7b40ba58-b02a-4c5b-8b01-82e92d37cd83', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('b2c09e69-6d89-453a-94bc-4613d421cb1c', '7b40ba58-b02a-4c5b-8b01-82e92d37cd83', 'group_id', '{{ group_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('5ad77aaf-5b85-46a5-a3ae-266335b1c59f', 'content', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('c689902a-26b1-479c-b375-090d07b8f2eb', '5ad77aaf-5b85-46a5-a3ae-266335b1c59f', 2, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('2bbbc20e-9ab3-4416-a868-cb98fc3d29d0', '5ad77aaf-5b85-46a5-a3ae-266335b1c59f', 'content', '{{ content }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('7a856350-3e1c-4502-b998-e1fe778d62fa', 'Create a new health insights entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('8683b69a-7919-431c-8707-b7dcf613c579', 'create_health_insights', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('8896ece6-c65b-4dc3-be93-b2fe5d71ee42', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_health_insights', 'Create a new health insights entry', '{}', 'create', '{5bb58a1f-161b-4e89-8243-41f28a7c5b5b,7b40ba58-b02a-4c5b-8b01-82e92d37cd83,5ad77aaf-5b85-46a5-a3ae-266335b1c59f}', '{33ef68df-ea17-49ca-927c-104218f7ea83,b2c09e69-6d89-453a-94bc-4613d421cb1c,2bbbc20e-9ab3-4416-a868-cb98fc3d29d0}', '{}'::text[], '{health_insights}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('cd246fc6-21df-48cc-9414-02d298bea91e', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('cd246fc6-21df-48cc-9414-02d298bea91e', '6c6d41ec-e391-4155-8e37-2e2e98c2de98', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('cd246fc6-21df-48cc-9414-02d298bea91e', '0aafcf8c-820d-4406-a042-83ef631d211c', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('cd246fc6-21df-48cc-9414-02d298bea91e', 'c689902a-26b1-479c-b375-090d07b8f2eb', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('cd246fc6-21df-48cc-9414-02d298bea91e', '5bb58a1f-161b-4e89-8243-41f28a7c5b5b', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('cd246fc6-21df-48cc-9414-02d298bea91e', '7b40ba58-b02a-4c5b-8b01-82e92d37cd83', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('cd246fc6-21df-48cc-9414-02d298bea91e', '5ad77aaf-5b85-46a5-a3ae-266335b1c59f', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('cd246fc6-21df-48cc-9414-02d298bea91e', '33ef68df-ea17-49ca-927c-104218f7ea83', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('cd246fc6-21df-48cc-9414-02d298bea91e', 'b2c09e69-6d89-453a-94bc-4613d421cb1c', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('cd246fc6-21df-48cc-9414-02d298bea91e', '2bbbc20e-9ab3-4416-a868-cb98fc3d29d0', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('cd246fc6-21df-48cc-9414-02d298bea91e', '018f0004-0001-7000-8000-000000000005', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('cd246fc6-21df-48cc-9414-02d298bea91e', '7a856350-3e1c-4502-b998-e1fe778d62fa', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('cd246fc6-21df-48cc-9414-02d298bea91e', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('cd246fc6-21df-48cc-9414-02d298bea91e', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('cd246fc6-21df-48cc-9414-02d298bea91e', '8683b69a-7919-431c-8707-b7dcf613c579', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('cd246fc6-21df-48cc-9414-02d298bea91e', '8896ece6-c65b-4dc3-be93-b2fe5d71ee42', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
