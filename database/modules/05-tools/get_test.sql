-- Module: get_test
-- Category: tool
-- Description: get_test MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.artifacts_resource (id, artifact, active, generated, mcp, created_at) VALUES ('019c8d5a-6426-7d6f-bee2-47fae12b0dec', 'test', true, false, false, '2026-02-24T01:53:57.278464+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019522a0-0030-7000-8000-00000000000d', 'get_test', '2026-02-24T11:27:01.778199+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource, entry, artifact) VALUES ('019522a0-0020-7000-8000-00000000000d', '2026-02-24T11:27:01.778199+00:00', false, false, true, 'get_test', 'Re-fetch test grading context with fresh data.', '{}', false, '{}', '{}', NULL, NULL, 'test') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019522a0-0010-7000-8000-00000000000d', '2026-02-24T11:27:01.778199+00:00', '2026-02-24T11:27:01.778199+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_artifacts_junction
INSERT INTO public.tool_artifacts_junction (tool_id, artifact_id, active, generated, mcp, created_at) VALUES ('019522a0-0010-7000-8000-00000000000d', '019c8d5a-6426-7d6f-bee2-47fae12b0dec', true, false, false, '2026-02-24T11:27:01.778199+00:00') ON CONFLICT (tool_id, artifact_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019522a0-0010-7000-8000-00000000000d', '019522a0-0030-7000-8000-00000000000d', '2026-02-24T11:27:01.778199+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019522a0-0010-7000-8000-00000000000d', '019522a0-0020-7000-8000-00000000000d', true, '2026-02-24T11:27:01.778199+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
