-- Module: create_uploads
-- Category: tool
-- Description: create_uploads MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bcc94-efdc-7de3-8e38-67841033ab51', 'create_uploads', '2026-01-17T15:31:11.448636+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource, entry) VALUES ('019bebc4-d436-7d20-945d-557447e427bd', '2026-01-17T17:57:40.542460+00:00', false, false, true, 'create_uploads', NULL, '{}', true, '{}', '{}', 'uploads', NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bcc94-efdc-7baa-b653-bc57c229d70c', '2026-01-17T15:31:11.448636+00:00', '2026-01-17T15:31:11.448636+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019bcc94-efdc-7baa-b653-bc57c229d70c', '019c4f27-1787-7e6e-912c-f86cf2c07875', true, '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bcc94-efdc-7baa-b653-bc57c229d70c', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-17T15:31:11.448636+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bcc94-efdc-7baa-b653-bc57c229d70c', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-02-22T12:36:03.817884+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bcc94-efdc-7baa-b653-bc57c229d70c', '019bcc94-efdc-7de3-8e38-67841033ab51', '2026-01-17T15:31:11.448636+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bcc94-efdc-7baa-b653-bc57c229d70c', '019bebc4-d436-7d20-945d-557447e427bd', true, '2026-01-17T17:57:40.542460+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
