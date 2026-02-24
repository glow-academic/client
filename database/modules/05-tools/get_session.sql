-- Module: get_session
-- Category: tool
-- Description: get_session MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019522a0-0030-7000-8000-000000000008', 'get_session', '2026-02-24T11:27:01.778199+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource, entry, artifact) VALUES ('019522a0-0020-7000-8000-000000000008', '2026-02-24T11:27:01.778199+00:00', false, false, true, 'get_session', 'Re-fetch session analytics context with fresh data.', '{}', false, '{}', '{}', NULL, NULL, 'session') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019522a0-0010-7000-8000-000000000008', '2026-02-24T11:27:01.778199+00:00', '2026-02-24T11:27:01.778199+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019522a0-0010-7000-8000-000000000008', '019522a0-0030-7000-8000-000000000008', '2026-02-24T11:27:01.778199+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019522a0-0010-7000-8000-000000000008', '019522a0-0020-7000-8000-000000000008', true, '2026-02-24T11:27:01.778199+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
