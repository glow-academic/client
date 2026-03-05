-- Module: create_messages_completions
-- Category: tool
-- Description: create_messages_completions MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('c07860f5-472a-47fc-aa92-ed125c8e2595', 'messages_completions', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('2b128cf1-4f4c-4272-80da-51add6dd33b9', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('3a96510e-4898-4f6a-8286-56b915490684', '2b128cf1-4f4c-4272-80da-51add6dd33b9', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('29a70f1a-ba2a-4c06-a3a1-55e66329f272', '2b128cf1-4f4c-4272-80da-51add6dd33b9', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('e8d21372-edcf-4c28-9842-eb3bd2a7c5bb', 'message_id', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('295da852-d3a5-4763-880d-948f997239b8', 'e8d21372-edcf-4c28-9842-eb3bd2a7c5bb', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('3cde7327-f6c5-43f5-936a-46410cf5e0e3', 'e8d21372-edcf-4c28-9842-eb3bd2a7c5bb', 'message_id', '{{ message_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('47b360aa-37ee-4140-b288-13b01b876d6c', 'Create a new messages completions entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('a11dfdee-cd06-43cc-9e5a-06f93f7fec86', 'create_messages_completions', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('17a6db0b-6a94-4591-a826-5ecb0dda01ce', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_messages_completions', 'Create a new messages completions entry', '{}', 'create', '{2b128cf1-4f4c-4272-80da-51add6dd33b9,e8d21372-edcf-4c28-9842-eb3bd2a7c5bb}', '{29a70f1a-ba2a-4c06-a3a1-55e66329f272,3cde7327-f6c5-43f5-936a-46410cf5e0e3}', '{}'::text[], '{messages_completions}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('60963631-ac6e-4116-afb4-aa88dcb6ddd9', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('60963631-ac6e-4116-afb4-aa88dcb6ddd9', '3a96510e-4898-4f6a-8286-56b915490684', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('60963631-ac6e-4116-afb4-aa88dcb6ddd9', '295da852-d3a5-4763-880d-948f997239b8', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('60963631-ac6e-4116-afb4-aa88dcb6ddd9', '2b128cf1-4f4c-4272-80da-51add6dd33b9', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('60963631-ac6e-4116-afb4-aa88dcb6ddd9', 'e8d21372-edcf-4c28-9842-eb3bd2a7c5bb', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('60963631-ac6e-4116-afb4-aa88dcb6ddd9', '29a70f1a-ba2a-4c06-a3a1-55e66329f272', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('60963631-ac6e-4116-afb4-aa88dcb6ddd9', '3cde7327-f6c5-43f5-936a-46410cf5e0e3', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entries_id, active, created_at, generated, mcp) VALUES ('60963631-ac6e-4116-afb4-aa88dcb6ddd9', 'c07860f5-472a-47fc-aa92-ed125c8e2595', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entries_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, descriptions_id, created_at, generated, mcp, active) VALUES ('60963631-ac6e-4116-afb4-aa88dcb6ddd9', '47b360aa-37ee-4140-b288-13b01b876d6c', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, descriptions_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flags_id, created_at, generated, mcp, active) VALUES ('60963631-ac6e-4116-afb4-aa88dcb6ddd9', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flags_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operations_id, created_at, active, generated, mcp) VALUES ('60963631-ac6e-4116-afb4-aa88dcb6ddd9', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operations_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, names_id, created_at, generated, mcp, active) VALUES ('60963631-ac6e-4116-afb4-aa88dcb6ddd9', 'a11dfdee-cd06-43cc-9e5a-06f93f7fec86', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, names_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('60963631-ac6e-4116-afb4-aa88dcb6ddd9', '17a6db0b-6a94-4591-a826-5ecb0dda01ce', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
