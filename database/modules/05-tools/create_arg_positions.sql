-- Module: create_arg_positions
-- Category: tool
-- Description: create_arg_positions MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-0974-7f96-8ed3-cbbb01ec6bea', 'args_id', 'The ID of the argument this output is linked to', 'uuid', true, '', '2026-01-15T02:40:56.692128+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4f61-51e6-7c88-adbe-42b786e2cee9', '019bbf87-0974-7f96-8ed3-cbbb01ec6bea', 0, '2026-02-12T01:05:03.953545+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-7c5d-a34a-879167cadd9f', 'position', '', 'number', true, '', '2026-01-06T15:55:22.224103+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4f61-51e7-7a7b-8386-ec8816186929', '019bbf87-091e-7c5d-a34a-879167cadd9f', 1, '2026-02-12T01:05:03.953545+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0975-73f0-982a-48d791b45470', '019bbf87-0974-7f96-8ed3-cbbb01ec6bea', 'id', '{{ id }}', '2026-01-15T02:40:56.692128+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-096a-726f-808b-b9bf633dd02d', '019bbf87-091e-7c5d-a34a-879167cadd9f', 'position', '', '2026-01-09T00:42:14.158542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019c4f61-51e4-766d-aa0b-cef0877d7123', '019bbf87-0974-7f96-8ed3-cbbb01ec6bea', 'args_id', '{{args_id}}', '2026-02-12T01:05:03.953545+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c4f61-51df-7e87-8677-b1d8f4d67c7b', 'Create arg position records for tool args', '2026-02-12T01:05:03.953545+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c4f61-51df-7a2b-b1b1-350a1d32e862', 'create_arg_positions', '2026-02-12T01:05:03.953545+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('019c4f61-51df-7230-a045-e517cb1c9127', '2026-02-12T01:05:03.953545+00:00', false, false, true, 'create_arg_positions', 'Create arg position records for tool args', '{}', 'create', '{019bbf87-0974-7f96-8ed3-cbbb01ec6bea,019bbf87-091e-7c5d-a34a-879167cadd9f}', '{019bbf87-0975-73f0-982a-48d791b45470,019bbf87-096a-726f-808b-b9bf633dd02d,019c4f61-51e4-766d-aa0b-cef0877d7123}', '{arg_positions}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c4f61-51de-7fd2-84fe-16ec8e9bdc75', '2026-02-12T01:05:03.953545+00:00', '2026-02-12T01:05:03.953545+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c4f61-51de-7fd2-84fe-16ec8e9bdc75', '019c4f61-51e6-7c88-adbe-42b786e2cee9', '2026-02-12T01:05:03.953545+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c4f61-51de-7fd2-84fe-16ec8e9bdc75', '019c4f61-51e7-7a7b-8386-ec8816186929', '2026-02-12T01:05:03.953545+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c4f61-51de-7fd2-84fe-16ec8e9bdc75', '019bbf87-0974-7f96-8ed3-cbbb01ec6bea', '2026-02-12T01:05:03.953545+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c4f61-51de-7fd2-84fe-16ec8e9bdc75', '019bbf87-091e-7c5d-a34a-879167cadd9f', '2026-02-12T01:05:03.953545+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c4f61-51de-7fd2-84fe-16ec8e9bdc75', '019bbf87-0975-73f0-982a-48d791b45470', '2026-02-12T01:05:03.953545+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c4f61-51de-7fd2-84fe-16ec8e9bdc75', '019bbf87-096a-726f-808b-b9bf633dd02d', '2026-02-12T01:05:03.953545+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c4f61-51de-7fd2-84fe-16ec8e9bdc75', '019c4f61-51e4-766d-aa0b-cef0877d7123', '2026-02-12T01:05:03.953545+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019c4f61-51de-7fd2-84fe-16ec8e9bdc75', '019c4f61-51df-7e87-8677-b1d8f4d67c7b', '2026-02-12T01:05:03.953545+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_resources_junction
INSERT INTO public.tool_resources_junction (tool_id, resource_id, active, created_at, generated, mcp) VALUES ('019c4f61-51de-7fd2-84fe-16ec8e9bdc75', '019c4f39-ddfc-7aa0-a863-0fa9ffdf5252', true, '2026-02-12T01:05:03.953545+00:00', false, false) ON CONFLICT (tool_id, resource_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c4f61-51de-7fd2-84fe-16ec8e9bdc75', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-12T01:05:03.953545+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('019c4f61-51de-7fd2-84fe-16ec8e9bdc75', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c4f61-51de-7fd2-84fe-16ec8e9bdc75', '019c4f61-51df-7a2b-b1b1-350a1d32e862', '2026-02-12T01:05:03.953545+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c4f61-51de-7fd2-84fe-16ec8e9bdc75', '019c4f61-51df-7230-a045-e517cb1c9127', true, '2026-02-12T01:05:03.953545+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
