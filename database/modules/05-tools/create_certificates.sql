-- Module: create_certificates
-- Category: tool
-- Description: create_certificates MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('401efc30-63cc-42f4-bbad-eb0979d46f09', 'certificates', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('c1e9fc3d-6635-4198-82c3-223b3d20647e', 'upload_id', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('cdf3722d-5c83-4e04-b8a9-6775f26b6775', 'c1e9fc3d-6635-4198-82c3-223b3d20647e', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('b1577e3a-3401-4468-b61e-44b6a6dd464a', 'c1e9fc3d-6635-4198-82c3-223b3d20647e', 'upload_id', '{{ upload_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('595d60ce-4f0f-4acc-a30f-18c50fc50bf3', 'Create a new certificates entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('4fc6992b-bf67-4675-9b92-a48ff39f98a0', 'create_certificates', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('50a7eeea-b11b-4768-9604-1951c8f0d436', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_certificates', 'Create a new certificates entry', '{}', 'create', '{c1e9fc3d-6635-4198-82c3-223b3d20647e}', '{b1577e3a-3401-4468-b61e-44b6a6dd464a}', '{}'::text[], '{certificates}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('cf6994f6-848a-4aa0-816e-5e8db90f838d', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('cf6994f6-848a-4aa0-816e-5e8db90f838d', 'cdf3722d-5c83-4e04-b8a9-6775f26b6775', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('cf6994f6-848a-4aa0-816e-5e8db90f838d', 'c1e9fc3d-6635-4198-82c3-223b3d20647e', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('cf6994f6-848a-4aa0-816e-5e8db90f838d', 'b1577e3a-3401-4468-b61e-44b6a6dd464a', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('cf6994f6-848a-4aa0-816e-5e8db90f838d', '401efc30-63cc-42f4-bbad-eb0979d46f09', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('cf6994f6-848a-4aa0-816e-5e8db90f838d', '595d60ce-4f0f-4acc-a30f-18c50fc50bf3', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('cf6994f6-848a-4aa0-816e-5e8db90f838d', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('cf6994f6-848a-4aa0-816e-5e8db90f838d', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('cf6994f6-848a-4aa0-816e-5e8db90f838d', '4fc6992b-bf67-4675-9b92-a48ff39f98a0', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('cf6994f6-848a-4aa0-816e-5e8db90f838d', '50a7eeea-b11b-4768-9604-1951c8f0d436', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
