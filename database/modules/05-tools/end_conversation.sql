-- Module: end_conversation
-- Category: tool
-- Description: end_conversation MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-76bb-aea5-9b1811fde09d', 'end_reason', '', 'string', true, '', '2026-01-06T15:55:22.226036+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-769f-a6ff-c8573eea0ca3', '019bbf87-091e-76bb-aea5-9b1811fde09d', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0969-7918-baff-8a6aea670506', '019bbf87-091e-76bb-aea5-9b1811fde09d', 'end_reason', '', '2026-01-06T15:55:22.226036+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-7f35-a956-ba65b1639fb4', 'End the conversation. This tool signals that the conversation should be terminated.', '2025-12-22T23:03:23.445951+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-7e9e-8e1d-07839a547584', 'end_conversation', '2025-12-22T23:03:23.445951+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('019bebc4-d436-7b79-9a9b-f4ca94396178', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'end_conversation', 'End the conversation. This tool signals that the conversation should be terminated.', '{}', NULL, '{019bbf87-091e-76bb-aea5-9b1811fde09d}', '{019bbf87-0969-7918-baff-8a6aea670506}', '{}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b484d-9837-760c-aa73-2421c6d107c0', '2025-12-22T23:03:23.445951+00:00', '2026-01-05T23:48:58.177470+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019b484d-9837-760c-aa73-2421c6d107c0', '019c4e6b-2c29-769f-a6ff-c8573eea0ca3', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b484d-9837-760c-aa73-2421c6d107c0', '019bbf87-091e-76bb-aea5-9b1811fde09d', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b484d-9837-760c-aa73-2421c6d107c0', '019bbf87-0969-7918-baff-8a6aea670506', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b484d-9837-760c-aa73-2421c6d107c0', '019bbabc-5a31-7f35-a956-ba65b1639fb4', '2025-12-22T23:03:23.445951+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b484d-9837-760c-aa73-2421c6d107c0', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2025-12-22T23:03:23.445951+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b484d-9837-760c-aa73-2421c6d107c0', '019bbabc-5a31-7e9e-8e1d-07839a547584', '2025-12-22T23:03:23.445951+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b484d-9837-760c-aa73-2421c6d107c0', '019bebc4-d436-7b79-9a9b-f4ca94396178', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
