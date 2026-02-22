-- Module: use_documents
-- Category: tool
-- Description: use_documents MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019c0a2d-fc3b-7713-bd61-06feccddfcc8', 'document_id', 'The ID of the document to link', 'string', true, '', '2026-01-29T14:35:11.795021+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-796e-8ba8-90df5179dd1c', '019c0a2d-fc3b-7713-bd61-06feccddfcc8', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('fe4a69ea-eb46-41db-a4c2-1b0d3fc23490', '019c0a2d-fc3b-7713-bd61-06feccddfcc8', 'id', '{{ document_id }}', '2026-01-31T02:04:17.083661+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c0a2d-fc39-7376-ac5d-0766d75f240a', 'use_documents', '2026-01-29T14:35:11.795021+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource) VALUES ('019c0a2d-fc35-7eb7-8bc4-4a4d9578918d', '2026-01-29T14:35:11.795021+00:00', false, false, true, 'use_documents', 'Use an existing document resource instead of creating a new one', '{}', false, '{019c0a2d-fc3b-7713-bd61-06feccddfcc8}', '{fe4a69ea-eb46-41db-a4c2-1b0d3fc23490}', 'documents') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c0a2d-fc39-718f-a4ad-c92f335718e8', '2026-01-29T14:35:11.795021+00:00', '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c0a2d-fc39-718f-a4ad-c92f335718e8', '019c4e6b-2c29-796e-8ba8-90df5179dd1c', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc39-718f-a4ad-c92f335718e8', '019c0a2d-fc3b-7713-bd61-06feccddfcc8', '2026-01-29T14:35:11.795021+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc39-718f-a4ad-c92f335718e8', 'fe4a69ea-eb46-41db-a4c2-1b0d3fc23490', '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019c0a2d-fc39-718f-a4ad-c92f335718e8', '019bbeb4-510d-7028-bf31-9136f3e10c9e', true, '2026-02-12T01:05:03.953545+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0a2d-fc39-718f-a4ad-c92f335718e8', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0a2d-fc39-718f-a4ad-c92f335718e8', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc39-718f-a4ad-c92f335718e8', '019c0a2d-fc39-7376-ac5d-0766d75f240a', '2026-01-29T14:35:11.795021+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c0a2d-fc39-718f-a4ad-c92f335718e8', '019c0a2d-fc35-7eb7-8bc4-4a4d9578918d', true, '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
