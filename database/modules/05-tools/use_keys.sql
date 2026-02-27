-- Module: use_keys
-- Category: tool
-- Description: use_keys MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-77de-b8e9-1160c499a3e7', 'key_id', '', 'string', true, '', '2026-01-14T18:39:46.732086+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('9931f06c-bfeb-44c8-ad97-4e16766151d4', '019bbf87-091f-77de-b8e9-1160c499a3e7', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0969-7d40-b671-1bdfae5c96af', '019bbf87-091f-77de-b8e9-1160c499a3e7', 'key_id', '{{ key_id }}', '2026-01-14T18:39:46.732086+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d8b-7039-8819-089f903f31aa', 'Use an existing keys resource instead of creating a new one', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d8a-7fbb-abd2-46320982f4cd', 'use_keys', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('5133b52b-e5ee-4f08-a9e0-f5b459ab8bea', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'use_keys', 'Use an existing key by its ID', '{}', 'link', '{019bbf87-091f-77de-b8e9-1160c499a3e7}', '{019bbf87-0969-7d40-b671-1bdfae5c96af}', '{}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('f5e25ca4-de7b-4e3c-ab51-340962f246a5', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('f5e25ca4-de7b-4e3c-ab51-340962f246a5', '9931f06c-bfeb-44c8-ad97-4e16766151d4', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('f5e25ca4-de7b-4e3c-ab51-340962f246a5', '019bbf87-091f-77de-b8e9-1160c499a3e7', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('f5e25ca4-de7b-4e3c-ab51-340962f246a5', '019bbf87-0969-7d40-b671-1bdfae5c96af', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('f5e25ca4-de7b-4e3c-ab51-340962f246a5', '019c82b8-5d8b-7039-8819-089f903f31aa', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('f5e25ca4-de7b-4e3c-ab51-340962f246a5', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('f5e25ca4-de7b-4e3c-ab51-340962f246a5', '019d0000-0001-7000-8000-000000000003', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('f5e25ca4-de7b-4e3c-ab51-340962f246a5', '019c82b8-5d8a-7fbb-abd2-46320982f4cd', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('f5e25ca4-de7b-4e3c-ab51-340962f246a5', '5133b52b-e5ee-4f08-a9e0-f5b459ab8bea', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
