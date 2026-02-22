-- Module: create_departments
-- Category: tool
-- Description: create_departments MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-7940-9825-c757e353ed6d', 'id', '', 'string', true, '', '2026-01-07T07:25:51.781825+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7729-a3b9-01b0489c9d9f', '019bbf87-091e-7940-9825-c757e353ed6d', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0965-77e7-8ab0-e35555bc6b29', '019bbf87-091e-7940-9825-c757e353ed6d', 'id', '', '2026-01-08T04:35:07.614923+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-741b-9908-9f16a872cd93', 'Create a new departments resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-7386-8bb6-7b7ffda06ebb', 'create_departments', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource) VALUES ('019bebc4-d436-7bf6-af0e-91e685a8f15e', '2026-01-17T17:58:56.069266+00:00', false, false, true, 'create_departments', 'Create a new departments resource', '{}', true, '{019bbf87-091e-7940-9825-c757e353ed6d}', '{019bbf87-0965-77e7-8ab0-e35555bc6b29}', 'departments') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8046-754a-b616-808dacbb6b9a', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019b9f61-8046-754a-b616-808dacbb6b9a', '019c4e6b-2c29-7729-a3b9-01b0489c9d9f', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-754a-b616-808dacbb6b9a', '019bbf87-091e-7940-9825-c757e353ed6d', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-754a-b616-808dacbb6b9a', '019bbf87-0965-77e7-8ab0-e35555bc6b29', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-754a-b616-808dacbb6b9a', '019bbabc-5a30-741b-9908-9f16a872cd93', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b9f61-8046-754a-b616-808dacbb6b9a', '019bbeb4-510c-7daf-9242-deed79a130df', true, '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8046-754a-b616-808dacbb6b9a', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8046-754a-b616-808dacbb6b9a', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-01-30T14:58:36.217041+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-8046-754a-b616-808dacbb6b9a', '019bbabc-5a30-7386-8bb6-7b7ffda06ebb', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b9f61-8046-754a-b616-808dacbb6b9a', '019bebc4-d436-7bf6-af0e-91e685a8f15e', true, '2026-01-17T17:58:56.069266+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
