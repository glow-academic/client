-- Module: use_domains
-- Category: tool
-- Description: use_domains MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('33b35bd7-b496-4e2d-b1f4-80c16d28bf18', 'resource_id', '', 'string', true, '', '2026-02-21T22:16:39.602906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('80b9b833-e3c6-4b21-b27b-45086cf607bf', '33b35bd7-b496-4e2d-b1f4-80c16d28bf18', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('e526507f-2782-4394-b796-529e57b1f44c', '33b35bd7-b496-4e2d-b1f4-80c16d28bf18', 'id', '{{ resource_id }}', '2026-02-21T22:16:39.604747+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d8c-78ec-9f8d-dfbd7fae2e1e', 'Use an existing domains resource instead of creating a new one', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d8c-786c-a2ae-1250d5e69163', 'use_domains', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('a85ffddf-b68f-4117-aab8-5888b3020fb1', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'use_domains', 'Use an existing domain by its ID', '{}', 'link', '{33b35bd7-b496-4e2d-b1f4-80c16d28bf18}', '{e526507f-2782-4394-b796-529e57b1f44c}', '{}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('22f98ee6-b613-4ce1-aefb-145616e52bb8', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('22f98ee6-b613-4ce1-aefb-145616e52bb8', '80b9b833-e3c6-4b21-b27b-45086cf607bf', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('22f98ee6-b613-4ce1-aefb-145616e52bb8', '33b35bd7-b496-4e2d-b1f4-80c16d28bf18', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('22f98ee6-b613-4ce1-aefb-145616e52bb8', 'e526507f-2782-4394-b796-529e57b1f44c', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('22f98ee6-b613-4ce1-aefb-145616e52bb8', '019c82b8-5d8c-78ec-9f8d-dfbd7fae2e1e', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('22f98ee6-b613-4ce1-aefb-145616e52bb8', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('22f98ee6-b613-4ce1-aefb-145616e52bb8', '019d0000-0001-7000-8000-000000000003', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('22f98ee6-b613-4ce1-aefb-145616e52bb8', '019c82b8-5d8c-786c-a2ae-1250d5e69163', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('22f98ee6-b613-4ce1-aefb-145616e52bb8', 'a85ffddf-b68f-4117-aab8-5888b3020fb1', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
