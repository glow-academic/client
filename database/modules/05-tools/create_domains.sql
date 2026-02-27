-- Module: create_domains
-- Category: tool
-- Description: create_domains MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('3cd1fed8-bd05-4de7-a17c-bd1417e20310', 'domain', '', 'string', true, '', '2026-02-21T22:16:39.602906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('0b673f2a-cf29-43a9-80b4-4352842226d2', '3cd1fed8-bd05-4de7-a17c-bd1417e20310', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('a76929e0-1b9d-4cea-8e9a-9036eeb1b400', '3cd1fed8-bd05-4de7-a17c-bd1417e20310', 'domain', '{{ domain }}', '2026-02-21T22:16:39.604747+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d89-7af7-8822-cd241625540e', 'Create a new domains resource', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d89-7a6d-a8a5-3fa30832a3eb', 'create_domains', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('63fedfa6-778e-45e6-adc4-e7d5469ccd75', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'create_domains', 'Create a new domain binding', '{}', 'create', '{3cd1fed8-bd05-4de7-a17c-bd1417e20310}', '{a76929e0-1b9d-4cea-8e9a-9036eeb1b400}', '{}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('9a4a6f93-e3b2-40fb-9058-1fc1c823ce5b', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('9a4a6f93-e3b2-40fb-9058-1fc1c823ce5b', '0b673f2a-cf29-43a9-80b4-4352842226d2', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('9a4a6f93-e3b2-40fb-9058-1fc1c823ce5b', '3cd1fed8-bd05-4de7-a17c-bd1417e20310', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('9a4a6f93-e3b2-40fb-9058-1fc1c823ce5b', 'a76929e0-1b9d-4cea-8e9a-9036eeb1b400', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('9a4a6f93-e3b2-40fb-9058-1fc1c823ce5b', '019c82b8-5d89-7af7-8822-cd241625540e', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('9a4a6f93-e3b2-40fb-9058-1fc1c823ce5b', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('9a4a6f93-e3b2-40fb-9058-1fc1c823ce5b', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('9a4a6f93-e3b2-40fb-9058-1fc1c823ce5b', '019c82b8-5d89-7a6d-a8a5-3fa30832a3eb', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('9a4a6f93-e3b2-40fb-9058-1fc1c823ce5b', '63fedfa6-778e-45e6-adc4-e7d5469ccd75', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
