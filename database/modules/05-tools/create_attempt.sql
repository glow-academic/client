-- Module: create_attempt
-- Category: tool
-- Description: create_attempt MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('dcc8e4a6-bf7e-48ee-8b34-2f968b460c61', 'attempts', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('cde90494-86c0-4493-bf2d-0bbb0b64b83c', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('452c3afb-0e4c-4cbe-b707-963fc4e9306e', 'cde90494-86c0-4493-bf2d-0bbb0b64b83c', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('2d489c50-f7a7-4e13-a273-b94a4f446b98', 'cde90494-86c0-4493-bf2d-0bbb0b64b83c', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('c3c873bf-20aa-4971-a6dc-a5560aab4610', 'infinite_mode', '', 'boolean', false, 'false', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('0f58f9fa-cb92-436f-bc60-428945336a40', 'c3c873bf-20aa-4971-a6dc-a5560aab4610', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('d54d4188-325a-4b89-938c-6ab682f75962', 'c3c873bf-20aa-4971-a6dc-a5560aab4610', 'infinite_mode', '{{ infinite_mode }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('06fdcbec-e961-4090-aabb-31927e36562d', 'num_chats', '', 'number', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('ce7b862b-798c-4014-b982-784f96e98b04', '06fdcbec-e961-4090-aabb-31927e36562d', 2, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('27bddf89-0d15-4d07-a642-0a02ca64d7a4', '06fdcbec-e961-4090-aabb-31927e36562d', 'num_chats', '{{ num_chats }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('b88860f0-a391-4d6c-bbc3-645cd68bf5f2', 'user_persona_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('8c9e8454-f439-4f5a-9ed5-ca2dbdbfff1e', 'b88860f0-a391-4d6c-bbc3-645cd68bf5f2', 3, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('9f398545-496d-4e26-9f14-56228a629b49', 'b88860f0-a391-4d6c-bbc3-645cd68bf5f2', 'user_persona_id', '{{ user_persona_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('51b7b518-4780-4a50-992a-d19ab4949c16', 'Create a new attempt entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('d2f79cf0-55c3-439b-8607-16b17850d51e', 'create_attempt', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('7584b3f8-37d2-4063-89b6-635e9bd741ed', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_attempt', 'Create a new attempt entry', '{}', 'create', '{cde90494-86c0-4493-bf2d-0bbb0b64b83c,c3c873bf-20aa-4971-a6dc-a5560aab4610,06fdcbec-e961-4090-aabb-31927e36562d,b88860f0-a391-4d6c-bbc3-645cd68bf5f2}', '{2d489c50-f7a7-4e13-a273-b94a4f446b98,d54d4188-325a-4b89-938c-6ab682f75962,27bddf89-0d15-4d07-a642-0a02ca64d7a4,9f398545-496d-4e26-9f14-56228a629b49}', '{}'::text[], '{attempts}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('570691a3-b97f-4933-97f6-f47f00c46378', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('570691a3-b97f-4933-97f6-f47f00c46378', '452c3afb-0e4c-4cbe-b707-963fc4e9306e', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('570691a3-b97f-4933-97f6-f47f00c46378', '0f58f9fa-cb92-436f-bc60-428945336a40', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('570691a3-b97f-4933-97f6-f47f00c46378', 'ce7b862b-798c-4014-b982-784f96e98b04', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('570691a3-b97f-4933-97f6-f47f00c46378', '8c9e8454-f439-4f5a-9ed5-ca2dbdbfff1e', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('570691a3-b97f-4933-97f6-f47f00c46378', 'cde90494-86c0-4493-bf2d-0bbb0b64b83c', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('570691a3-b97f-4933-97f6-f47f00c46378', 'c3c873bf-20aa-4971-a6dc-a5560aab4610', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('570691a3-b97f-4933-97f6-f47f00c46378', '06fdcbec-e961-4090-aabb-31927e36562d', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('570691a3-b97f-4933-97f6-f47f00c46378', 'b88860f0-a391-4d6c-bbc3-645cd68bf5f2', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('570691a3-b97f-4933-97f6-f47f00c46378', '2d489c50-f7a7-4e13-a273-b94a4f446b98', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('570691a3-b97f-4933-97f6-f47f00c46378', 'd54d4188-325a-4b89-938c-6ab682f75962', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('570691a3-b97f-4933-97f6-f47f00c46378', '27bddf89-0d15-4d07-a642-0a02ca64d7a4', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('570691a3-b97f-4933-97f6-f47f00c46378', '9f398545-496d-4e26-9f14-56228a629b49', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('570691a3-b97f-4933-97f6-f47f00c46378', 'dcc8e4a6-bf7e-48ee-8b34-2f968b460c61', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('570691a3-b97f-4933-97f6-f47f00c46378', '51b7b518-4780-4a50-992a-d19ab4949c16', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('570691a3-b97f-4933-97f6-f47f00c46378', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('570691a3-b97f-4933-97f6-f47f00c46378', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('570691a3-b97f-4933-97f6-f47f00c46378', 'd2f79cf0-55c3-439b-8607-16b17850d51e', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('570691a3-b97f-4933-97f6-f47f00c46378', '7584b3f8-37d2-4063-89b6-635e9bd741ed', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
