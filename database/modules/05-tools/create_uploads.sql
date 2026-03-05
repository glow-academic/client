-- Module: create_uploads
-- Category: tool
-- Description: create_uploads MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bcc94-efdc-7de3-8e38-67841033ab51', 'create_uploads', '2026-01-17T15:31:11.448636+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('019bebc4-d436-7d20-945d-557447e427bd', '2026-01-17T17:57:40.542460+00:00', false, false, true, 'create_uploads', NULL, '{}', 'create', '{}', '{}', '{uploads}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bcc94-efdc-7baa-b653-bc57c229d70c', '2026-01-17T15:31:11.448636+00:00', '2026-01-17T15:31:11.448636+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_resources_junction
INSERT INTO public.tool_resources_junction (tool_id, resource_id, active, created_at, generated, mcp) VALUES ('019bcc94-efdc-7baa-b653-bc57c229d70c', '019c4f27-1787-7e6e-912c-f86cf2c07875', true, '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (tool_id, resource_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('019bcc94-efdc-7baa-b653-bc57c229d70c', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-01-17T15:31:11.448636+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('019bcc94-efdc-7baa-b653-bc57c229d70c', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bcc94-efdc-7baa-b653-bc57c229d70c', '019bcc94-efdc-7de3-8e38-67841033ab51', '2026-01-17T15:31:11.448636+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bcc94-efdc-7baa-b653-bc57c229d70c', '019bebc4-d436-7d20-945d-557447e427bd', true, '2026-01-17T17:57:40.542460+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
