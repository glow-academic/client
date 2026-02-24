-- Module: create_hint
-- Category: tool
-- Description: create_hint MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-72cb-b3b5-5e90e16254b2', 'hint', 'A helpful hint for the student related to the current conversation', 'string', false, '', '2026-01-05T00:28:02.003807+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-79b0-b6bc-70c57076d6a9', '019bbf87-091e-72cb-b3b5-5e90e16254b2', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-7a33-aa90-781a6dc10b10', 'message_id', 'The assistant message ID from the Current Assistant Message context above', 'string', true, '', '2026-01-08T04:35:07.612931+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-79b6-8d13-6540c0170fd1', '019bbf87-091e-7a33-aa90-781a6dc10b10', 1, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-096a-76f9-8b4d-4516886a1626', '019bbf87-091e-7a33-aa90-781a6dc10b10', 'message_id', '{{ message_id }}', '2026-01-08T04:35:07.612931+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0965-7d8c-b246-dd3411515aca', '019bbf87-091e-72cb-b3b5-5e90e16254b2', 'hint', '{{ hint }}', '2026-01-06T15:55:22.222222+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c16d8-a123-735a-97bb-02658124651d', 'Create a hint for a message in the simulation', '2026-02-01T01:37:01.720364+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a2e-7db7-a230-390bd0ff9a90', 'create_hint', '2025-12-29T19:41:03.614243+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource, entry, artifact) VALUES ('019bebc4-d436-7ba3-9c29-c24f308f6e56', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_hint', 'Create a strategic hint for the GTA. This is one of multiple hints that should be distinct and focused on different aspects of helping the student (e.g., content explanation, emotional support, pedagogical approach). Call this tool multiple times to create multiple hints.', '{}', true, '{019bbf87-091e-7a33-aa90-781a6dc10b10,019bbf87-091e-72cb-b3b5-5e90e16254b2}', '{019bbf87-096a-76f9-8b4d-4516886a1626,019bbf87-0965-7d8c-b246-dd3411515aca}', NULL, 'hints', NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c16d8-a123-7040-9a24-0fed772143a1', '2026-02-01T01:37:01.720364+00:00', '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c16d8-a123-7040-9a24-0fed772143a1', '019c4e6b-2c29-79b0-b6bc-70c57076d6a9', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c16d8-a123-7040-9a24-0fed772143a1', '019c4e6b-2c29-79b6-8d13-6540c0170fd1', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a123-7040-9a24-0fed772143a1', '019bbf87-091e-7a33-aa90-781a6dc10b10', '2026-02-04T03:14:18.138015+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c16d8-a123-7040-9a24-0fed772143a1', '019bbf87-091e-72cb-b3b5-5e90e16254b2', '2026-02-04T03:14:18.138015+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a123-7040-9a24-0fed772143a1', '019bbf87-096a-76f9-8b4d-4516886a1626', '2026-02-04T03:14:18.138015+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c16d8-a123-7040-9a24-0fed772143a1', '019bbf87-0965-7d8c-b246-dd3411515aca', '2026-02-04T03:14:18.138015+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_bindings_junction
INSERT INTO public.tool_bindings_junction (tool_id, binding_id, active, created_at, generated, mcp) VALUES ('019c16d8-a123-7040-9a24-0fed772143a1', '10215b8d-6e4b-48da-9041-a94e439f3f9a', true, '2026-02-19T14:14:23.735268+00:00', false, false) ON CONFLICT (tool_id, binding_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019c16d8-a123-7040-9a24-0fed772143a1', '019c16d8-a123-735a-97bb-02658124651d', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c16d8-a123-7040-9a24-0fed772143a1', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c16d8-a123-7040-9a24-0fed772143a1', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c16d8-a123-7040-9a24-0fed772143a1', '019bbabc-5a2e-7db7-a230-390bd0ff9a90', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c16d8-a123-7040-9a24-0fed772143a1', '019bebc4-d436-7ba3-9c29-c24f308f6e56', true, '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
