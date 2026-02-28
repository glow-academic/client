-- Module: create_attempt_archive
-- Category: tool
-- Description: create_attempt_archive MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('fec3e7a1-8dda-454a-8b1b-dac9c6d69ead', 'attempt_archives', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('ff17e266-311a-489c-9370-77848a3104f5', 'attempt_id', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('42dd45fc-30e2-44e8-a685-5d3be4e4edb0', 'ff17e266-311a-489c-9370-77848a3104f5', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('13280d57-682b-48c8-92c3-643da9178f3e', 'ff17e266-311a-489c-9370-77848a3104f5', 'attempt_id', '{{ attempt_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('c31e625d-33c3-49dd-90a3-559cdb37a4a1', 'archived', '', 'boolean', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('571b4cb2-7b87-4eaf-98c7-8bbe8f18fb1f', 'c31e625d-33c3-49dd-90a3-559cdb37a4a1', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('91697acb-d162-478d-852c-2945fcdcb9a4', 'c31e625d-33c3-49dd-90a3-559cdb37a4a1', 'archived', '{{ archived }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('5963f278-98c8-41dd-be11-0a2ce212ccf4', 'Create a new attempt archive entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('e255a3e5-31c9-44fd-b3cb-dfd5fa78c899', 'create_attempt_archive', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('6e2c7c33-408c-4333-86e8-08df94a7f6ee', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_attempt_archive', 'Create a new attempt archive entry', '{}', 'create', '{ff17e266-311a-489c-9370-77848a3104f5,c31e625d-33c3-49dd-90a3-559cdb37a4a1}', '{13280d57-682b-48c8-92c3-643da9178f3e,91697acb-d162-478d-852c-2945fcdcb9a4}', '{}'::text[], '{attempt_archives}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('aaca0600-9f7f-4d13-9bc7-8a48717fc6c4', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('aaca0600-9f7f-4d13-9bc7-8a48717fc6c4', '42dd45fc-30e2-44e8-a685-5d3be4e4edb0', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('aaca0600-9f7f-4d13-9bc7-8a48717fc6c4', '571b4cb2-7b87-4eaf-98c7-8bbe8f18fb1f', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('aaca0600-9f7f-4d13-9bc7-8a48717fc6c4', 'ff17e266-311a-489c-9370-77848a3104f5', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('aaca0600-9f7f-4d13-9bc7-8a48717fc6c4', 'c31e625d-33c3-49dd-90a3-559cdb37a4a1', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('aaca0600-9f7f-4d13-9bc7-8a48717fc6c4', '13280d57-682b-48c8-92c3-643da9178f3e', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('aaca0600-9f7f-4d13-9bc7-8a48717fc6c4', '91697acb-d162-478d-852c-2945fcdcb9a4', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('aaca0600-9f7f-4d13-9bc7-8a48717fc6c4', 'fec3e7a1-8dda-454a-8b1b-dac9c6d69ead', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('aaca0600-9f7f-4d13-9bc7-8a48717fc6c4', '5963f278-98c8-41dd-be11-0a2ce212ccf4', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('aaca0600-9f7f-4d13-9bc7-8a48717fc6c4', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('aaca0600-9f7f-4d13-9bc7-8a48717fc6c4', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('aaca0600-9f7f-4d13-9bc7-8a48717fc6c4', 'e255a3e5-31c9-44fd-b3cb-dfd5fa78c899', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('aaca0600-9f7f-4d13-9bc7-8a48717fc6c4', '6e2c7c33-408c-4333-86e8-08df94a7f6ee', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
