-- Module: create_debug_info
-- Category: tool
-- Description: create_debug_info MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-768f-9c96-37941363873a', 'content', 'The text content of the assistant response message', 'string', true, '', '2026-01-06T15:55:22.222790+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-76cd-be35-1941ea6fbb46', '019bbf87-091e-768f-9c96-37941363873a', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0966-7327-b2a1-f5fbde584a12', '019bbf87-091e-768f-9c96-37941363873a', 'content', '{{ content }}', '2026-01-06T15:55:22.222222+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a2e-78a5-b005-b2920ea64015', 'Provide debug information about the current state, context, or reasoning. Use this tool to output internal state, debugging details, or diagnostic information.', '2025-12-31T00:25:53.747819+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a2e-7779-92f8-5add97837e30', 'create_debug_info', '2025-12-31T00:25:53.747819+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b71cc-0154-7343-b89d-96d865c3b7b8', '2025-12-31T00:25:53.747819+00:00', '2026-01-05T23:15:40.134472+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019b71cc-0154-7343-b89d-96d865c3b7b8', '019c4e6b-2c29-76cd-be35-1941ea6fbb46', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b71cc-0154-7343-b89d-96d865c3b7b8', '019bbf87-091e-768f-9c96-37941363873a', '2026-01-07T06:57:59.478106+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b71cc-0154-7343-b89d-96d865c3b7b8', '019bbf87-0966-7327-b2a1-f5fbde584a12', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b71cc-0154-7343-b89d-96d865c3b7b8', '019bbabc-5a2e-78a5-b005-b2920ea64015', '2025-12-31T00:25:53.747819+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b71cc-0154-7343-b89d-96d865c3b7b8', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2025-12-31T00:25:53.747819+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b71cc-0154-7343-b89d-96d865c3b7b8', '019bbabc-5a2e-7779-92f8-5add97837e30', '2025-12-31T00:25:53.747819+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
