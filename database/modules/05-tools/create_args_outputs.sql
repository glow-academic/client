-- Module: create_args_outputs
-- Category: tool
-- Description: create_args_outputs MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-0974-7f96-8ed3-cbbb01ec6bea', 'args_id', 'The ID of the argument this output is linked to', 'uuid', true, '', '2026-01-15T02:40:56.692128+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-792b-91fd-4ed8dfe69d01', '019bbf87-0974-7f96-8ed3-cbbb01ec6bea', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-73a9-b24d-e7ab977a5273', 'name', '', 'string', true, '', '2026-01-05T00:28:02.003807+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-792c-a221-3eff0711e055', '019bbf87-091e-73a9-b24d-e7ab977a5273', 1, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-7b6c-9615-1e6c74921f0c', 'template', '', 'string', true, '', '2026-01-06T15:55:22.225205+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7933-aae6-da9b5538d187', '019bbf87-091e-7b6c-9615-1e6c74921f0c', 2, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0975-73f0-982a-48d791b45470', '019bbf87-0974-7f96-8ed3-cbbb01ec6bea', 'id', '{{ id }}', '2026-01-15T02:40:56.692128+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbf87-0974-7ce6-b24d-897cd8bc8d33', 'Create an output template for a tool argument', '2026-01-15T02:40:56.692128+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbf87-0974-7b5c-a7c9-fb7d0d8ae33b', 'create_args_outputs', '2026-01-15T02:40:56.692128+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource, entry, artifact) VALUES ('019bebc4-d436-7d1d-9e14-3299c8677730', '2026-01-15T02:40:56.692128+00:00', false, false, true, 'create_args_outputs', 'Create an output template for a tool argument', '{}', true, '{019bbf87-0974-7f96-8ed3-cbbb01ec6bea,019bbf87-091e-73a9-b24d-e7ab977a5273,019bbf87-091e-7b6c-9615-1e6c74921f0c}', '{019bbf87-0975-73f0-982a-48d791b45470}', 'args_outputs', NULL, NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bbf87-0974-7af6-abc6-bb91955d26d5', '2026-01-15T02:40:56.692128+00:00', '2026-01-15T02:40:56.692128+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019bbf87-0974-7af6-abc6-bb91955d26d5', '019c4e6b-2c29-792b-91fd-4ed8dfe69d01', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019bbf87-0974-7af6-abc6-bb91955d26d5', '019c4e6b-2c29-792c-a221-3eff0711e055', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019bbf87-0974-7af6-abc6-bb91955d26d5', '019c4e6b-2c29-7933-aae6-da9b5538d187', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbf87-0974-7af6-abc6-bb91955d26d5', '019bbf87-0974-7f96-8ed3-cbbb01ec6bea', '2026-01-15T02:40:56.692128+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbf87-0974-7af6-abc6-bb91955d26d5', '019bbf87-091e-73a9-b24d-e7ab977a5273', '2026-01-15T02:40:56.692128+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bbf87-0974-7af6-abc6-bb91955d26d5', '019bbf87-091e-7b6c-9615-1e6c74921f0c', '2026-01-15T02:40:56.692128+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bbf87-0974-7af6-abc6-bb91955d26d5', '019bbf87-0975-73f0-982a-48d791b45470', '2026-01-15T02:40:56.692128+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bbf87-0974-7af6-abc6-bb91955d26d5', '019bbf87-0974-7ce6-b24d-897cd8bc8d33', '2026-01-15T02:40:56.692128+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('019bbf87-0974-7af6-abc6-bb91955d26d5', '019c4f27-1787-7c19-bf2c-5c3d368206d6', true, '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bbf87-0974-7af6-abc6-bb91955d26d5', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-01-15T02:40:56.692128+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bbf87-0974-7af6-abc6-bb91955d26d5', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-02-22T12:36:03.817884+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bbf87-0974-7af6-abc6-bb91955d26d5', '019bbf87-0974-7b5c-a7c9-fb7d0d8ae33b', '2026-01-15T02:40:56.692128+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bbf87-0974-7af6-abc6-bb91955d26d5', '019bebc4-d436-7d1d-9e14-3299c8677730', true, '2026-01-15T02:40:56.692128+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
