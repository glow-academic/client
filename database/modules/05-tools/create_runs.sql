-- Module: create_runs
-- Category: tool
-- Description: create_runs MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-741e-9750-ffa018c4a030', 'active', '', 'boolean', true, 'true', '2026-01-13T03:25:29.718071+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-78de-9d82-e822cfe8929a', '019bbf87-091f-741e-9750-ffa018c4a030', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-76bc-b6e2-a34bca37f12d', 'run_id', '', 'string', true, '', '2026-01-14T18:39:46.698365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-78e0-b889-10cef7a1f7de', '019bbf87-091f-76bc-b6e2-a34bca37f12d', 1, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0967-72eb-9d83-366f75833a50', '019bbf87-091f-76bc-b6e2-a34bca37f12d', 'run_id', '{{ run_id }}', '2026-01-14T18:39:46.698365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0965-723f-9fa6-99aaa445f4fc', '019bbf87-091f-741e-9750-ffa018c4a030', 'active', '{{ active }}', '2026-01-14T18:39:46.698365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbdce-8408-771b-b51f-702aa4aec91b', 'Create a new runs resource', '2026-01-14T18:39:46.667548+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbdce-8408-7615-89fc-f48339014eb0', 'create_runs', '2026-01-14T18:39:46.667548+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource, entry) VALUES ('019bebc4-d436-7cfd-9d16-5083f373be80', '2026-01-17T17:58:56.053417+00:00', false, false, true, 'create_runs', 'Create a new runs resource', '{}', true, '{019bbf87-091f-741e-9750-ffa018c4a030,019bbf87-091f-76bc-b6e2-a34bca37f12d}', '{019bbf87-0967-72eb-9d83-366f75833a50,019bbf87-0965-723f-9fa6-99aaa445f4fc}', 'runs', NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bbdce-8408-75ce-81b3-c505baefbe9f', '2026-01-14T18:39:46.667548+00:00', '2026-01-14T18:39:46.667548+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019bbdce-8408-75ce-81b3-c505baefbe9f', '019c4e6b-2c29-78de-9d82-e822cfe8929a', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019bbdce-8408-75ce-81b3-c505baefbe9f', '019c4e6b-2c29-78e0-b889-10cef7a1f7de', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-75ce-81b3-c505baefbe9f', '019bbf87-091f-741e-9750-ffa018c4a030', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-75ce-81b3-c505baefbe9f', '019bbf87-091f-76bc-b6e2-a34bca37f12d', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-75ce-81b3-c505baefbe9f', '019bbf87-0967-72eb-9d83-366f75833a50', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-75ce-81b3-c505baefbe9f', '019bbf87-0965-723f-9fa6-99aaa445f4fc', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-75ce-81b3-c505baefbe9f', '019bbdce-8408-771b-b51f-702aa4aec91b', '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019bbdce-8408-75ce-81b3-c505baefbe9f', '019bbeb4-5114-72d4-b96a-9fd8355f0946', true, '2026-01-14T22:50:46.919286+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bbdce-8408-75ce-81b3-c505baefbe9f', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bbdce-8408-75ce-81b3-c505baefbe9f', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-02-22T12:36:03.817884+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-75ce-81b3-c505baefbe9f', '019bbdce-8408-7615-89fc-f48339014eb0', '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bbdce-8408-75ce-81b3-c505baefbe9f', '019bebc4-d436-7cfd-9d16-5083f373be80', true, '2026-01-17T17:58:56.053417+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
