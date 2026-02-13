-- Module: create_icons
-- Category: tool
-- Description: create_icons MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7749-a25b-78c0fe54b9e9', '019bbf87-091e-73a9-b24d-e7ab977a5273', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-774c-a6b3-a60cc3d84a4b', '019bbf87-091e-78ff-aac4-e106cd6af4e1', 1, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7753-983e-f2bdce913abd', '019bbf87-091e-7373-8a48-37437e3ffde1', 2, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-7aeb-bd23-5f3aaf543c49', 'Create a new icons resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a30-7a59-ae39-a88e584ca51b', 'create_icons', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c1f-a77b-1140f364e2ef', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_icons', 'Create a new icons resource', '{}', false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8047-7438-8acc-be622d119c23', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019b9f61-8047-7438-8acc-be622d119c23', '019c4e6b-2c29-7749-a25b-78c0fe54b9e9', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019b9f61-8047-7438-8acc-be622d119c23', '019c4e6b-2c29-774c-a6b3-a60cc3d84a4b', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019b9f61-8047-7438-8acc-be622d119c23', '019c4e6b-2c29-7753-983e-f2bdce913abd', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7438-8acc-be622d119c23', '019bbf87-091e-78ff-aac4-e106cd6af4e1', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7438-8acc-be622d119c23', '019bbf87-091e-7373-8a48-37437e3ffde1', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7438-8acc-be622d119c23', '019bbf87-091e-73a9-b24d-e7ab977a5273', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7438-8acc-be622d119c23', '019bbf87-0964-77cd-ab26-d467f04ec130', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7438-8acc-be622d119c23', '019bbf87-0964-7ddd-9ac0-ca38f131c8b8', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7438-8acc-be622d119c23', '019bbf87-0965-751e-bf8d-1f0c7563f20b', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7438-8acc-be622d119c23', '019bbabc-5a30-7aeb-bd23-5f3aaf543c49', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019b9f61-8047-7438-8acc-be622d119c23', '019bbeb4-5111-70d0-920d-65f36aa57797', true, '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7438-8acc-be622d119c23', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7438-8acc-be622d119c23', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-01-30T14:58:36.217041+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-8047-7438-8acc-be622d119c23', '019bbabc-5a30-7a59-ae39-a88e584ca51b', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b9f61-8047-7438-8acc-be622d119c23', '019bebc4-d436-7c1f-a77b-1140f364e2ef', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
