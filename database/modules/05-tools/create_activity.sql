-- Module: create_activity
-- Category: tool
-- Description: create_activity MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('2fab505f-f119-4ab4-ae42-f535ef6fae40', 'activities', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('a9e437f1-c5d4-4019-a99f-07be0586cd7e', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('5dadd226-666c-4a43-ac2a-b1b2a5d3a7de', 'a9e437f1-c5d4-4019-a99f-07be0586cd7e', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('ae9a1447-1828-43f1-8121-d72c37956251', 'a9e437f1-c5d4-4019-a99f-07be0586cd7e', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('1041af33-c9e5-452b-8a43-8894869be4a5', 'last_active', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('e16198ec-011c-4185-8f66-85d62f327ae7', '1041af33-c9e5-452b-8a43-8894869be4a5', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('c385ab76-4655-423b-8095-88a74e44ec57', '1041af33-c9e5-452b-8a43-8894869be4a5', 'last_active', '{{ last_active }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('d4b64909-6765-4ed7-b637-43e2595eb512', 'Create a new activity entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('05c727e3-e473-4dea-a89d-304953689d0b', 'create_activity', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('7321bcf8-e12f-4823-904e-62fbfae0f81c', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_activity', 'Create a new activity entry', '{}', 'create', '{a9e437f1-c5d4-4019-a99f-07be0586cd7e,1041af33-c9e5-452b-8a43-8894869be4a5}', '{ae9a1447-1828-43f1-8121-d72c37956251,c385ab76-4655-423b-8095-88a74e44ec57}', '{}'::text[], '{activities}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('e0bb1917-314c-411e-adbb-e1a184aa7f04', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('e0bb1917-314c-411e-adbb-e1a184aa7f04', '5dadd226-666c-4a43-ac2a-b1b2a5d3a7de', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('e0bb1917-314c-411e-adbb-e1a184aa7f04', 'e16198ec-011c-4185-8f66-85d62f327ae7', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('e0bb1917-314c-411e-adbb-e1a184aa7f04', 'a9e437f1-c5d4-4019-a99f-07be0586cd7e', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('e0bb1917-314c-411e-adbb-e1a184aa7f04', '1041af33-c9e5-452b-8a43-8894869be4a5', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('e0bb1917-314c-411e-adbb-e1a184aa7f04', 'ae9a1447-1828-43f1-8121-d72c37956251', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('e0bb1917-314c-411e-adbb-e1a184aa7f04', 'c385ab76-4655-423b-8095-88a74e44ec57', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('e0bb1917-314c-411e-adbb-e1a184aa7f04', '2fab505f-f119-4ab4-ae42-f535ef6fae40', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('e0bb1917-314c-411e-adbb-e1a184aa7f04', 'd4b64909-6765-4ed7-b637-43e2595eb512', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('e0bb1917-314c-411e-adbb-e1a184aa7f04', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('e0bb1917-314c-411e-adbb-e1a184aa7f04', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('e0bb1917-314c-411e-adbb-e1a184aa7f04', '05c727e3-e473-4dea-a89d-304953689d0b', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('e0bb1917-314c-411e-adbb-e1a184aa7f04', '7321bcf8-e12f-4823-904e-62fbfae0f81c', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
