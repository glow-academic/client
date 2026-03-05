-- Module: use_instructions
-- Category: tool
-- Description: use_instructions MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019c06a8-2afd-7572-a3ef-6b0e480ee806', 'instruction_id', 'The ID of the instruction to link', 'string', true, '', '2026-01-28T22:10:10.283595+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7957-8371-80df126ee154', '019c06a8-2afd-7572-a3ef-6b0e480ee806', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('14005258-e2ef-4958-bc6f-50d8690a6fe8', '019c06a8-2afd-7572-a3ef-6b0e480ee806', 'id', '{{ instruction_id }}', '2026-01-30T14:58:36.217917+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c06a8-2af8-7e4a-a6d1-f0f8494c3695', 'use_instructions', '2026-01-28T22:10:10.283595+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('019c06a8-2af5-7f6a-aaa0-5a9aaa2ed10e', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_instructions', 'Use an existing instruction resource instead of creating a new one', '{}', 'link', '{019c06a8-2afd-7572-a3ef-6b0e480ee806}', '{14005258-e2ef-4958-bc6f-50d8690a6fe8}', '{instructions}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c06a8-2afc-7229-9772-4bd487410b5f', '2026-01-28T22:10:10.283595+00:00', '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c06a8-2afc-7229-9772-4bd487410b5f', '019c4e6b-2c29-7957-8371-80df126ee154', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7229-9772-4bd487410b5f', '019c06a8-2afd-7572-a3ef-6b0e480ee806', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7229-9772-4bd487410b5f', '14005258-e2ef-4958-bc6f-50d8690a6fe8', '2026-01-30T14:58:36.217917+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_resources_junction
INSERT INTO public.tool_resources_junction (tool_id, resource_id, active, created_at, generated, mcp) VALUES ('019c06a8-2afc-7229-9772-4bd487410b5f', '019bbeb4-5111-74d0-9786-60cef5204f41', true, '2026-02-12T01:05:03.953545+00:00', false, false) ON CONFLICT (tool_id, resource_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7229-9772-4bd487410b5f', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-01-30T14:58:36.213184+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('019c06a8-2afc-7229-9772-4bd487410b5f', '019d0000-0001-7000-8000-000000000003', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c06a8-2afc-7229-9772-4bd487410b5f', '019c06a8-2af8-7e4a-a6d1-f0f8494c3695', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c06a8-2afc-7229-9772-4bd487410b5f', '019c06a8-2af5-7f6a-aaa0-5a9aaa2ed10e', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
