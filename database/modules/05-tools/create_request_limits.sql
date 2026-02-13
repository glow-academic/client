-- Module: create_request_limits
-- Category: tool
-- Description: create_request_limits MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7842-aec8-15735eaf6e1d', '019bbf87-091f-73d5-a8ad-732972c98ac4', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-7bc1-9d27-945bcfb9e408', 'Create a new request limit resource', '2026-01-13T03:08:53.448220+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-7b2b-a01d-8db087986591', 'create_request_limits', '2026-01-13T03:08:53.448220+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7cbe-a7bf-4b364674f3e0', '2026-01-17T17:57:40.632192+00:00', false, false, true, 'create_request_limits', 'Create a new request limit resource', '{}', false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bb553-e74c-7cb6-8868-d9bace1610dd', '2026-01-13T03:08:53.448220+00:00', '2026-01-13T03:08:53.448220+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019bb553-e74c-7cb6-8868-d9bace1610dd', '019c4e6b-2c29-7842-aec8-15735eaf6e1d', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb553-e74c-7cb6-8868-d9bace1610dd', '019bbf87-091f-73d5-a8ad-732972c98ac4', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb553-e74c-7cb6-8868-d9bace1610dd', '019bbf87-096b-7282-bdf7-f2c69c7c928c', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bb553-e74c-7cb6-8868-d9bace1610dd', '019bbabc-5a32-7bc1-9d27-945bcfb9e408', '2026-01-13T03:08:53.448220+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019bb553-e74c-7cb6-8868-d9bace1610dd', '019bbeb4-5113-7921-8e56-c68491eeb0ff', true, '2026-01-13T03:08:53.448220+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bb553-e74c-7cb6-8868-d9bace1610dd', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-13T03:08:53.448220+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bb553-e74c-7cb6-8868-d9bace1610dd', '019bbabc-5a32-7b2b-a01d-8db087986591', '2026-01-13T03:08:53.448220+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bb553-e74c-7cb6-8868-d9bace1610dd', '019bebc4-d436-7cbe-a7bf-4b364674f3e0', true, '2026-01-17T17:57:40.632192+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
