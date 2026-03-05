-- Module: use_provider_keys
-- Category: tool
-- Description: use_provider_keys MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('606e39cb-6382-4dd1-850a-f23bbd6ac7d5', 'provider_key_id', '', 'string', true, '', '2026-02-21T22:16:39.602906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('bf40c2cb-1f93-42b7-a284-538a869a0077', '606e39cb-6382-4dd1-850a-f23bbd6ac7d5', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('75ef8fc7-80ab-4648-9c10-cb115e7583c2', '606e39cb-6382-4dd1-850a-f23bbd6ac7d5', 'id', '{{ provider_key_id }}', '2026-02-21T22:16:39.604747+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d8c-70c0-adf5-c8120aef4f6b', 'Use an existing provider keys resource instead of creating a new one', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d8c-7040-881d-44268ca8d492', 'use_provider_keys', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('b64a7415-bfaf-42cf-8737-f0dcc4ce39b6', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'use_provider_keys', 'Use an existing provider key by its ID', '{}', 'link', '{606e39cb-6382-4dd1-850a-f23bbd6ac7d5}', '{75ef8fc7-80ab-4648-9c10-cb115e7583c2}', '{}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('516a3f3d-2a75-4cb9-9f57-ed95d63bd32f', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('516a3f3d-2a75-4cb9-9f57-ed95d63bd32f', 'bf40c2cb-1f93-42b7-a284-538a869a0077', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('516a3f3d-2a75-4cb9-9f57-ed95d63bd32f', '606e39cb-6382-4dd1-850a-f23bbd6ac7d5', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('516a3f3d-2a75-4cb9-9f57-ed95d63bd32f', '75ef8fc7-80ab-4648-9c10-cb115e7583c2', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('516a3f3d-2a75-4cb9-9f57-ed95d63bd32f', '019c82b8-5d8c-70c0-adf5-c8120aef4f6b', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('516a3f3d-2a75-4cb9-9f57-ed95d63bd32f', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('516a3f3d-2a75-4cb9-9f57-ed95d63bd32f', '019d0000-0001-7000-8000-000000000003', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('516a3f3d-2a75-4cb9-9f57-ed95d63bd32f', '019c82b8-5d8c-7040-881d-44268ca8d492', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('516a3f3d-2a75-4cb9-9f57-ed95d63bd32f', 'b64a7415-bfaf-42cf-8737-f0dcc4ce39b6', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
