-- Module: create_mutes
-- Category: tool
-- Description: create_mutes MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('edc90721-a6eb-43be-ad61-ccf625f5ae9e', 'mutes', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('49a1315a-936c-4cb4-892a-a1b47a473fee', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('4cf34498-bef4-4ddf-9122-23ae4c49d2c9', '49a1315a-936c-4cb4-892a-a1b47a473fee', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('432f5937-6324-4c8a-b323-9247eb489445', '49a1315a-936c-4cb4-892a-a1b47a473fee', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('aaa0ee83-5e8a-4d46-98e6-cb7bbf939ef1', 'conversation_id', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('117741c2-9578-4b4d-ae7f-f1bcca229ac7', 'aaa0ee83-5e8a-4d46-98e6-cb7bbf939ef1', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('bbd826e8-87b4-44cb-8673-7ac0b25d39b8', 'aaa0ee83-5e8a-4d46-98e6-cb7bbf939ef1', 'conversation_id', '{{ conversation_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('4deb97a1-bf33-4e7e-91e4-3b0360d0dc54', 'muted', '', 'boolean', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('98f34045-123f-47cc-b3df-e746aadf7eda', '4deb97a1-bf33-4e7e-91e4-3b0360d0dc54', 2, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('c4377ec4-8e88-4af7-8979-ca028eece5d1', '4deb97a1-bf33-4e7e-91e4-3b0360d0dc54', 'muted', '{{ muted }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('3f8aa149-2378-4091-a61a-0960e2367c68', 'Create a new mutes entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('83403337-0f51-41cb-8c1d-8044ef8d4305', 'create_mutes', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('268445cd-2229-4e85-8660-f43b75afdb0f', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_mutes', 'Create a new mutes entry', '{}', 'create', '{49a1315a-936c-4cb4-892a-a1b47a473fee,aaa0ee83-5e8a-4d46-98e6-cb7bbf939ef1,4deb97a1-bf33-4e7e-91e4-3b0360d0dc54}', '{432f5937-6324-4c8a-b323-9247eb489445,bbd826e8-87b4-44cb-8673-7ac0b25d39b8,c4377ec4-8e88-4af7-8979-ca028eece5d1}', '{}'::text[], '{mutes}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('fca8d286-a2ff-46c2-84b7-93ffc6021b2a', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('fca8d286-a2ff-46c2-84b7-93ffc6021b2a', '4cf34498-bef4-4ddf-9122-23ae4c49d2c9', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('fca8d286-a2ff-46c2-84b7-93ffc6021b2a', '117741c2-9578-4b4d-ae7f-f1bcca229ac7', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('fca8d286-a2ff-46c2-84b7-93ffc6021b2a', '98f34045-123f-47cc-b3df-e746aadf7eda', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('fca8d286-a2ff-46c2-84b7-93ffc6021b2a', '49a1315a-936c-4cb4-892a-a1b47a473fee', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('fca8d286-a2ff-46c2-84b7-93ffc6021b2a', 'aaa0ee83-5e8a-4d46-98e6-cb7bbf939ef1', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('fca8d286-a2ff-46c2-84b7-93ffc6021b2a', '4deb97a1-bf33-4e7e-91e4-3b0360d0dc54', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('fca8d286-a2ff-46c2-84b7-93ffc6021b2a', '432f5937-6324-4c8a-b323-9247eb489445', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('fca8d286-a2ff-46c2-84b7-93ffc6021b2a', 'bbd826e8-87b4-44cb-8673-7ac0b25d39b8', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('fca8d286-a2ff-46c2-84b7-93ffc6021b2a', 'c4377ec4-8e88-4af7-8979-ca028eece5d1', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('fca8d286-a2ff-46c2-84b7-93ffc6021b2a', 'edc90721-a6eb-43be-ad61-ccf625f5ae9e', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('fca8d286-a2ff-46c2-84b7-93ffc6021b2a', '3f8aa149-2378-4091-a61a-0960e2367c68', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('fca8d286-a2ff-46c2-84b7-93ffc6021b2a', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('fca8d286-a2ff-46c2-84b7-93ffc6021b2a', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('fca8d286-a2ff-46c2-84b7-93ffc6021b2a', '83403337-0f51-41cb-8c1d-8044ef8d4305', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('fca8d286-a2ff-46c2-84b7-93ffc6021b2a', '268445cd-2229-4e85-8660-f43b75afdb0f', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
