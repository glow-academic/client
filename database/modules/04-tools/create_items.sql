-- Module: create_items
-- Category: tool
-- Description: create_items MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-77f6-886e-5c7e32ee1420', '019bbf87-091e-73a9-b24d-e7ab977a5273', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-77f8-9d68-6cb1c6658295', '019bbf87-091e-7373-8a48-37437e3ffde1', 1, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-77fd-8c55-0497a89b7e99', '019bbf87-091f-703e-9eaf-f12c50e333b6', 2, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7802-b9e3-0d4309313bc6', '019bbf87-091e-7c5d-a34a-879167cadd9f', 3, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-7247-863a-244c6f4cd7e4', 'Create a new item', '2026-01-09T00:42:14.163715+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-71ad-a475-644065247b0f', 'create_items', '2026-01-09T00:42:14.163715+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c8f-9f19-28ba6dc8519f', '2026-01-17T17:57:40.627996+00:00', false, false, true, 'create_items', 'Create a new item', '{}', false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019ba034-3316-70ea-971d-082721b6d2d9', '2026-01-09T00:42:14.163715+00:00', '2026-01-09T00:42:14.163715+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019ba034-3316-70ea-971d-082721b6d2d9', '019c4e6b-2c29-77f6-886e-5c7e32ee1420', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019ba034-3316-70ea-971d-082721b6d2d9', '019c4e6b-2c29-77f8-9d68-6cb1c6658295', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019ba034-3316-70ea-971d-082721b6d2d9', '019c4e6b-2c29-77fd-8c55-0497a89b7e99', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019ba034-3316-70ea-971d-082721b6d2d9', '019c4e6b-2c29-7802-b9e3-0d4309313bc6', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-70ea-971d-082721b6d2d9', '019bbf87-091e-7373-8a48-37437e3ffde1', '2026-01-09T03:07:20.508667+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-70ea-971d-082721b6d2d9', '019bbf87-091f-703e-9eaf-f12c50e333b6', '2026-01-09T03:07:20.508667+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-70ea-971d-082721b6d2d9', '019bbf87-091e-7c5d-a34a-879167cadd9f', '2026-01-09T03:07:20.508667+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-70ea-971d-082721b6d2d9', '019bbf87-091e-73a9-b24d-e7ab977a5273', '2026-01-09T03:07:20.508667+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-70ea-971d-082721b6d2d9', '019bbf87-0964-77cd-ab26-d467f04ec130', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-70ea-971d-082721b6d2d9', '019bbf87-0964-7ddd-9ac0-ca38f131c8b8', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-70ea-971d-082721b6d2d9', '019bbf87-096a-71c8-9043-5abf3f80a0d0', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-70ea-971d-082721b6d2d9', '019bbf87-096a-726f-808b-b9bf633dd02d', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-70ea-971d-082721b6d2d9', '019bbabc-5a32-7247-863a-244c6f4cd7e4', '2026-01-09T00:42:14.163715+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019ba034-3316-70ea-971d-082721b6d2d9', '019bbeb4-5111-762b-a56e-d0f80b5b3dc2', true, '2026-01-09T00:42:14.163715+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019ba034-3316-70ea-971d-082721b6d2d9', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-09T00:42:14.163715+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019ba034-3316-70ea-971d-082721b6d2d9', '019bbabc-5a32-71ad-a475-644065247b0f', '2026-01-09T00:42:14.163715+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019ba034-3316-70ea-971d-082721b6d2d9', '019bebc4-d436-7c8f-9f19-28ba6dc8519f', true, '2026-01-17T17:57:40.627996+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
