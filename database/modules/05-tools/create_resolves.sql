-- Module: create_resolves
-- Category: tool
-- Description: create_resolves MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('c1deb8c5-fe94-45a2-8c8b-2853662809bc', 'resolves', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('d9a17a75-7a20-449c-80dc-a3cd0a3c21c7', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('ebee8d2f-4a75-40cb-98d7-a8b0c80a4fcb', 'd9a17a75-7a20-449c-80dc-a3cd0a3c21c7', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('bdd52e90-55ea-43b3-90ec-f928852fcdae', 'd9a17a75-7a20-449c-80dc-a3cd0a3c21c7', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('7a591e8e-86cb-42b4-a7f3-e3bf113e8ba7', 'problem_id', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('7e4694b0-7c95-4485-8742-07876cc9afe8', '7a591e8e-86cb-42b4-a7f3-e3bf113e8ba7', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('23a192e2-a857-45f2-83b4-5a7053984be5', '7a591e8e-86cb-42b4-a7f3-e3bf113e8ba7', 'problem_id', '{{ problem_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('26347bd6-3942-4478-a586-479ae6a200bf', 'resolved', '', 'boolean', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('5df3624a-7d4c-4ed6-9439-82cc652cf86e', '26347bd6-3942-4478-a586-479ae6a200bf', 2, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('75c1f7cc-13a2-4589-9f97-663e6d991045', '26347bd6-3942-4478-a586-479ae6a200bf', 'resolved', '{{ resolved }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('ff6ac68d-b52b-419a-902e-9702cf5e1d33', 'Create a new resolves entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('27749a9a-e2d4-4349-8ba9-5880709838f8', 'create_resolves', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('81f4bb65-67d7-4ea9-958c-a796de91df74', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_resolves', 'Create a new resolves entry', '{}', 'create', '{d9a17a75-7a20-449c-80dc-a3cd0a3c21c7,7a591e8e-86cb-42b4-a7f3-e3bf113e8ba7,26347bd6-3942-4478-a586-479ae6a200bf}', '{bdd52e90-55ea-43b3-90ec-f928852fcdae,23a192e2-a857-45f2-83b4-5a7053984be5,75c1f7cc-13a2-4589-9f97-663e6d991045}', '{}'::text[], '{resolves}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('2064488e-eceb-4694-9c67-b1f3b090ce3a', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('2064488e-eceb-4694-9c67-b1f3b090ce3a', 'ebee8d2f-4a75-40cb-98d7-a8b0c80a4fcb', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('2064488e-eceb-4694-9c67-b1f3b090ce3a', '7e4694b0-7c95-4485-8742-07876cc9afe8', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('2064488e-eceb-4694-9c67-b1f3b090ce3a', '5df3624a-7d4c-4ed6-9439-82cc652cf86e', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('2064488e-eceb-4694-9c67-b1f3b090ce3a', 'd9a17a75-7a20-449c-80dc-a3cd0a3c21c7', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('2064488e-eceb-4694-9c67-b1f3b090ce3a', '7a591e8e-86cb-42b4-a7f3-e3bf113e8ba7', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('2064488e-eceb-4694-9c67-b1f3b090ce3a', '26347bd6-3942-4478-a586-479ae6a200bf', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('2064488e-eceb-4694-9c67-b1f3b090ce3a', 'bdd52e90-55ea-43b3-90ec-f928852fcdae', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('2064488e-eceb-4694-9c67-b1f3b090ce3a', '23a192e2-a857-45f2-83b4-5a7053984be5', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('2064488e-eceb-4694-9c67-b1f3b090ce3a', '75c1f7cc-13a2-4589-9f97-663e6d991045', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entries_id, active, created_at, generated, mcp) VALUES ('2064488e-eceb-4694-9c67-b1f3b090ce3a', 'c1deb8c5-fe94-45a2-8c8b-2853662809bc', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entries_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, descriptions_id, created_at, generated, mcp, active) VALUES ('2064488e-eceb-4694-9c67-b1f3b090ce3a', 'ff6ac68d-b52b-419a-902e-9702cf5e1d33', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, descriptions_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flags_id, created_at, generated, mcp, active) VALUES ('2064488e-eceb-4694-9c67-b1f3b090ce3a', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flags_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operations_id, created_at, active, generated, mcp) VALUES ('2064488e-eceb-4694-9c67-b1f3b090ce3a', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operations_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, names_id, created_at, generated, mcp, active) VALUES ('2064488e-eceb-4694-9c67-b1f3b090ce3a', '27749a9a-e2d4-4349-8ba9-5880709838f8', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, names_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('2064488e-eceb-4694-9c67-b1f3b090ce3a', '81f4bb65-67d7-4ea9-958c-a796de91df74', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
