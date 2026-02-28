-- Module: create_sessions
-- Category: tool
-- Description: create_sessions MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('b222b46f-6354-4eff-a118-c562af2a5ee8', 'sessions', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('4476b13d-b8f3-4c1e-9fe2-9cbaa1a1e6e1', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('231674ab-2ec1-4ce9-8db3-94ca762fa7e4', '4476b13d-b8f3-4c1e-9fe2-9cbaa1a1e6e1', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('40980965-5f18-4050-80ff-868401b5b9b7', '4476b13d-b8f3-4c1e-9fe2-9cbaa1a1e6e1', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('e3a5c54f-88c7-4616-8167-5b56349618a1', 'profile_id', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('be25b968-f0b3-47a2-b2f1-399f61e937d5', 'e3a5c54f-88c7-4616-8167-5b56349618a1', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('49db3806-7819-49c7-b290-37c1dfd8ee21', 'e3a5c54f-88c7-4616-8167-5b56349618a1', 'profile_id', '{{ profile_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('7a54d9f6-600e-4a48-8a92-3250a759686f', 'Create a new sessions entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('a5475c65-b925-431f-88bf-f266c312db9d', 'create_sessions', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('1a0e5129-5260-4110-93ef-ae8fb1f90b25', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_sessions', 'Create a new sessions entry', '{}', 'create', '{4476b13d-b8f3-4c1e-9fe2-9cbaa1a1e6e1,e3a5c54f-88c7-4616-8167-5b56349618a1}', '{40980965-5f18-4050-80ff-868401b5b9b7,49db3806-7819-49c7-b290-37c1dfd8ee21}', '{}'::text[], '{sessions}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('20117bad-457b-457a-9b10-e33cb8ac7642', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('20117bad-457b-457a-9b10-e33cb8ac7642', '231674ab-2ec1-4ce9-8db3-94ca762fa7e4', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('20117bad-457b-457a-9b10-e33cb8ac7642', 'be25b968-f0b3-47a2-b2f1-399f61e937d5', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('20117bad-457b-457a-9b10-e33cb8ac7642', '4476b13d-b8f3-4c1e-9fe2-9cbaa1a1e6e1', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('20117bad-457b-457a-9b10-e33cb8ac7642', 'e3a5c54f-88c7-4616-8167-5b56349618a1', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('20117bad-457b-457a-9b10-e33cb8ac7642', '40980965-5f18-4050-80ff-868401b5b9b7', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('20117bad-457b-457a-9b10-e33cb8ac7642', '49db3806-7819-49c7-b290-37c1dfd8ee21', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('20117bad-457b-457a-9b10-e33cb8ac7642', 'b222b46f-6354-4eff-a118-c562af2a5ee8', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('20117bad-457b-457a-9b10-e33cb8ac7642', '7a54d9f6-600e-4a48-8a92-3250a759686f', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('20117bad-457b-457a-9b10-e33cb8ac7642', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('20117bad-457b-457a-9b10-e33cb8ac7642', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('20117bad-457b-457a-9b10-e33cb8ac7642', 'a5475c65-b925-431f-88bf-f266c312db9d', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('20117bad-457b-457a-9b10-e33cb8ac7642', '1a0e5129-5260-4110-93ef-ae8fb1f90b25', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
