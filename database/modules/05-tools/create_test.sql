-- Module: create_test
-- Category: tool
-- Description: create_test MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('79039c33-2b76-4bb7-85f2-cb804bf68105', 'tests', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('08cf6ee3-52de-45dd-8940-4ae1cebb8a0d', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('f2680468-8513-4c0d-8615-91c44586f314', '08cf6ee3-52de-45dd-8940-4ae1cebb8a0d', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('931b162b-a34a-47be-b95d-d6b7912a6870', '08cf6ee3-52de-45dd-8940-4ae1cebb8a0d', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('9d16f893-369b-476c-99f5-b05d6d9284a0', 'infinite_mode', '', 'boolean', false, 'false', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('e67dd959-29ea-4691-a2bf-a1d39de34f5e', '9d16f893-369b-476c-99f5-b05d6d9284a0', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('714814af-848b-4144-b5a6-d8876f4fb470', '9d16f893-369b-476c-99f5-b05d6d9284a0', 'infinite_mode', '{{ infinite_mode }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('9b393c79-3373-4e48-9b4b-d2a4ec334271', 'benchmark_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('831fcf94-b3e5-4892-9634-df137e006b0e', '9b393c79-3373-4e48-9b4b-d2a4ec334271', 2, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('7596fc23-19b2-4f11-aab3-43d0ea6ae72b', '9b393c79-3373-4e48-9b4b-d2a4ec334271', 'benchmark_id', '{{ benchmark_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('6a132b50-2dba-4a71-9b32-33f3abfbd27c', 'Create a new test entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('7bcaf4d6-1fdb-41c6-9c16-90b1496aefa8', 'create_test', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('5b18e57a-3a49-4a45-900c-5a38909f25f5', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_test', 'Create a new test entry', '{}', 'create', '{08cf6ee3-52de-45dd-8940-4ae1cebb8a0d,9d16f893-369b-476c-99f5-b05d6d9284a0,9b393c79-3373-4e48-9b4b-d2a4ec334271}', '{931b162b-a34a-47be-b95d-d6b7912a6870,714814af-848b-4144-b5a6-d8876f4fb470,7596fc23-19b2-4f11-aab3-43d0ea6ae72b}', '{}'::text[], '{tests}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('fde860b0-dc44-41ac-ae26-80753b89ca08', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('fde860b0-dc44-41ac-ae26-80753b89ca08', 'f2680468-8513-4c0d-8615-91c44586f314', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('fde860b0-dc44-41ac-ae26-80753b89ca08', 'e67dd959-29ea-4691-a2bf-a1d39de34f5e', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('fde860b0-dc44-41ac-ae26-80753b89ca08', '831fcf94-b3e5-4892-9634-df137e006b0e', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('fde860b0-dc44-41ac-ae26-80753b89ca08', '08cf6ee3-52de-45dd-8940-4ae1cebb8a0d', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('fde860b0-dc44-41ac-ae26-80753b89ca08', '9d16f893-369b-476c-99f5-b05d6d9284a0', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('fde860b0-dc44-41ac-ae26-80753b89ca08', '9b393c79-3373-4e48-9b4b-d2a4ec334271', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('fde860b0-dc44-41ac-ae26-80753b89ca08', '931b162b-a34a-47be-b95d-d6b7912a6870', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('fde860b0-dc44-41ac-ae26-80753b89ca08', '714814af-848b-4144-b5a6-d8876f4fb470', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('fde860b0-dc44-41ac-ae26-80753b89ca08', '7596fc23-19b2-4f11-aab3-43d0ea6ae72b', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('fde860b0-dc44-41ac-ae26-80753b89ca08', '79039c33-2b76-4bb7-85f2-cb804bf68105', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('fde860b0-dc44-41ac-ae26-80753b89ca08', '6a132b50-2dba-4a71-9b32-33f3abfbd27c', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('fde860b0-dc44-41ac-ae26-80753b89ca08', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('fde860b0-dc44-41ac-ae26-80753b89ca08', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('fde860b0-dc44-41ac-ae26-80753b89ca08', '7bcaf4d6-1fdb-41c6-9c16-90b1496aefa8', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('fde860b0-dc44-41ac-ae26-80753b89ca08', '5b18e57a-3a49-4a45-900c-5a38909f25f5', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
