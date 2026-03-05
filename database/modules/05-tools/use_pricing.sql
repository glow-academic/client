-- Module: use_pricing
-- Category: tool
-- Description: use_pricing MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('958ce490-97b2-4ef1-99cf-f4f70042d5dd', 'pricing_id', '', 'string', true, '', '2026-02-21T22:16:39.602906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('b632d713-15fe-4d89-add5-2795322be0fe', '958ce490-97b2-4ef1-99cf-f4f70042d5dd', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('bf95d193-eb09-415d-b126-7affae495a6e', '958ce490-97b2-4ef1-99cf-f4f70042d5dd', 'id', '{{ pricing_id }}', '2026-02-21T22:16:39.604747+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d8b-7182-901f-f68714d81343', 'Use an existing pricing resource instead of creating a new one', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d8b-7100-aa3a-a3dd2dd88c63', 'use_pricing', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('9eea4ffa-2482-498b-9651-1d8549da8b09', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'use_pricing', 'Use an existing pricing entry by its ID', '{}', 'link', '{958ce490-97b2-4ef1-99cf-f4f70042d5dd}', '{bf95d193-eb09-415d-b126-7affae495a6e}', '{}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('f91de42f-f451-4902-b241-a8492cf2e92f', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('f91de42f-f451-4902-b241-a8492cf2e92f', 'b632d713-15fe-4d89-add5-2795322be0fe', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('f91de42f-f451-4902-b241-a8492cf2e92f', '958ce490-97b2-4ef1-99cf-f4f70042d5dd', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('f91de42f-f451-4902-b241-a8492cf2e92f', 'bf95d193-eb09-415d-b126-7affae495a6e', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, descriptions_id, created_at, generated, mcp, active) VALUES ('f91de42f-f451-4902-b241-a8492cf2e92f', '019c82b8-5d8b-7182-901f-f68714d81343', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, descriptions_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flags_id, created_at, generated, mcp, active) VALUES ('f91de42f-f451-4902-b241-a8492cf2e92f', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flags_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operations_id, created_at, active, generated, mcp) VALUES ('f91de42f-f451-4902-b241-a8492cf2e92f', '019d0000-0001-7000-8000-000000000003', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operations_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, names_id, created_at, generated, mcp, active) VALUES ('f91de42f-f451-4902-b241-a8492cf2e92f', '019c82b8-5d8b-7100-aa3a-a3dd2dd88c63', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, names_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('f91de42f-f451-4902-b241-a8492cf2e92f', '9eea4ffa-2482-498b-9651-1d8549da8b09', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
