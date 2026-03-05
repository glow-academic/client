-- Module: create_examples
-- Category: tool
-- Description: create_examples MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-7aff-956e-478264bfba4c', 'example', '', 'string', true, '', '2026-01-08T15:38:57.769696+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-773a-8180-c66fbb54b3c1', '019bbf87-091e-7aff-956e-478264bfba4c', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-096a-7be8-96c2-0d6165087851', '019bbf87-091e-7aff-956e-478264bfba4c', 'example', '{{ example }}', '2026-01-08T15:38:57.769696+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-78b0-8fd7-7f51d7bd2ca9', 'Create a new examples resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-781c-a223-60afc48d9a4e', 'create_examples', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('019bebc4-d436-7c0f-9471-cfe52d274678', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_examples', 'Create a new examples resource', '{}', 'create', '{019bbf87-091e-7aff-956e-478264bfba4c}', '{019bbf87-096a-7be8-96c2-0d6165087851}', '{examples}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8046-7f89-9e98-55ada7ea06c9', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019b9f61-8046-7f89-9e98-55ada7ea06c9', '019c4e6b-2c29-773a-8180-c66fbb54b3c1', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-7f89-9e98-55ada7ea06c9', '019bbf87-091e-7aff-956e-478264bfba4c', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-7f89-9e98-55ada7ea06c9', '019bbf87-096a-7be8-96c2-0d6165087851', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-7f89-9e98-55ada7ea06c9', '019bbabc-5a30-78b0-8fd7-7f51d7bd2ca9', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, descriptions_id) DO NOTHING;
-- tool_resources_junction
INSERT INTO public.tool_resources_junction (tool_id, resources_id, active, created_at, generated, mcp) VALUES ('019b9f61-8046-7f89-9e98-55ada7ea06c9', '019bbeb4-510d-7525-8c1a-349828997019', true, '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (tool_id, resources_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flags_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-7f89-9e98-55ada7ea06c9', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flags_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operations_id, created_at, active, generated, mcp) VALUES ('019b9f61-8046-7f89-9e98-55ada7ea06c9', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operations_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, names_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-7f89-9e98-55ada7ea06c9', '019bbabc-5a30-781c-a223-60afc48d9a4e', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, names_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b9f61-8046-7f89-9e98-55ada7ea06c9', '019bebc4-d436-7c0f-9471-cfe52d274678', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
