-- Module: create_parameter_fields
-- Category: tool
-- Description: create_parameter_fields MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019c06a8-2afd-75f5-bc5e-84761794a3d6', 'field_id_create', 'The ID of the field to associate with the parameter', 'string', true, '', '2026-01-28T22:10:10.283595+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-793c-810d-d74f8ffb10e8', '019c06a8-2afd-75f5-bc5e-84761794a3d6', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019c06a8-2afd-7619-95b4-0c0252b8e5ee', 'parameter_id_create', 'The ID of the parameter to associate with the field', 'string', true, '', '2026-01-28T22:10:10.283595+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7943-9d85-dc70ec51aff3', '019c06a8-2afd-7619-95b4-0c0252b8e5ee', 1, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019c48f5-89d8-76c3-a4f8-56bad0f21043', '019c06a8-2afd-75f5-bc5e-84761794a3d6', 'field_id', '{{ field_id_create }}', '2026-02-10T19:09:37.107316+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019c48f5-89d9-7414-a395-bd6c07cbf197', '019c06a8-2afd-7619-95b4-0c0252b8e5ee', 'parameter_id', '{{ parameter_id_create }}', '2026-02-10T19:09:37.107316+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bf207-ca51-7c58-9d6d-006956cceba8', 'Create a parameter field resource for linking general parameter fields to scenarios', '2026-01-24T22:02:35.441799+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bf207-ca51-78e3-9180-7137e464c932', 'create_parameter_fields', '2026-01-24T22:02:35.441799+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource, entry) VALUES ('019bf207-ca52-70cc-ae3c-a5ca44d6d5e9', '2026-01-24T22:02:35.441799+00:00', false, false, true, 'create_parameter_fields', 'Create a parameter field resource for linking general parameter fields to scenarios', '{}', true, '{019c06a8-2afd-75f5-bc5e-84761794a3d6,019c06a8-2afd-7619-95b4-0c0252b8e5ee}', '{019c48f5-89d8-76c3-a4f8-56bad0f21043,019c48f5-89d9-7414-a395-bd6c07cbf197}', 'parameter_fields', NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bf207-ca51-76d3-a977-6a923e5d077d', '2026-01-24T22:02:35.441799+00:00', '2026-01-24T22:02:35.441799+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019bf207-ca51-76d3-a977-6a923e5d077d', '019c4e6b-2c29-793c-810d-d74f8ffb10e8', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019bf207-ca51-76d3-a977-6a923e5d077d', '019c4e6b-2c29-7943-9d85-dc70ec51aff3', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bf207-ca51-76d3-a977-6a923e5d077d', '019c06a8-2afd-75f5-bc5e-84761794a3d6', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bf207-ca51-76d3-a977-6a923e5d077d', '019c06a8-2afd-7619-95b4-0c0252b8e5ee', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bf207-ca51-76d3-a977-6a923e5d077d', '019c48f5-89d8-76c3-a4f8-56bad0f21043', '2026-02-10T19:09:37.107316+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bf207-ca51-76d3-a977-6a923e5d077d', '019c48f5-89d9-7414-a395-bd6c07cbf197', '2026-02-10T19:09:37.107316+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bf207-ca51-76d3-a977-6a923e5d077d', '019bf207-ca51-7c58-9d6d-006956cceba8', '2026-01-24T22:02:35.441799+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019bf207-ca51-76d3-a977-6a923e5d077d', '019c4f27-1789-73dd-897f-3fa43266e6ef', true, '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bf207-ca51-76d3-a977-6a923e5d077d', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-24T22:02:35.441799+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bf207-ca51-76d3-a977-6a923e5d077d', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-01-30T14:58:36.217041+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bf207-ca51-76d3-a977-6a923e5d077d', '019bf207-ca51-78e3-9180-7137e464c932', '2026-01-24T22:02:35.441799+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bf207-ca51-76d3-a977-6a923e5d077d', '019bf207-ca52-70cc-ae3c-a5ca44d6d5e9', true, '2026-01-24T22:02:35.441799+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
