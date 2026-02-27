-- Module: create_instructions
-- Category: tool
-- Description: create_instructions MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-7b6c-9615-1e6c74921f0c', 'template', '', 'string', true, '', '2026-01-06T15:55:22.225205+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7756-8e9e-fe58deb09c33', '019bbf87-091e-7b6c-9615-1e6c74921f0c', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0967-7186-9cad-d4af39fd98f9', '019bbf87-091e-7b6c-9615-1e6c74921f0c', 'template', '{{ template }}', '2026-01-06T15:55:22.225205+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-7c37-9d30-eab4c42a9a8e', 'Create a new instructions resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-7ba1-b023-c6c20c8eb613', 'create_instructions', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource, entry, artifact) VALUES ('019bebc4-d436-7c20-b35a-73c9819b708a', '2026-01-17T17:57:40.643852+00:00', false, false, true, 'create_instructions', 'Create a new instructions resource', '{}', true, '{019bbf87-091e-7b6c-9615-1e6c74921f0c}', '{019bbf87-0967-7186-9cad-d4af39fd98f9}', 'instructions', NULL, NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8047-76b0-89c6-cfc77fe86861', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019b9f61-8047-76b0-89c6-cfc77fe86861', '019c4e6b-2c29-7756-8e9e-fe58deb09c33', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-76b0-89c6-cfc77fe86861', '019bbf87-091e-7b6c-9615-1e6c74921f0c', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-76b0-89c6-cfc77fe86861', '019bbf87-0967-7186-9cad-d4af39fd98f9', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-76b0-89c6-cfc77fe86861', '019bbabc-5a30-7c37-9d30-eab4c42a9a8e', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_resources_junction
INSERT INTO public.tool_resources_junction (tool_id, resource_id, active, created_at, generated, mcp) VALUES ('019b9f61-8047-76b0-89c6-cfc77fe86861', '019bbeb4-5111-74d0-9786-60cef5204f41', true, '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (tool_id, resource_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8047-76b0-89c6-cfc77fe86861', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8047-76b0-89c6-cfc77fe86861', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-01-30T14:58:36.217041+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-76b0-89c6-cfc77fe86861', '019bbabc-5a30-7ba1-b023-c6c20c8eb613', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b9f61-8047-76b0-89c6-cfc77fe86861', '019bebc4-d436-7c20-b35a-73c9819b708a', true, '2026-01-17T17:57:40.643852+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
