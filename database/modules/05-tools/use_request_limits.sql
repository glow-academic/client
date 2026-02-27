-- Module: use_request_limits
-- Category: tool
-- Description: use_request_limits MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('fcfa0aec-a9a8-484e-bcb2-d3fcbe851fba', 'request_limit_id', '', 'string', true, '', '2026-02-21T22:16:39.602906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('e356ea5c-9d3f-41dc-847b-d755803b9b6e', 'fcfa0aec-a9a8-484e-bcb2-d3fcbe851fba', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('f48e6687-8360-4bc0-ba1e-064738901dc6', 'fcfa0aec-a9a8-484e-bcb2-d3fcbe851fba', 'id', '{{ request_limit_id }}', '2026-02-21T22:16:39.604747+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d8b-756f-86ee-fb24a09c68ec', 'Use an existing request limits resource instead of creating a new one', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d8b-74ea-926e-2c677dbccb9b', 'use_request_limits', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('611f8ec9-1863-402d-8c7a-88329f5721bb', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'use_request_limits', 'Use an existing request limit by its ID', '{}', 'link', '{fcfa0aec-a9a8-484e-bcb2-d3fcbe851fba}', '{f48e6687-8360-4bc0-ba1e-064738901dc6}', '{}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('8c851e97-fd25-4d48-94cb-c28f353d2703', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('8c851e97-fd25-4d48-94cb-c28f353d2703', 'e356ea5c-9d3f-41dc-847b-d755803b9b6e', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('8c851e97-fd25-4d48-94cb-c28f353d2703', 'fcfa0aec-a9a8-484e-bcb2-d3fcbe851fba', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('8c851e97-fd25-4d48-94cb-c28f353d2703', 'f48e6687-8360-4bc0-ba1e-064738901dc6', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('8c851e97-fd25-4d48-94cb-c28f353d2703', '019c82b8-5d8b-756f-86ee-fb24a09c68ec', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('8c851e97-fd25-4d48-94cb-c28f353d2703', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('8c851e97-fd25-4d48-94cb-c28f353d2703', '019d0000-0001-7000-8000-000000000003', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('8c851e97-fd25-4d48-94cb-c28f353d2703', '019c82b8-5d8b-74ea-926e-2c677dbccb9b', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('8c851e97-fd25-4d48-94cb-c28f353d2703', '611f8ec9-1863-402d-8c7a-88329f5721bb', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
