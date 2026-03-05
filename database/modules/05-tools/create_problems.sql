-- Module: create_problems
-- Category: tool
-- Description: create_problems MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('763d0eeb-a04f-4ecd-bb61-b5eafe5eca07', 'problems', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('89fe656e-525d-4a16-b364-972ada00c501', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('798a18d4-68c4-46f5-920f-980ac58d5ba3', '89fe656e-525d-4a16-b364-972ada00c501', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('acd7d5a3-82df-40c6-9847-3897e42eab95', '89fe656e-525d-4a16-b364-972ada00c501', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('b40ccbe6-4b1c-4801-a81f-1e9436d91301', 'type', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('f421ca08-5189-45cd-808d-192f496504bc', 'b40ccbe6-4b1c-4801-a81f-1e9436d91301', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('0b28e0ac-ff1c-456d-9d33-55e4d4568b5f', 'b40ccbe6-4b1c-4801-a81f-1e9436d91301', 'type', '{{ type }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('cfaa51c3-a510-4e1b-a957-cf50f69ab33e', 'message', '', 'string', false, 'No message provided', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('fee05dfb-6db0-4c5a-a477-8cfa4ddbd5d4', 'cfaa51c3-a510-4e1b-a957-cf50f69ab33e', 2, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('bfbe7d57-a9b2-4cbd-9fcf-de48553a8449', 'cfaa51c3-a510-4e1b-a957-cf50f69ab33e', 'message', '{{ message }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('b540614b-f660-4979-b216-5d67a4c0392e', 'Create a new problems entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('66ac5809-a74a-40f4-8adf-ed43b8279afe', 'create_problems', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('9ac225ad-80c7-4993-9984-b19df0e2e76e', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_problems', 'Create a new problems entry', '{}', 'create', '{89fe656e-525d-4a16-b364-972ada00c501,b40ccbe6-4b1c-4801-a81f-1e9436d91301,cfaa51c3-a510-4e1b-a957-cf50f69ab33e}', '{acd7d5a3-82df-40c6-9847-3897e42eab95,0b28e0ac-ff1c-456d-9d33-55e4d4568b5f,bfbe7d57-a9b2-4cbd-9fcf-de48553a8449}', '{}'::text[], '{problems}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('eea5d200-27e4-4ee0-abb4-1de23c38f3eb', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('eea5d200-27e4-4ee0-abb4-1de23c38f3eb', '798a18d4-68c4-46f5-920f-980ac58d5ba3', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('eea5d200-27e4-4ee0-abb4-1de23c38f3eb', 'f421ca08-5189-45cd-808d-192f496504bc', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('eea5d200-27e4-4ee0-abb4-1de23c38f3eb', 'fee05dfb-6db0-4c5a-a477-8cfa4ddbd5d4', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('eea5d200-27e4-4ee0-abb4-1de23c38f3eb', '89fe656e-525d-4a16-b364-972ada00c501', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('eea5d200-27e4-4ee0-abb4-1de23c38f3eb', 'b40ccbe6-4b1c-4801-a81f-1e9436d91301', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('eea5d200-27e4-4ee0-abb4-1de23c38f3eb', 'cfaa51c3-a510-4e1b-a957-cf50f69ab33e', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('eea5d200-27e4-4ee0-abb4-1de23c38f3eb', 'acd7d5a3-82df-40c6-9847-3897e42eab95', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('eea5d200-27e4-4ee0-abb4-1de23c38f3eb', '0b28e0ac-ff1c-456d-9d33-55e4d4568b5f', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('eea5d200-27e4-4ee0-abb4-1de23c38f3eb', 'bfbe7d57-a9b2-4cbd-9fcf-de48553a8449', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('eea5d200-27e4-4ee0-abb4-1de23c38f3eb', '763d0eeb-a04f-4ecd-bb61-b5eafe5eca07', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('eea5d200-27e4-4ee0-abb4-1de23c38f3eb', 'b540614b-f660-4979-b216-5d67a4c0392e', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('eea5d200-27e4-4ee0-abb4-1de23c38f3eb', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('eea5d200-27e4-4ee0-abb4-1de23c38f3eb', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('eea5d200-27e4-4ee0-abb4-1de23c38f3eb', '66ac5809-a74a-40f4-8adf-ed43b8279afe', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('eea5d200-27e4-4ee0-abb4-1de23c38f3eb', '9ac225ad-80c7-4993-9984-b19df0e2e76e', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
