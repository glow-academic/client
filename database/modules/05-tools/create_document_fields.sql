-- Module: create_document_fields
-- Category: tool
-- Description: create_document_fields MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bf207-ca50-796a-9a4a-1c698533717c', 'Create a document field resource for linking document-type parameter fields to scenarios', '2026-01-24T22:02:35.441799+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bf207-ca50-74d3-98df-24139cfce3d3', 'create_document_fields', '2026-01-24T22:02:35.441799+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource) VALUES ('019bf207-ca51-72c1-b1ca-e06fd2334952', '2026-01-24T22:02:35.441799+00:00', false, false, true, 'create_document_fields', 'Create a document field resource for linking document-type parameter fields to scenarios', '{}', true, '{}', '{}', NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bf207-ca50-7037-ad70-eaa09e165bc4', '2026-01-24T22:02:35.441799+00:00', '2026-01-24T22:02:35.441799+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bf207-ca50-7037-ad70-eaa09e165bc4', '019bf207-ca50-796a-9a4a-1c698533717c', '2026-01-24T22:02:35.441799+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bf207-ca50-7037-ad70-eaa09e165bc4', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-24T22:02:35.441799+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bf207-ca50-7037-ad70-eaa09e165bc4', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-02-22T12:36:03.817884+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bf207-ca50-7037-ad70-eaa09e165bc4', '019bf207-ca50-74d3-98df-24139cfce3d3', '2026-01-24T22:02:35.441799+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bf207-ca50-7037-ad70-eaa09e165bc4', '019bf207-ca51-72c1-b1ca-e06fd2334952', true, '2026-01-24T22:02:35.441799+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
