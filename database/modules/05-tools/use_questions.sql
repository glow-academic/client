-- Module: use_questions
-- Category: tool
-- Description: use_questions MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-786e-bbff-3e50b51a7cd1', 'question_id', '', 'string', false, '', '2026-01-06T15:55:22.226036+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7973-bd76-011a30319ae8', '019bbf87-091e-786e-bbff-3e50b51a7cd1', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('0e366f8e-b831-4ecf-bc12-e29bdd9375e3', '019bbf87-091e-786e-bbff-3e50b51a7cd1', 'id', '{{ question_id }}', '2026-01-31T02:04:17.083661+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c0a2d-fc39-7e8b-86f1-81e24a46cdcc', 'use_questions', '2026-01-29T14:35:11.795021+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids) VALUES ('019c0a2d-fc36-7ace-adde-c1e47bc14a89', '2026-01-29T14:35:11.795021+00:00', false, false, true, 'use_questions', 'Use an existing question resource instead of creating a new one', '{}', false, '{019bbf87-091e-786e-bbff-3e50b51a7cd1}', '{0e366f8e-b831-4ecf-bc12-e29bdd9375e3}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c0a2d-fc39-7e15-8242-834b5133a8bb', '2026-01-29T14:35:11.795021+00:00', '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c0a2d-fc39-7e15-8242-834b5133a8bb', '019c4e6b-2c29-7973-bd76-011a30319ae8', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc39-7e15-8242-834b5133a8bb', '019bbf87-091e-786e-bbff-3e50b51a7cd1', '2026-01-29T14:35:11.795021+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc39-7e15-8242-834b5133a8bb', '0e366f8e-b831-4ecf-bc12-e29bdd9375e3', '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019c0a2d-fc39-7e15-8242-834b5133a8bb', '019bbeb4-5113-75c6-a321-30581b6e8b9c', true, '2026-02-12T01:05:03.953545+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0a2d-fc39-7e15-8242-834b5133a8bb', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c0a2d-fc39-7e15-8242-834b5133a8bb', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc39-7e15-8242-834b5133a8bb', '019c0a2d-fc39-7e8b-86f1-81e24a46cdcc', '2026-01-29T14:35:11.795021+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c0a2d-fc39-7e15-8242-834b5133a8bb', '019c0a2d-fc36-7ace-adde-c1e47bc14a89', true, '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
