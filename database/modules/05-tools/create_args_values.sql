-- Module: create_args_values
-- Category: tool
-- Description: create_args_values MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('8fdc4fcb-19eb-4b43-b5de-6f941924ee13', 'args_values', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('0eb6abe1-389f-437c-bb07-5bff8ca91301', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('6f0fada7-24ed-4bd5-9b08-836cddbb913c', '0eb6abe1-389f-437c-bb07-5bff8ca91301', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('01750945-f0fc-46e3-878b-ec74f3996aed', '0eb6abe1-389f-437c-bb07-5bff8ca91301', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('bc9d8f4d-745d-4086-bfa6-a88e0fd339d5', 'string_value', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('5c88d9fa-7c1d-46d6-9520-baac35d31cbc', 'bc9d8f4d-745d-4086-bfa6-a88e0fd339d5', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('74caff41-db42-4568-a2eb-4d9491381f15', 'bc9d8f4d-745d-4086-bfa6-a88e0fd339d5', 'string_value', '{{ string_value }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('fb9998cb-d125-4a0b-9571-c56027e6f497', 'number_value', '', 'number', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('9e3e82f7-8997-44b9-96b3-ef47542f1ad0', 'fb9998cb-d125-4a0b-9571-c56027e6f497', 2, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('98cf6fb1-55bf-40c7-bb6b-f39920536af2', 'fb9998cb-d125-4a0b-9571-c56027e6f497', 'number_value', '{{ number_value }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('9425bf1f-0405-41b0-9c4f-8aec3cc1ffe2', 'boolean_value', '', 'boolean', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('8e932e90-6913-460e-b493-4b3159b6bf3a', '9425bf1f-0405-41b0-9c4f-8aec3cc1ffe2', 3, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('85622be5-9377-45ce-bf18-e648bb17eaa2', '9425bf1f-0405-41b0-9c4f-8aec3cc1ffe2', 'boolean_value', '{{ boolean_value }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('b7786329-7d45-4e33-ab6e-8b337dec88b9', 'Create a new args values entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('3efc1179-4651-413d-90cf-3d260cb28531', 'create_args_values', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('9a866008-e98f-41da-b76a-7e94b76e0427', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_args_values', 'Create a new args values entry', '{}', 'create', '{0eb6abe1-389f-437c-bb07-5bff8ca91301,bc9d8f4d-745d-4086-bfa6-a88e0fd339d5,fb9998cb-d125-4a0b-9571-c56027e6f497,9425bf1f-0405-41b0-9c4f-8aec3cc1ffe2}', '{01750945-f0fc-46e3-878b-ec74f3996aed,74caff41-db42-4568-a2eb-4d9491381f15,98cf6fb1-55bf-40c7-bb6b-f39920536af2,85622be5-9377-45ce-bf18-e648bb17eaa2}', '{}'::text[], '{args_values}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('fefedd1a-6735-466f-999c-1e436b6f939c', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('fefedd1a-6735-466f-999c-1e436b6f939c', '6f0fada7-24ed-4bd5-9b08-836cddbb913c', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('fefedd1a-6735-466f-999c-1e436b6f939c', '5c88d9fa-7c1d-46d6-9520-baac35d31cbc', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('fefedd1a-6735-466f-999c-1e436b6f939c', '9e3e82f7-8997-44b9-96b3-ef47542f1ad0', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('fefedd1a-6735-466f-999c-1e436b6f939c', '8e932e90-6913-460e-b493-4b3159b6bf3a', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('fefedd1a-6735-466f-999c-1e436b6f939c', '0eb6abe1-389f-437c-bb07-5bff8ca91301', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('fefedd1a-6735-466f-999c-1e436b6f939c', 'bc9d8f4d-745d-4086-bfa6-a88e0fd339d5', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('fefedd1a-6735-466f-999c-1e436b6f939c', 'fb9998cb-d125-4a0b-9571-c56027e6f497', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('fefedd1a-6735-466f-999c-1e436b6f939c', '9425bf1f-0405-41b0-9c4f-8aec3cc1ffe2', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('fefedd1a-6735-466f-999c-1e436b6f939c', '01750945-f0fc-46e3-878b-ec74f3996aed', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('fefedd1a-6735-466f-999c-1e436b6f939c', '74caff41-db42-4568-a2eb-4d9491381f15', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('fefedd1a-6735-466f-999c-1e436b6f939c', '98cf6fb1-55bf-40c7-bb6b-f39920536af2', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('fefedd1a-6735-466f-999c-1e436b6f939c', '85622be5-9377-45ce-bf18-e648bb17eaa2', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('fefedd1a-6735-466f-999c-1e436b6f939c', '8fdc4fcb-19eb-4b43-b5de-6f941924ee13', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('fefedd1a-6735-466f-999c-1e436b6f939c', 'b7786329-7d45-4e33-ab6e-8b337dec88b9', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('fefedd1a-6735-466f-999c-1e436b6f939c', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('fefedd1a-6735-466f-999c-1e436b6f939c', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('fefedd1a-6735-466f-999c-1e436b6f939c', '3efc1179-4651-413d-90cf-3d260cb28531', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('fefedd1a-6735-466f-999c-1e436b6f939c', '9a866008-e98f-41da-b76a-7e94b76e0427', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
