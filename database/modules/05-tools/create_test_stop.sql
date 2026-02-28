-- Module: create_test_stop
-- Category: tool
-- Description: create_test_stop MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('5a05d62d-9957-431f-bcc9-55ccde45333a', 'test_stops', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('8e083e1e-1c7d-4810-afdd-616d501ac20d', 'invocation_id', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('2a8aa76b-a0a0-42f0-bf8f-82d8a74b3ee2', '8e083e1e-1c7d-4810-afdd-616d501ac20d', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('64c9f4e1-1b22-48fc-a2cd-9dbf7a663f37', '8e083e1e-1c7d-4810-afdd-616d501ac20d', 'invocation_id', '{{ invocation_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('f83aee6e-7af7-4d1d-a0f6-c14ff40afb32', 'stopped', '', 'boolean', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('fdcfd46c-b808-400f-a50a-1295a0301106', 'f83aee6e-7af7-4d1d-a0f6-c14ff40afb32', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('be63878f-a272-43ce-8faf-ea25dee4db77', 'f83aee6e-7af7-4d1d-a0f6-c14ff40afb32', 'stopped', '{{ stopped }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('af8d1761-7b82-4d2a-88b4-7cc1a7e9df59', 'Create a new test stop entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('f57e818b-1bd6-4b29-80ef-23f3c8a01fbc', 'create_test_stop', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('6c2f97e7-25c9-4a85-8b58-5c0180910650', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_test_stop', 'Create a new test stop entry', '{}', 'create', '{8e083e1e-1c7d-4810-afdd-616d501ac20d,f83aee6e-7af7-4d1d-a0f6-c14ff40afb32}', '{64c9f4e1-1b22-48fc-a2cd-9dbf7a663f37,be63878f-a272-43ce-8faf-ea25dee4db77}', '{}'::text[], '{test_stops}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('47b5f8ad-1e49-4f9c-a3f1-84225106da50', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('47b5f8ad-1e49-4f9c-a3f1-84225106da50', '2a8aa76b-a0a0-42f0-bf8f-82d8a74b3ee2', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('47b5f8ad-1e49-4f9c-a3f1-84225106da50', 'fdcfd46c-b808-400f-a50a-1295a0301106', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('47b5f8ad-1e49-4f9c-a3f1-84225106da50', '8e083e1e-1c7d-4810-afdd-616d501ac20d', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('47b5f8ad-1e49-4f9c-a3f1-84225106da50', 'f83aee6e-7af7-4d1d-a0f6-c14ff40afb32', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('47b5f8ad-1e49-4f9c-a3f1-84225106da50', '64c9f4e1-1b22-48fc-a2cd-9dbf7a663f37', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('47b5f8ad-1e49-4f9c-a3f1-84225106da50', 'be63878f-a272-43ce-8faf-ea25dee4db77', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('47b5f8ad-1e49-4f9c-a3f1-84225106da50', '5a05d62d-9957-431f-bcc9-55ccde45333a', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('47b5f8ad-1e49-4f9c-a3f1-84225106da50', 'af8d1761-7b82-4d2a-88b4-7cc1a7e9df59', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('47b5f8ad-1e49-4f9c-a3f1-84225106da50', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('47b5f8ad-1e49-4f9c-a3f1-84225106da50', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('47b5f8ad-1e49-4f9c-a3f1-84225106da50', 'f57e818b-1bd6-4b29-80ef-23f3c8a01fbc', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('47b5f8ad-1e49-4f9c-a3f1-84225106da50', '6c2f97e7-25c9-4a85-8b58-5c0180910650', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
