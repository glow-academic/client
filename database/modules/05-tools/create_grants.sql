-- Module: create_grants
-- Category: tool
-- Description: create_grants MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('87cc2bc2-f393-4ce1-95b3-407bb4bc7111', 'grants', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('d2b3703c-7d78-46cb-8001-86884e6bb6aa', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('99dd327f-00d6-4138-9895-7473164ec5c4', 'd2b3703c-7d78-46cb-8001-86884e6bb6aa', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('56edf18d-0cb9-4532-bf7f-9bf7f0832739', 'd2b3703c-7d78-46cb-8001-86884e6bb6aa', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('cdc4827d-ac82-410f-b0c3-486f4a1acfcc', 'expires_at', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('4b61dd81-efe5-454b-bcac-a76badcf3c85', 'cdc4827d-ac82-410f-b0c3-486f4a1acfcc', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('34096945-d00f-40b4-ba8b-2b7a3c1ff8eb', 'cdc4827d-ac82-410f-b0c3-486f4a1acfcc', 'expires_at', '{{ expires_at }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('5034cdf8-df62-468c-b4a3-eda7a4790d91', 'used_at', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('80ed4071-6a5d-495b-827b-5557dbbecce8', '5034cdf8-df62-468c-b4a3-eda7a4790d91', 2, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('46464501-225a-4052-a7c0-feb32b0a72a4', '5034cdf8-df62-468c-b4a3-eda7a4790d91', 'used_at', '{{ used_at }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('daa8bcdb-a124-4c72-b69d-9dc6fdfbc827', 'revoked_at', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('da286a69-687d-4cc7-8d97-814e3b907f39', 'daa8bcdb-a124-4c72-b69d-9dc6fdfbc827', 3, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('c864f10e-5841-4706-8a5e-c09e88c77eb3', 'daa8bcdb-a124-4c72-b69d-9dc6fdfbc827', 'revoked_at', '{{ revoked_at }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('5497ac0d-ff2e-461b-af41-7647b9d86f34', 'Create a new grants entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('7feb9c3d-b2fe-405c-806a-05c3d54ff4f8', 'create_grants', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('87779970-58f3-43cb-9ad1-fac9e05dfcb9', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_grants', 'Create a new grants entry', '{}', 'create', '{d2b3703c-7d78-46cb-8001-86884e6bb6aa,cdc4827d-ac82-410f-b0c3-486f4a1acfcc,5034cdf8-df62-468c-b4a3-eda7a4790d91,daa8bcdb-a124-4c72-b69d-9dc6fdfbc827}', '{56edf18d-0cb9-4532-bf7f-9bf7f0832739,34096945-d00f-40b4-ba8b-2b7a3c1ff8eb,46464501-225a-4052-a7c0-feb32b0a72a4,c864f10e-5841-4706-8a5e-c09e88c77eb3}', '{}'::text[], '{grants}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('8f064fbe-99bc-4624-8bcf-fc395ef12157', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('8f064fbe-99bc-4624-8bcf-fc395ef12157', '99dd327f-00d6-4138-9895-7473164ec5c4', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('8f064fbe-99bc-4624-8bcf-fc395ef12157', '4b61dd81-efe5-454b-bcac-a76badcf3c85', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('8f064fbe-99bc-4624-8bcf-fc395ef12157', '80ed4071-6a5d-495b-827b-5557dbbecce8', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('8f064fbe-99bc-4624-8bcf-fc395ef12157', 'da286a69-687d-4cc7-8d97-814e3b907f39', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('8f064fbe-99bc-4624-8bcf-fc395ef12157', 'd2b3703c-7d78-46cb-8001-86884e6bb6aa', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('8f064fbe-99bc-4624-8bcf-fc395ef12157', 'cdc4827d-ac82-410f-b0c3-486f4a1acfcc', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('8f064fbe-99bc-4624-8bcf-fc395ef12157', '5034cdf8-df62-468c-b4a3-eda7a4790d91', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('8f064fbe-99bc-4624-8bcf-fc395ef12157', 'daa8bcdb-a124-4c72-b69d-9dc6fdfbc827', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('8f064fbe-99bc-4624-8bcf-fc395ef12157', '56edf18d-0cb9-4532-bf7f-9bf7f0832739', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('8f064fbe-99bc-4624-8bcf-fc395ef12157', '34096945-d00f-40b4-ba8b-2b7a3c1ff8eb', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('8f064fbe-99bc-4624-8bcf-fc395ef12157', '46464501-225a-4052-a7c0-feb32b0a72a4', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('8f064fbe-99bc-4624-8bcf-fc395ef12157', 'c864f10e-5841-4706-8a5e-c09e88c77eb3', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('8f064fbe-99bc-4624-8bcf-fc395ef12157', '87cc2bc2-f393-4ce1-95b3-407bb4bc7111', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('8f064fbe-99bc-4624-8bcf-fc395ef12157', '5497ac0d-ff2e-461b-af41-7647b9d86f34', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('8f064fbe-99bc-4624-8bcf-fc395ef12157', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('8f064fbe-99bc-4624-8bcf-fc395ef12157', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('8f064fbe-99bc-4624-8bcf-fc395ef12157', '7feb9c3d-b2fe-405c-806a-05c3d54ff4f8', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('8f064fbe-99bc-4624-8bcf-fc395ef12157', '87779970-58f3-43cb-9ad1-fac9e05dfcb9', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
