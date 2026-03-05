-- Module: create_auth_values
-- Category: tool
-- Description: create_auth_values MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-78ff-aac4-e106cd6af4e1', 'value', '', 'number', true, '', '2026-01-09T03:07:20.516811+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('09efa92d-8c4e-404c-9135-6738da4bb1e6', '019bbf87-091e-78ff-aac4-e106cd6af4e1', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0965-751e-bf8d-1f0c7563f20b', '019bbf87-091e-78ff-aac4-e106cd6af4e1', 'value', '{{ value }}', '2026-01-08T04:35:07.614135+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d89-7165-b53f-07899a8f3930', 'Create a new auth values resource', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d89-70d5-9a6e-63dee4fade53', 'create_auth_values', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('0dde45ed-a56e-44e6-bbbc-ed4314a40558', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'create_auth_values', 'Create a new auth value setting', '{}', 'create', '{019bbf87-091e-78ff-aac4-e106cd6af4e1}', '{019bbf87-0965-751e-bf8d-1f0c7563f20b}', '{}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('feb97d0c-ccbc-43c9-a9f8-d2ca39ecb15b', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('feb97d0c-ccbc-43c9-a9f8-d2ca39ecb15b', '09efa92d-8c4e-404c-9135-6738da4bb1e6', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('feb97d0c-ccbc-43c9-a9f8-d2ca39ecb15b', '019bbf87-091e-78ff-aac4-e106cd6af4e1', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('feb97d0c-ccbc-43c9-a9f8-d2ca39ecb15b', '019bbf87-0965-751e-bf8d-1f0c7563f20b', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('feb97d0c-ccbc-43c9-a9f8-d2ca39ecb15b', '019c82b8-5d89-7165-b53f-07899a8f3930', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('feb97d0c-ccbc-43c9-a9f8-d2ca39ecb15b', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('feb97d0c-ccbc-43c9-a9f8-d2ca39ecb15b', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('feb97d0c-ccbc-43c9-a9f8-d2ca39ecb15b', '019c82b8-5d89-70d5-9a6e-63dee4fade53', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('feb97d0c-ccbc-43c9-a9f8-d2ca39ecb15b', '0dde45ed-a56e-44e6-bbbc-ed4314a40558', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
