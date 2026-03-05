-- Module: create_slugs
-- Category: tool
-- Description: create_slugs MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-78ff-aac4-e106cd6af4e1', 'value', '', 'number', true, '', '2026-01-09T03:07:20.516811+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7808-b077-a61492b4adbe', '019bbf87-091e-78ff-aac4-e106cd6af4e1', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0965-751e-bf8d-1f0c7563f20b', '019bbf87-091e-78ff-aac4-e106cd6af4e1', 'value', '{{ value }}', '2026-01-08T04:35:07.614135+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-744f-b38c-6449dfbf49be', 'Create a new slug', '2026-01-09T00:42:14.163715+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-73b5-aabd-3d739bbc7b93', 'create_slugs', '2026-01-09T00:42:14.163715+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('019bebc4-d436-7c99-9c5d-1d6d7e0aeb46', '2026-01-17T17:57:40.627996+00:00', false, false, true, 'create_slugs', 'Create a new slug', '{}', 'create', '{019bbf87-091e-78ff-aac4-e106cd6af4e1}', '{019bbf87-0965-751e-bf8d-1f0c7563f20b}', '{slugs}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019ba034-3316-7baa-8ec9-8324497eb095', '2026-01-09T00:42:14.163715+00:00', '2026-01-09T00:42:14.163715+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019ba034-3316-7baa-8ec9-8324497eb095', '019c4e6b-2c29-7808-b077-a61492b4adbe', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-7baa-8ec9-8324497eb095', '019bbf87-091e-78ff-aac4-e106cd6af4e1', '2026-01-09T03:07:20.508667+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-7baa-8ec9-8324497eb095', '019bbf87-0965-751e-bf8d-1f0c7563f20b', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-7baa-8ec9-8324497eb095', '019bbabc-5a32-744f-b38c-6449dfbf49be', '2026-01-09T00:42:14.163715+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_resources_junction
INSERT INTO public.tool_resources_junction (tool_id, resource_id, active, created_at, generated, mcp) VALUES ('019ba034-3316-7baa-8ec9-8324497eb095', '019bbeb4-5115-7637-981c-4731d894b7c9', '2026-01-09T00:42:14.163715+00:00', false, false) ON CONFLICT (tool_id, resource_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-7baa-8ec9-8324497eb095', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-01-09T00:42:14.163715+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('019ba034-3316-7baa-8ec9-8324497eb095', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-7baa-8ec9-8324497eb095', '019bbabc-5a32-73b5-aabd-3d739bbc7b93', '2026-01-09T00:42:14.163715+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019ba034-3316-7baa-8ec9-8324497eb095', '019bebc4-d436-7c99-9c5d-1d6d7e0aeb46', '2026-01-17T17:57:40.627996+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
