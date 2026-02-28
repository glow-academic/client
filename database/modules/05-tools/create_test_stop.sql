-- Module: create_test_stop
-- Category: tool
-- Description: create_test_stop MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('e6c4e7e7-d41b-4cd4-84e2-8559fe24fa1d', 'test_stops', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('859689c6-87b1-4e5f-8161-145806c1c04b', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('d08d735e-0063-4fcf-afc3-b12c36ad6027', '859689c6-87b1-4e5f-8161-145806c1c04b', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('10022ff5-24da-4fd8-a606-1797cee9d332', '859689c6-87b1-4e5f-8161-145806c1c04b', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('cac8e40d-9a1a-4d0d-b7c7-f22609daaa6a', 'invocation_id', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('6f3e295f-6530-4e55-afb5-b53fd64033f3', 'cac8e40d-9a1a-4d0d-b7c7-f22609daaa6a', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('c28c3f03-3411-46ae-9858-1d2e4341e0de', 'cac8e40d-9a1a-4d0d-b7c7-f22609daaa6a', 'invocation_id', '{{ invocation_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('66e55efa-ca87-482f-8ffb-9bc676bc23c3', 'stopped', '', 'boolean', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('efaed2e8-e2b7-464c-81f1-3454d0a4fd0a', '66e55efa-ca87-482f-8ffb-9bc676bc23c3', 2, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('b2c5119b-81bd-464a-9af2-0009e0328a51', '66e55efa-ca87-482f-8ffb-9bc676bc23c3', 'stopped', '{{ stopped }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('b49b537c-a7a5-40e4-9a99-53e6c48a6afe', 'Create a new test stop entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('0b8ff74b-3990-42b0-93e9-1a8c191d531f', 'create_test_stop', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('29f9ee56-1534-4c3a-931e-15d312c621b5', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_test_stop', 'Create a new test stop entry', '{}', 'create', '{859689c6-87b1-4e5f-8161-145806c1c04b,cac8e40d-9a1a-4d0d-b7c7-f22609daaa6a,66e55efa-ca87-482f-8ffb-9bc676bc23c3}', '{10022ff5-24da-4fd8-a606-1797cee9d332,c28c3f03-3411-46ae-9858-1d2e4341e0de,b2c5119b-81bd-464a-9af2-0009e0328a51}', '{}'::text[], '{test_stops}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('f263bbbf-d4e5-47bb-91fe-3c489a109653', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('f263bbbf-d4e5-47bb-91fe-3c489a109653', 'd08d735e-0063-4fcf-afc3-b12c36ad6027', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('f263bbbf-d4e5-47bb-91fe-3c489a109653', '6f3e295f-6530-4e55-afb5-b53fd64033f3', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('f263bbbf-d4e5-47bb-91fe-3c489a109653', 'efaed2e8-e2b7-464c-81f1-3454d0a4fd0a', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('f263bbbf-d4e5-47bb-91fe-3c489a109653', '859689c6-87b1-4e5f-8161-145806c1c04b', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('f263bbbf-d4e5-47bb-91fe-3c489a109653', 'cac8e40d-9a1a-4d0d-b7c7-f22609daaa6a', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('f263bbbf-d4e5-47bb-91fe-3c489a109653', '66e55efa-ca87-482f-8ffb-9bc676bc23c3', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('f263bbbf-d4e5-47bb-91fe-3c489a109653', '10022ff5-24da-4fd8-a606-1797cee9d332', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('f263bbbf-d4e5-47bb-91fe-3c489a109653', 'c28c3f03-3411-46ae-9858-1d2e4341e0de', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('f263bbbf-d4e5-47bb-91fe-3c489a109653', 'b2c5119b-81bd-464a-9af2-0009e0328a51', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('f263bbbf-d4e5-47bb-91fe-3c489a109653', 'e6c4e7e7-d41b-4cd4-84e2-8559fe24fa1d', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('f263bbbf-d4e5-47bb-91fe-3c489a109653', 'b49b537c-a7a5-40e4-9a99-53e6c48a6afe', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('f263bbbf-d4e5-47bb-91fe-3c489a109653', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('f263bbbf-d4e5-47bb-91fe-3c489a109653', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('f263bbbf-d4e5-47bb-91fe-3c489a109653', '0b8ff74b-3990-42b0-93e9-1a8c191d531f', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('f263bbbf-d4e5-47bb-91fe-3c489a109653', '29f9ee56-1534-4c3a-931e-15d312c621b5', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
