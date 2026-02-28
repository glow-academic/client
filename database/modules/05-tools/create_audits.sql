-- Module: create_audits
-- Category: tool
-- Description: create_audits MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('dd615c1f-5b0f-43d8-b654-7751f35f8d1a', 'audits', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('39b6c890-086b-47f4-b678-498e5714de78', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('9f837b96-f542-4e3e-958e-d41d02586d15', '39b6c890-086b-47f4-b678-498e5714de78', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('b71851a4-f1e6-4a71-bd15-b4a4a0e414e5', '39b6c890-086b-47f4-b678-498e5714de78', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('769f40f3-fec8-4ffb-974f-c349b6dd9b0b', 'message', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('c5316fc9-82ad-4e71-a5c4-b668c4ce3872', '769f40f3-fec8-4ffb-974f-c349b6dd9b0b', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('152131e0-3388-45a1-b444-cf8824f30ee4', '769f40f3-fec8-4ffb-974f-c349b6dd9b0b', 'message', '{{ message }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('9e49e135-3a5d-4d54-9e80-f2517a2473b1', 'endpoint', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('f9cd4756-27fd-4f80-a5c4-1e08e96010fc', '9e49e135-3a5d-4d54-9e80-f2517a2473b1', 2, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('b084856d-dcdc-4478-9298-63f37e5342b1', '9e49e135-3a5d-4d54-9e80-f2517a2473b1', 'endpoint', '{{ endpoint }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('7603cec5-ea96-474d-8e15-7e43375ea529', 'error', '', 'boolean', false, 'false', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('09117bfc-d547-48bd-a184-9266c10b2994', '7603cec5-ea96-474d-8e15-7e43375ea529', 3, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('65d179a0-6879-4693-a8ad-52ce06bc1965', '7603cec5-ea96-474d-8e15-7e43375ea529', 'error', '{{ error }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('35cd4e4b-c13c-4cb9-a067-b0f0cd021bdc', 'Create a new audits entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('cc9aa6aa-0f37-46fb-b63a-f9d97e1b6c0a', 'create_audits', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('d8b42c95-f8a7-480d-96eb-ebf488d5f07c', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_audits', 'Create a new audits entry', '{}', 'create', '{39b6c890-086b-47f4-b678-498e5714de78,769f40f3-fec8-4ffb-974f-c349b6dd9b0b,9e49e135-3a5d-4d54-9e80-f2517a2473b1,7603cec5-ea96-474d-8e15-7e43375ea529}', '{b71851a4-f1e6-4a71-bd15-b4a4a0e414e5,152131e0-3388-45a1-b444-cf8824f30ee4,b084856d-dcdc-4478-9298-63f37e5342b1,65d179a0-6879-4693-a8ad-52ce06bc1965}', '{}'::text[], '{audits}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('e08e844e-fd85-4f18-a6c5-c7c9a7228308', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('e08e844e-fd85-4f18-a6c5-c7c9a7228308', '9f837b96-f542-4e3e-958e-d41d02586d15', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('e08e844e-fd85-4f18-a6c5-c7c9a7228308', 'c5316fc9-82ad-4e71-a5c4-b668c4ce3872', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('e08e844e-fd85-4f18-a6c5-c7c9a7228308', 'f9cd4756-27fd-4f80-a5c4-1e08e96010fc', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('e08e844e-fd85-4f18-a6c5-c7c9a7228308', '09117bfc-d547-48bd-a184-9266c10b2994', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('e08e844e-fd85-4f18-a6c5-c7c9a7228308', '39b6c890-086b-47f4-b678-498e5714de78', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('e08e844e-fd85-4f18-a6c5-c7c9a7228308', '769f40f3-fec8-4ffb-974f-c349b6dd9b0b', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('e08e844e-fd85-4f18-a6c5-c7c9a7228308', '9e49e135-3a5d-4d54-9e80-f2517a2473b1', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('e08e844e-fd85-4f18-a6c5-c7c9a7228308', '7603cec5-ea96-474d-8e15-7e43375ea529', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('e08e844e-fd85-4f18-a6c5-c7c9a7228308', 'b71851a4-f1e6-4a71-bd15-b4a4a0e414e5', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('e08e844e-fd85-4f18-a6c5-c7c9a7228308', '152131e0-3388-45a1-b444-cf8824f30ee4', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('e08e844e-fd85-4f18-a6c5-c7c9a7228308', 'b084856d-dcdc-4478-9298-63f37e5342b1', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('e08e844e-fd85-4f18-a6c5-c7c9a7228308', '65d179a0-6879-4693-a8ad-52ce06bc1965', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('e08e844e-fd85-4f18-a6c5-c7c9a7228308', 'dd615c1f-5b0f-43d8-b654-7751f35f8d1a', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('e08e844e-fd85-4f18-a6c5-c7c9a7228308', '35cd4e4b-c13c-4cb9-a067-b0f0cd021bdc', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('e08e844e-fd85-4f18-a6c5-c7c9a7228308', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('e08e844e-fd85-4f18-a6c5-c7c9a7228308', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('e08e844e-fd85-4f18-a6c5-c7c9a7228308', 'cc9aa6aa-0f37-46fb-b63a-f9d97e1b6c0a', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('e08e844e-fd85-4f18-a6c5-c7c9a7228308', 'd8b42c95-f8a7-480d-96eb-ebf488d5f07c', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
