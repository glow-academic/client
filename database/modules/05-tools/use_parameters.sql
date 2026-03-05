-- Module: use_parameters
-- Category: tool
-- Description: use_parameters MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019c06a8-2afd-75ae-9a19-792e5677514b', 'parameter_id_link', 'The ID of the parameter to link', 'string', true, '', '2026-01-28T22:10:10.283595+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7949-9c8f-8b94164d97fc', '019c06a8-2afd-75ae-9a19-792e5677514b', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('cb9be910-a159-4695-9ae1-23e394391ce3', '019c06a8-2afd-75ae-9a19-792e5677514b', 'id', '{{ parameter_id_link }}', '2026-01-30T14:58:36.217917+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c06a8-2af8-7eb6-8207-f2ba700b05b9', 'use_parameters', '2026-01-28T22:10:10.283595+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('019c06a8-2af6-7439-b8fb-2a083dd49848', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_parameters', 'Use an existing parameter resource instead of creating a new one', '{}', 'link', '{019c06a8-2afd-75ae-9a19-792e5677514b}', '{cb9be910-a159-4695-9ae1-23e394391ce3}', '{parameters}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c06a8-2afb-7b0e-bb33-b3d4d68b638d', '2026-01-28T22:10:10.283595+00:00', '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c06a8-2afb-7b0e-bb33-b3d4d68b638d', '019c4e6b-2c29-7949-9c8f-8b94164d97fc', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afb-7b0e-bb33-b3d4d68b638d', '019c06a8-2afd-75ae-9a19-792e5677514b', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afb-7b0e-bb33-b3d4d68b638d', 'cb9be910-a159-4695-9ae1-23e394391ce3', '2026-01-30T14:58:36.217917+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_resources_junction
INSERT INTO public.tool_resources_junction (tool_id, resource_id, active, created_at, generated, mcp) VALUES ('019c06a8-2afb-7b0e-bb33-b3d4d68b638d', '019bbeb4-5112-7322-9f99-432c193ef502', true, '2026-02-12T01:05:03.953545+00:00', false, false) ON CONFLICT (tool_id, resource_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afb-7b0e-bb33-b3d4d68b638d', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-01-30T14:58:36.213184+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('019c06a8-2afb-7b0e-bb33-b3d4d68b638d', '019d0000-0001-7000-8000-000000000003', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afb-7b0e-bb33-b3d4d68b638d', '019c06a8-2af8-7eb6-8207-f2ba700b05b9', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c06a8-2afb-7b0e-bb33-b3d4d68b638d', '019c06a8-2af6-7439-b8fb-2a083dd49848', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
