-- Module: create_scenario_flags
-- Category: tool
-- Description: create_scenario_flags MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-78f5-9140-04a2aa440fdb', '019bbf87-091e-73a9-b24d-e7ab977a5273', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-78fa-b804-11afd5ce3f2e', '019bbf87-091f-741e-9750-ffa018c4a030', 1, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-78fd-995e-13c929ee2dd9', '019bbf87-091e-7373-8a48-37437e3ffde1', 2, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7900-b210-469b406bee65', '019bbf87-091e-7b2c-b67b-68a41ee0f8d3', 3, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbdce-8408-7f66-8f29-a70fc93f092e', 'Create a new scenario_flags resource', '2026-01-14T18:39:46.667548+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbdce-8408-7e72-b506-c305a516479d', 'create_scenario_flags', '2026-01-14T18:39:46.667548+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7d09-a5fb-d51eae133785', '2026-01-17T17:57:40.541885+00:00', false, false, true, 'create_scenario_flags', 'Create a new scenario_flags resource', '{}', false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bbdce-8408-7e3b-83eb-98c7d8953380', '2026-01-14T18:39:46.667548+00:00', '2026-01-14T18:39:46.667548+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019bbdce-8408-7e3b-83eb-98c7d8953380', '019c4e6b-2c29-78f5-9140-04a2aa440fdb', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019bbdce-8408-7e3b-83eb-98c7d8953380', '019c4e6b-2c29-78fa-b804-11afd5ce3f2e', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019bbdce-8408-7e3b-83eb-98c7d8953380', '019c4e6b-2c29-78fd-995e-13c929ee2dd9', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019bbdce-8408-7e3b-83eb-98c7d8953380', '019c4e6b-2c29-7900-b210-469b406bee65', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-7e3b-83eb-98c7d8953380', '019bbf87-091f-741e-9750-ffa018c4a030', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-7e3b-83eb-98c7d8953380', '019bbf87-091e-7b2c-b67b-68a41ee0f8d3', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-7e3b-83eb-98c7d8953380', '019bbf87-091e-73a9-b24d-e7ab977a5273', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-7e3b-83eb-98c7d8953380', '019bbf87-091e-7373-8a48-37437e3ffde1', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-7e3b-83eb-98c7d8953380', '019bbf87-0964-77cd-ab26-d467f04ec130', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-7e3b-83eb-98c7d8953380', '019bbf87-0964-7ddd-9ac0-ca38f131c8b8', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-7e3b-83eb-98c7d8953380', '019bbf87-0965-7033-95af-445ff0be8f46', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-7e3b-83eb-98c7d8953380', '019bbf87-0965-723f-9fa6-99aaa445f4fc', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-7e3b-83eb-98c7d8953380', '019bbdce-8408-7f66-8f29-a70fc93f092e', '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019bbdce-8408-7e3b-83eb-98c7d8953380', '019bbeb4-5114-7893-8560-ee7cb288b34b', true, '2026-01-14T22:50:46.919286+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bbdce-8408-7e3b-83eb-98c7d8953380', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bbdce-8408-7e3b-83eb-98c7d8953380', '019bbdce-8408-7e72-b506-c305a516479d', '2026-01-14T18:39:46.667548+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bbdce-8408-7e3b-83eb-98c7d8953380', '019bebc4-d436-7d09-a5fb-d51eae133785', true, '2026-01-17T17:57:40.541885+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
