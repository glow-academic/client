-- Module: create_test_insights
-- Category: tool
-- Description: create_test_insights MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('6ca42121-3870-458a-b36f-9b47f4a7798e', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('7e98ae02-1cc3-43e8-9307-e6619d7da03d', '6ca42121-3870-458a-b36f-9b47f4a7798e', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('8067d8cf-dc57-4a91-8a09-8cd67a162856', '6ca42121-3870-458a-b36f-9b47f4a7798e', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('833209ab-d933-43a5-908d-7d1b457e4e30', 'group_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('9efaa9a1-0da8-4144-a8d9-3c6f0fb1cebf', '833209ab-d933-43a5-908d-7d1b457e4e30', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('de00ca79-0b83-4f10-8ba9-2f0e727109d5', '833209ab-d933-43a5-908d-7d1b457e4e30', 'group_id', '{{ group_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('cff63aa9-11dd-425d-ac1f-302692a1a46f', 'content', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('a1a897d3-a614-4b81-99d7-2ea80c699278', 'cff63aa9-11dd-425d-ac1f-302692a1a46f', 2, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('ac725f26-30f8-49cf-8378-ec3bad6d52e2', 'cff63aa9-11dd-425d-ac1f-302692a1a46f', 'content', '{{ content }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('b355d24e-4ccf-4720-8c75-a4b66eae9130', 'Create a new test insights entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('36777abd-c58a-415c-b0ba-e605ee2ea5ae', 'create_test_insights', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('ca76b037-d1ec-4296-b266-301be616b6a3', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_test_insights', 'Create a new test insights entry', '{}', 'create', '{6ca42121-3870-458a-b36f-9b47f4a7798e,833209ab-d933-43a5-908d-7d1b457e4e30,cff63aa9-11dd-425d-ac1f-302692a1a46f}', '{8067d8cf-dc57-4a91-8a09-8cd67a162856,de00ca79-0b83-4f10-8ba9-2f0e727109d5,ac725f26-30f8-49cf-8378-ec3bad6d52e2}', '{}'::text[], '{test_insights}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('61de57bc-1daf-4318-80d4-cccc6c096290', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('61de57bc-1daf-4318-80d4-cccc6c096290', '7e98ae02-1cc3-43e8-9307-e6619d7da03d', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('61de57bc-1daf-4318-80d4-cccc6c096290', '9efaa9a1-0da8-4144-a8d9-3c6f0fb1cebf', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('61de57bc-1daf-4318-80d4-cccc6c096290', 'a1a897d3-a614-4b81-99d7-2ea80c699278', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('61de57bc-1daf-4318-80d4-cccc6c096290', '6ca42121-3870-458a-b36f-9b47f4a7798e', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('61de57bc-1daf-4318-80d4-cccc6c096290', '833209ab-d933-43a5-908d-7d1b457e4e30', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('61de57bc-1daf-4318-80d4-cccc6c096290', 'cff63aa9-11dd-425d-ac1f-302692a1a46f', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('61de57bc-1daf-4318-80d4-cccc6c096290', '8067d8cf-dc57-4a91-8a09-8cd67a162856', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('61de57bc-1daf-4318-80d4-cccc6c096290', 'de00ca79-0b83-4f10-8ba9-2f0e727109d5', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('61de57bc-1daf-4318-80d4-cccc6c096290', 'ac725f26-30f8-49cf-8378-ec3bad6d52e2', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('61de57bc-1daf-4318-80d4-cccc6c096290', '018f0004-0001-7000-8000-00000000000d', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('61de57bc-1daf-4318-80d4-cccc6c096290', 'b355d24e-4ccf-4720-8c75-a4b66eae9130', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('61de57bc-1daf-4318-80d4-cccc6c096290', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('61de57bc-1daf-4318-80d4-cccc6c096290', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('61de57bc-1daf-4318-80d4-cccc6c096290', '36777abd-c58a-415c-b0ba-e605ee2ea5ae', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('61de57bc-1daf-4318-80d4-cccc6c096290', 'ca76b037-d1ec-4296-b266-301be616b6a3', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
