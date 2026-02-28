-- Module: create_test_completion
-- Category: tool
-- Description: create_test_completion MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('2b25c2d0-9d28-4f4d-8928-c521884aee6a', 'test_completions', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('0991ed5f-7a6b-4a6f-a5ee-54e485552baf', 'invocation_id', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('c7f46aa7-92b9-4e5b-b4fd-27b28b2f00c7', '0991ed5f-7a6b-4a6f-a5ee-54e485552baf', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('09b3e372-3f98-4249-9265-0662c8bc4df8', '0991ed5f-7a6b-4a6f-a5ee-54e485552baf', 'invocation_id', '{{ invocation_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('ebe1fc9a-3375-4cef-a89b-fd2ca4583a96', 'end_reason', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('578b05b7-34da-4ca2-b236-a3120b6e7459', 'ebe1fc9a-3375-4cef-a89b-fd2ca4583a96', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('69b54fbc-bfd6-47d4-8091-fc7e250aa7b3', 'ebe1fc9a-3375-4cef-a89b-fd2ca4583a96', 'end_reason', '{{ end_reason }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('4d3948a2-8a73-4f08-ac79-95e79b6748ad', 'Create a new test completion entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('dc4a4329-b101-47e9-af68-93dfff733a7f', 'create_test_completion', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('8481ed99-2dea-450f-b3d0-bcf6edea717c', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_test_completion', 'Create a new test completion entry', '{}', 'create', '{0991ed5f-7a6b-4a6f-a5ee-54e485552baf,ebe1fc9a-3375-4cef-a89b-fd2ca4583a96}', '{09b3e372-3f98-4249-9265-0662c8bc4df8,69b54fbc-bfd6-47d4-8091-fc7e250aa7b3}', '{}'::text[], '{test_completions}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('6c7fd977-d8e5-4bbc-9237-a32e7fc524bc', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('6c7fd977-d8e5-4bbc-9237-a32e7fc524bc', 'c7f46aa7-92b9-4e5b-b4fd-27b28b2f00c7', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('6c7fd977-d8e5-4bbc-9237-a32e7fc524bc', '578b05b7-34da-4ca2-b236-a3120b6e7459', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('6c7fd977-d8e5-4bbc-9237-a32e7fc524bc', '0991ed5f-7a6b-4a6f-a5ee-54e485552baf', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('6c7fd977-d8e5-4bbc-9237-a32e7fc524bc', 'ebe1fc9a-3375-4cef-a89b-fd2ca4583a96', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('6c7fd977-d8e5-4bbc-9237-a32e7fc524bc', '09b3e372-3f98-4249-9265-0662c8bc4df8', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('6c7fd977-d8e5-4bbc-9237-a32e7fc524bc', '69b54fbc-bfd6-47d4-8091-fc7e250aa7b3', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('6c7fd977-d8e5-4bbc-9237-a32e7fc524bc', '2b25c2d0-9d28-4f4d-8928-c521884aee6a', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('6c7fd977-d8e5-4bbc-9237-a32e7fc524bc', '4d3948a2-8a73-4f08-ac79-95e79b6748ad', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('6c7fd977-d8e5-4bbc-9237-a32e7fc524bc', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('6c7fd977-d8e5-4bbc-9237-a32e7fc524bc', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('6c7fd977-d8e5-4bbc-9237-a32e7fc524bc', 'dc4a4329-b101-47e9-af68-93dfff733a7f', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('6c7fd977-d8e5-4bbc-9237-a32e7fc524bc', '8481ed99-2dea-450f-b3d0-bcf6edea717c', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
