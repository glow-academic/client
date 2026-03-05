-- Module: use_parameter_fields
-- Category: tool
-- Description: use_parameter_fields MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019c06a8-2afd-75d2-b632-0b14d929ce51', 'parameter_field_id', 'The ID of the parameter field to link', 'string', true, '', '2026-01-28T22:10:10.283595+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7961-b3e5-96d0881a4d8d', '019c06a8-2afd-75d2-b632-0b14d929ce51', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('80914706-baaa-47a1-bf0d-b9d169964343', '019c06a8-2afd-75d2-b632-0b14d929ce51', 'id', '{{ parameter_field_id }}', '2026-01-30T14:58:36.217917+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c06a8-2af8-7eee-b873-ab6548a7615e', 'use_parameter_fields', '2026-01-28T22:10:10.283595+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('019c06a8-2af6-7609-9bc5-2782eb639be2', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_parameter_fields', 'Use an existing parameter field resource instead of creating a new one', '{}', 'link', '{019c06a8-2afd-75d2-b632-0b14d929ce51}', '{80914706-baaa-47a1-bf0d-b9d169964343}', '{parameter_fields}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c06a8-2afc-7722-b6b9-cbbbc05a4fcd', '2026-01-28T22:10:10.283595+00:00', '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c06a8-2afc-7722-b6b9-cbbbc05a4fcd', '019c4e6b-2c29-7961-b3e5-96d0881a4d8d', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7722-b6b9-cbbbc05a4fcd', '019c06a8-2afd-75d2-b632-0b14d929ce51', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7722-b6b9-cbbbc05a4fcd', '80914706-baaa-47a1-bf0d-b9d169964343', '2026-01-30T14:58:36.217917+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_resources_junction
INSERT INTO public.tool_resources_junction (tool_id, resources_id, active, created_at, generated, mcp) VALUES ('019c06a8-2afc-7722-b6b9-cbbbc05a4fcd', '019c4f27-1789-73dd-897f-3fa43266e6ef', true, '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (tool_id, resources_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flags_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7722-b6b9-cbbbc05a4fcd', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-01-30T14:58:36.213184+00:00', false, false, true) ON CONFLICT (tool_id, flags_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operations_id, created_at, active, generated, mcp) VALUES ('019c06a8-2afc-7722-b6b9-cbbbc05a4fcd', '019d0000-0001-7000-8000-000000000003', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operations_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, names_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7722-b6b9-cbbbc05a4fcd', '019c06a8-2af8-7eee-b873-ab6548a7615e', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, names_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c06a8-2afc-7722-b6b9-cbbbc05a4fcd', '019c06a8-2af6-7609-9bc5-2782eb639be2', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
