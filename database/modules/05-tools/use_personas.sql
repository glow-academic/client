-- Module: use_personas
-- Category: tool
-- Description: use_personas MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019c0a2d-fc3b-7e62-bcb0-75124c777dcd', 'persona_id', 'The persona ID to attribute this content to (see Personas section in context above)', 'string', true, '', '2026-01-29T14:35:11.795021+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7980-b854-04a6c239bb65', '019c0a2d-fc3b-7e62-bcb0-75124c777dcd', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('86ad0489-0a8c-4e2f-b8a0-c2db397a23de', '019c0a2d-fc3b-7e62-bcb0-75124c777dcd', 'id', '{{ persona_id }}', '2026-01-31T02:04:17.083661+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c0a2d-fc3a-7ca0-85b7-2806158ae88f', 'use_personas', '2026-01-29T14:35:11.795021+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('019c0a2d-fc36-756e-b50e-a5987eb4f0d5', '2026-01-29T14:35:11.795021+00:00', false, false, true, 'use_personas', 'Use an existing persona resource instead of creating a new one', '{}', 'link', '{019c0a2d-fc3b-7e62-bcb0-75124c777dcd}', '{86ad0489-0a8c-4e2f-b8a0-c2db397a23de}', '{personas}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019c0a2d-fc3a-7c3c-a778-ee25cbb23ea2', '2026-01-29T14:35:11.795021+00:00', '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019c0a2d-fc3a-7c3c-a778-ee25cbb23ea2', '019c4e6b-2c29-7980-b854-04a6c239bb65', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-7c3c-a778-ee25cbb23ea2', '019c0a2d-fc3b-7e62-bcb0-75124c777dcd', '2026-01-29T14:35:11.795021+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-7c3c-a778-ee25cbb23ea2', '86ad0489-0a8c-4e2f-b8a0-c2db397a23de', '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_resources_junction
INSERT INTO public.tool_resources_junction (tool_id, resource_id, active, created_at, generated, mcp) VALUES ('019c0a2d-fc3a-7c3c-a778-ee25cbb23ea2', '019bbeb4-5112-745f-9ae9-c8e64ca14d91', '2026-02-12T01:05:03.953545+00:00', false, false) ON CONFLICT (tool_id, resource_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-7c3c-a778-ee25cbb23ea2', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-01-31T02:04:17.083661+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('019c0a2d-fc3a-7c3c-a778-ee25cbb23ea2', '019d0000-0001-7000-8000-000000000003', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019c0a2d-fc3a-7c3c-a778-ee25cbb23ea2', '019c0a2d-fc3a-7ca0-85b7-2806158ae88f', '2026-01-29T14:35:11.795021+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019c0a2d-fc3a-7c3c-a778-ee25cbb23ea2', '019c0a2d-fc36-756e-b50e-a5987eb4f0d5', '2026-01-29T14:35:11.795021+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
