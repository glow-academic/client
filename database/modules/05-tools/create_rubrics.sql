-- Module: create_rubrics
-- Category: tool
-- Description: create_rubrics MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-7940-9825-c757e353ed6d', 'id', '', 'string', true, '', '2026-01-07T07:25:51.781825+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7787-8ed4-cebe10802da9', '019bbf87-091e-7940-9825-c757e353ed6d', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0965-77e7-8ab0-e35555bc6b29', '019bbf87-091e-7940-9825-c757e353ed6d', 'id', '', '2026-01-08T04:35:07.614923+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-755d-8003-f2e3b9e3d747', 'Create a new rubrics resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-74cd-94d2-8e2153783ce5', 'create_rubrics', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-8048-7749-8eb0-e30ab8ecb358', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019b9f61-8048-7749-8eb0-e30ab8ecb358', '019c4e6b-2c29-7787-8ed4-cebe10802da9', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7749-8eb0-e30ab8ecb358', '019bbf87-091e-7940-9825-c757e353ed6d', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7749-8eb0-e30ab8ecb358', '019bbf87-0965-77e7-8ab0-e35555bc6b29', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7749-8eb0-e30ab8ecb358', '019bbabc-5a31-755d-8003-f2e3b9e3d747', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, descriptions_id) DO NOTHING;
-- tool_resources_junction
INSERT INTO public.tool_resources_junction (tool_id, resources_id, active, created_at, generated, mcp) VALUES ('019b9f61-8048-7749-8eb0-e30ab8ecb358', '019bbeb4-5113-7d68-9619-8da923c04169', true, '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (tool_id, resources_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flags_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7749-8eb0-e30ab8ecb358', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flags_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operations_id, created_at, active, generated, mcp) VALUES ('019b9f61-8048-7749-8eb0-e30ab8ecb358', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operations_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, names_id, created_at, generated, mcp, active) VALUES ('019b9f61-8048-7749-8eb0-e30ab8ecb358', '019bbabc-5a31-74cd-94d2-8e2153783ce5', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, names_id) DO NOTHING;
