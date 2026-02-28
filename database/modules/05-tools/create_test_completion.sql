-- Module: create_test_completion
-- Category: tool
-- Description: create_test_completion MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('672ea201-9f39-4c02-a984-0310bbf23b4e', 'test_completions', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('4373d447-ecc6-4bad-9be8-9dbab2a1a24d', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('947e54e2-45ca-4410-b8ed-34a4ec2de5c7', '4373d447-ecc6-4bad-9be8-9dbab2a1a24d', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('f1b2f203-9076-4eff-b942-7d8daea1982c', '4373d447-ecc6-4bad-9be8-9dbab2a1a24d', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('a6da43b2-8086-4c66-ae29-d558881f6500', 'invocation_id', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('187e9e27-047e-4110-96e5-f1b29f2f8f49', 'a6da43b2-8086-4c66-ae29-d558881f6500', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('c03f855e-1da9-4da0-a2da-8f44af1852ca', 'a6da43b2-8086-4c66-ae29-d558881f6500', 'invocation_id', '{{ invocation_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('5dafac58-7730-4619-96fd-6a58246d8dd7', 'end_reason', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('095c8fec-5803-4e68-9adb-08a071df4c27', '5dafac58-7730-4619-96fd-6a58246d8dd7', 2, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('e9c5b896-590c-476a-a386-a095c32d394b', '5dafac58-7730-4619-96fd-6a58246d8dd7', 'end_reason', '{{ end_reason }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('dd99e65d-330e-4f26-b54e-23256be2e22f', 'Create a new test completion entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('06be78f5-f629-40b9-88a4-16d4d14b8f04', 'create_test_completion', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('5d74e012-50bb-4cba-950e-248571b1f994', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_test_completion', 'Create a new test completion entry', '{}', 'create', '{4373d447-ecc6-4bad-9be8-9dbab2a1a24d,a6da43b2-8086-4c66-ae29-d558881f6500,5dafac58-7730-4619-96fd-6a58246d8dd7}', '{f1b2f203-9076-4eff-b942-7d8daea1982c,c03f855e-1da9-4da0-a2da-8f44af1852ca,e9c5b896-590c-476a-a386-a095c32d394b}', '{}'::text[], '{test_completions}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('d3ce723f-a753-4f70-af00-a0b04e8177ee', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('d3ce723f-a753-4f70-af00-a0b04e8177ee', '947e54e2-45ca-4410-b8ed-34a4ec2de5c7', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('d3ce723f-a753-4f70-af00-a0b04e8177ee', '187e9e27-047e-4110-96e5-f1b29f2f8f49', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('d3ce723f-a753-4f70-af00-a0b04e8177ee', '095c8fec-5803-4e68-9adb-08a071df4c27', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('d3ce723f-a753-4f70-af00-a0b04e8177ee', '4373d447-ecc6-4bad-9be8-9dbab2a1a24d', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('d3ce723f-a753-4f70-af00-a0b04e8177ee', 'a6da43b2-8086-4c66-ae29-d558881f6500', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('d3ce723f-a753-4f70-af00-a0b04e8177ee', '5dafac58-7730-4619-96fd-6a58246d8dd7', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('d3ce723f-a753-4f70-af00-a0b04e8177ee', 'f1b2f203-9076-4eff-b942-7d8daea1982c', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('d3ce723f-a753-4f70-af00-a0b04e8177ee', 'c03f855e-1da9-4da0-a2da-8f44af1852ca', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('d3ce723f-a753-4f70-af00-a0b04e8177ee', 'e9c5b896-590c-476a-a386-a095c32d394b', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('d3ce723f-a753-4f70-af00-a0b04e8177ee', '672ea201-9f39-4c02-a984-0310bbf23b4e', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('d3ce723f-a753-4f70-af00-a0b04e8177ee', 'dd99e65d-330e-4f26-b54e-23256be2e22f', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('d3ce723f-a753-4f70-af00-a0b04e8177ee', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('d3ce723f-a753-4f70-af00-a0b04e8177ee', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('d3ce723f-a753-4f70-af00-a0b04e8177ee', '06be78f5-f629-40b9-88a4-16d4d14b8f04', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('d3ce723f-a753-4f70-af00-a0b04e8177ee', '5d74e012-50bb-4cba-950e-248571b1f994', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
