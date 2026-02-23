-- Module: use_args
-- Category: tool
-- Description: use_args MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('f17f51a9-ef9b-4f85-87f8-4bb6feb83fe1', 'arg_id', '', 'string', true, '', '2026-02-21T22:16:39.602906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('aa0e4b06-b97c-431b-9d1c-c1a8d9e89e35', 'f17f51a9-ef9b-4f85-87f8-4bb6feb83fe1', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('a18aba5b-765f-4caf-832e-9bd9552d76f3', 'f17f51a9-ef9b-4f85-87f8-4bb6feb83fe1', 'id', '{{ arg_id }}', '2026-02-21T22:16:39.604747+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d8c-74a5-9c8b-668417a48b2e', 'Use an existing args resource instead of creating a new one', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d8c-7425-ab25-14e2eb3e8f43', 'use_args', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource, entry) VALUES ('f41134ae-290f-4105-b439-1cd01a94c4e3', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'use_args', 'Use an existing arg by its ID', '{}', false, '{f17f51a9-ef9b-4f85-87f8-4bb6feb83fe1}', '{a18aba5b-765f-4caf-832e-9bd9552d76f3}', NULL, NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('ef45a500-ed4c-45fc-a7d1-adac65e8c554', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('ef45a500-ed4c-45fc-a7d1-adac65e8c554', 'aa0e4b06-b97c-431b-9d1c-c1a8d9e89e35', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('ef45a500-ed4c-45fc-a7d1-adac65e8c554', 'f17f51a9-ef9b-4f85-87f8-4bb6feb83fe1', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('ef45a500-ed4c-45fc-a7d1-adac65e8c554', 'a18aba5b-765f-4caf-832e-9bd9552d76f3', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('ef45a500-ed4c-45fc-a7d1-adac65e8c554', '019c82b8-5d8c-74a5-9c8b-668417a48b2e', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('ef45a500-ed4c-45fc-a7d1-adac65e8c554', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('ef45a500-ed4c-45fc-a7d1-adac65e8c554', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-02-22T12:36:03.817884+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('ef45a500-ed4c-45fc-a7d1-adac65e8c554', '019c82b8-5d8c-7425-ab25-14e2eb3e8f43', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('ef45a500-ed4c-45fc-a7d1-adac65e8c554', 'f41134ae-290f-4105-b439-1cd01a94c4e3', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
