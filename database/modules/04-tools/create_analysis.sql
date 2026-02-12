-- Module: create_analysis
-- Category: tool
-- Description: create_analysis MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-79c6-abb4-1331b9164b5e', '019c16d8-a123-7fb0-9fdb-a7ad98e9ee96', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-79ca-bedd-767bc4353959', '019c16d8-a123-7fd8-8a2d-9bc685609689', 1, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c16d8-a126-7ccf-b18e-217208ba3671', 'Create detailed analysis for a grade in the simulation', '2026-02-01T01:37:01.720364+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a2d-73f6-95b2-b023574fb6ef', 'create_analysis', '2025-12-29T19:41:03.614243+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7bbb-bd65-5f158fd12e4d', '2026-01-17T17:58:56.053417+00:00', false, false, true, 'create_analysis', 'Create an analysis of audio messages from the conversation. Specify which messages (by their numbers in the conversation history) you want to analyze and what aspects you want to evaluate.', '{}', false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c16d8-a126-7a29-8df7-fe06f8483301', '2026-02-01T01:37:01.720364+00:00', '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c16d8-a126-7a29-8df7-fe06f8483301', '019c4e6b-2c29-79c6-abb4-1331b9164b5e', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c16d8-a126-7a29-8df7-fe06f8483301', '019c4e6b-2c29-79ca-bedd-767bc4353959', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a126-7a29-8df7-fe06f8483301', '019c16d8-a123-7fb0-9fdb-a7ad98e9ee96', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a126-7a29-8df7-fe06f8483301', '019c16d8-a123-7fd8-8a2d-9bc685609689', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a126-7a29-8df7-fe06f8483301', '019c24ff-49ef-7df9-a09c-cb548d564fff', '2026-02-03T19:33:56.326236+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a126-7a29-8df7-fe06f8483301', '019c24ff-49ef-7f77-bea7-67c82142ea36', '2026-02-03T19:33:56.326236+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019c16d8-a126-7a29-8df7-fe06f8483301', '019c16d8-a126-7ccf-b18e-217208ba3671', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c16d8-a126-7a29-8df7-fe06f8483301', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c16d8-a126-7a29-8df7-fe06f8483301', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c16d8-a126-7a29-8df7-fe06f8483301', '019bbabc-5a2d-73f6-95b2-b023574fb6ef', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c16d8-a126-7a29-8df7-fe06f8483301', '019bebc4-d436-7bbb-bd65-5f158fd12e4d', true, '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
