-- Module: use_examples
-- Category: tool
-- Description: use_examples MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019c06a8-2afd-7507-b94b-e23a4f7629cb', 'example_id', 'The ID of the example to link', 'string', true, '', '2026-01-28T22:10:10.283595+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-796b-b697-bd4bf601d190', '019c06a8-2afd-7507-b94b-e23a4f7629cb', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('dda071e7-f216-436c-90ce-2ab8023e0322', '019c06a8-2afd-7507-b94b-e23a4f7629cb', 'id', '{{ example_id }}', '2026-01-30T14:58:36.217917+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c06a8-2af8-7da2-80e7-86545543e250', 'use_examples', '2026-01-28T22:10:10.283595+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('019c06a8-2af5-747f-a440-a2a60dd205e1', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_examples', 'Use an existing example resource instead of creating a new one', '{}', 'link', '{019c06a8-2afd-7507-b94b-e23a4f7629cb}', '{dda071e7-f216-436c-90ce-2ab8023e0322}', '{examples}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c06a8-2afc-78f8-9d56-e65951e652c4', '2026-01-28T22:10:10.283595+00:00', '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c06a8-2afc-78f8-9d56-e65951e652c4', '019c4e6b-2c29-796b-b697-bd4bf601d190', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-78f8-9d56-e65951e652c4', '019c06a8-2afd-7507-b94b-e23a4f7629cb', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-78f8-9d56-e65951e652c4', 'dda071e7-f216-436c-90ce-2ab8023e0322', '2026-01-30T14:58:36.217917+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_resources_junction
INSERT INTO public.tool_resources_junction (tool_id, resource_id, active, created_at, generated, mcp) VALUES ('019c06a8-2afc-78f8-9d56-e65951e652c4', '019bbeb4-510d-7525-8c1a-349828997019', true, '2026-02-12T01:05:03.953545+00:00', false, false) ON CONFLICT (tool_id, resource_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-78f8-9d56-e65951e652c4', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-01-30T14:58:36.213184+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('019c06a8-2afc-78f8-9d56-e65951e652c4', '019d0000-0001-7000-8000-000000000003', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-78f8-9d56-e65951e652c4', '019c06a8-2af8-7da2-80e7-86545543e250', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c06a8-2afc-78f8-9d56-e65951e652c4', '019c06a8-2af5-747f-a440-a2a60dd205e1', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
