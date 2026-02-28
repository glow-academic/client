-- Module: create_health_insights
-- Category: tool
-- Description: create_health_insights MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('efe6a131-61f1-4f79-a224-010d235a146d', 'group_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('b255eee1-b226-4be2-af1e-11cd28e1b0f7', 'efe6a131-61f1-4f79-a224-010d235a146d', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('dd041c2c-8ca9-4831-805b-b49ccd892e72', 'efe6a131-61f1-4f79-a224-010d235a146d', 'group_id', '{{ group_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('64877a48-6a71-486c-b7f9-d2a615a29d18', 'content', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('63fb9db2-b67d-4722-a609-9491e1e22f22', '64877a48-6a71-486c-b7f9-d2a615a29d18', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('2d21c221-f823-4113-9fd4-415fb43c63dd', '64877a48-6a71-486c-b7f9-d2a615a29d18', 'content', '{{ content }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('b1d5f1e7-da36-4666-ae59-f88499ab3c86', 'Create a new health insights entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('57c3ae1f-4501-4e3d-8b81-5f73ee14876a', 'create_health_insights', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('7bf1d049-3faf-4c5f-99ba-50faf3e2b2d1', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_health_insights', 'Create a new health insights entry', '{}', 'create', '{efe6a131-61f1-4f79-a224-010d235a146d,64877a48-6a71-486c-b7f9-d2a615a29d18}', '{dd041c2c-8ca9-4831-805b-b49ccd892e72,2d21c221-f823-4113-9fd4-415fb43c63dd}', '{}'::text[], '{health_insights}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('160bc8e4-5bd5-4b17-ac4a-3b82303d53eb', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('160bc8e4-5bd5-4b17-ac4a-3b82303d53eb', 'b255eee1-b226-4be2-af1e-11cd28e1b0f7', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('160bc8e4-5bd5-4b17-ac4a-3b82303d53eb', '63fb9db2-b67d-4722-a609-9491e1e22f22', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('160bc8e4-5bd5-4b17-ac4a-3b82303d53eb', 'efe6a131-61f1-4f79-a224-010d235a146d', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('160bc8e4-5bd5-4b17-ac4a-3b82303d53eb', '64877a48-6a71-486c-b7f9-d2a615a29d18', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('160bc8e4-5bd5-4b17-ac4a-3b82303d53eb', 'dd041c2c-8ca9-4831-805b-b49ccd892e72', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('160bc8e4-5bd5-4b17-ac4a-3b82303d53eb', '2d21c221-f823-4113-9fd4-415fb43c63dd', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('160bc8e4-5bd5-4b17-ac4a-3b82303d53eb', '018f0004-0001-7000-8000-000000000005', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('160bc8e4-5bd5-4b17-ac4a-3b82303d53eb', 'b1d5f1e7-da36-4666-ae59-f88499ab3c86', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('160bc8e4-5bd5-4b17-ac4a-3b82303d53eb', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('160bc8e4-5bd5-4b17-ac4a-3b82303d53eb', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('160bc8e4-5bd5-4b17-ac4a-3b82303d53eb', '57c3ae1f-4501-4e3d-8b81-5f73ee14876a', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('160bc8e4-5bd5-4b17-ac4a-3b82303d53eb', '7bf1d049-3faf-4c5f-99ba-50faf3e2b2d1', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
