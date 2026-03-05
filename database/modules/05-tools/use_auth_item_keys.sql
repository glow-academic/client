-- Module: use_auth_item_keys
-- Category: tool
-- Description: use_auth_item_keys MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('3ba72256-8cc0-4559-8811-113e5e95c1a5', 'auth_item_key_id', '', 'string', true, '', '2026-02-21T22:16:39.602906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('0d674612-af83-42fb-a0b3-b3762ec67450', '3ba72256-8cc0-4559-8811-113e5e95c1a5', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('3103c655-93a9-45c1-81f7-536ccca275e5', '3ba72256-8cc0-4559-8811-113e5e95c1a5', 'id', '{{ auth_item_key_id }}', '2026-02-21T22:16:39.604747+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d8b-7e34-b23a-029d6159fe32', 'Use an existing auth item keys resource instead of creating a new one', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d8b-7da9-918b-771bdd62b8ab', 'use_auth_item_keys', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('e00113cf-8fb3-4823-872f-5856a8075447', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'use_auth_item_keys', 'Use an existing auth item key by its ID', '{}', 'link', '{3ba72256-8cc0-4559-8811-113e5e95c1a5}', '{3103c655-93a9-45c1-81f7-536ccca275e5}', '{}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('eac667f9-2754-4285-9244-4211f99f95e3', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('eac667f9-2754-4285-9244-4211f99f95e3', '0d674612-af83-42fb-a0b3-b3762ec67450', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('eac667f9-2754-4285-9244-4211f99f95e3', '3ba72256-8cc0-4559-8811-113e5e95c1a5', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('eac667f9-2754-4285-9244-4211f99f95e3', '3103c655-93a9-45c1-81f7-536ccca275e5', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('eac667f9-2754-4285-9244-4211f99f95e3', '019c82b8-5d8b-7e34-b23a-029d6159fe32', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('eac667f9-2754-4285-9244-4211f99f95e3', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('eac667f9-2754-4285-9244-4211f99f95e3', '019d0000-0001-7000-8000-000000000003', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('eac667f9-2754-4285-9244-4211f99f95e3', '019c82b8-5d8b-7da9-918b-771bdd62b8ab', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('eac667f9-2754-4285-9244-4211f99f95e3', 'e00113cf-8fb3-4823-872f-5856a8075447', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
