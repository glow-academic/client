-- Module: create_points
-- Category: tool
-- Description: create_points MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7776-baa7-b90705d1acdf', '019bbf87-091e-78ff-aac4-e106cd6af4e1', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-725e-a959-bcc0f6db87d5', 'Create a new points resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-71cb-b2f2-17c8eed33688', 'create_points', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c48-bbb0-2700d1deb830', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_points', 'Create a new points resource', '{}', false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8048-719b-a6ab-b1b122c0eb49', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019b9f61-8048-719b-a6ab-b1b122c0eb49', '019c4e6b-2c29-7776-baa7-b90705d1acdf', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-719b-a6ab-b1b122c0eb49', '019bbf87-091e-78ff-aac4-e106cd6af4e1', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-719b-a6ab-b1b122c0eb49', '019bbf87-0965-751e-bf8d-1f0c7563f20b', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-719b-a6ab-b1b122c0eb49', '019bbabc-5a31-725e-a959-bcc0f6db87d5', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b9f61-8048-719b-a6ab-b1b122c0eb49', '019bbeb4-5112-7598-af4d-23b2c7581e1c', true, '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8048-719b-a6ab-b1b122c0eb49', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-719b-a6ab-b1b122c0eb49', '019bbabc-5a31-71cb-b2f2-17c8eed33688', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b9f61-8048-719b-a6ab-b1b122c0eb49', '019bebc4-d436-7c48-bbb0-2700d1deb830', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
