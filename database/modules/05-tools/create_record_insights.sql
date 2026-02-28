-- Module: create_record_insights
-- Category: tool
-- Description: create_record_insights MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('033ef703-c594-40cb-8a06-8b55a9c15b17', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('0719633b-fe00-4b57-8ccf-5c414831c27f', '033ef703-c594-40cb-8a06-8b55a9c15b17', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('c249dd53-45e2-4f0c-b3e9-d092e1a94c3a', '033ef703-c594-40cb-8a06-8b55a9c15b17', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('709996a3-a24c-4cfb-9a46-8a1a780a3eec', 'group_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('2562f3e5-60e5-4b1b-b026-909a42c1d0da', '709996a3-a24c-4cfb-9a46-8a1a780a3eec', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('c781d0b3-16b4-4260-875f-de43685a1d4e', '709996a3-a24c-4cfb-9a46-8a1a780a3eec', 'group_id', '{{ group_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('e3634b14-de4d-4cac-bc8f-d05d5b9f73da', 'content', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('1170629a-c6ce-4e57-90d1-13c771435d30', 'e3634b14-de4d-4cac-bc8f-d05d5b9f73da', 2, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('41cd314d-8c08-415d-9204-e314de509004', 'e3634b14-de4d-4cac-bc8f-d05d5b9f73da', 'content', '{{ content }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('0339cd20-b6a9-4a5b-83ee-368c4f0686f4', 'Create a new record insights entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('67743c21-81ff-4b5e-a588-ab0f2ae177c9', 'create_record_insights', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('b6a3154b-30cf-4b02-9a4d-9c117e769914', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_record_insights', 'Create a new record insights entry', '{}', 'create', '{033ef703-c594-40cb-8a06-8b55a9c15b17,709996a3-a24c-4cfb-9a46-8a1a780a3eec,e3634b14-de4d-4cac-bc8f-d05d5b9f73da}', '{c249dd53-45e2-4f0c-b3e9-d092e1a94c3a,c781d0b3-16b4-4260-875f-de43685a1d4e,41cd314d-8c08-415d-9204-e314de509004}', '{}'::text[], '{record_insights}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('0f796045-97d0-489f-bf71-15cfd9cbf1eb', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('0f796045-97d0-489f-bf71-15cfd9cbf1eb', '0719633b-fe00-4b57-8ccf-5c414831c27f', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('0f796045-97d0-489f-bf71-15cfd9cbf1eb', '2562f3e5-60e5-4b1b-b026-909a42c1d0da', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('0f796045-97d0-489f-bf71-15cfd9cbf1eb', '1170629a-c6ce-4e57-90d1-13c771435d30', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('0f796045-97d0-489f-bf71-15cfd9cbf1eb', '033ef703-c594-40cb-8a06-8b55a9c15b17', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('0f796045-97d0-489f-bf71-15cfd9cbf1eb', '709996a3-a24c-4cfb-9a46-8a1a780a3eec', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('0f796045-97d0-489f-bf71-15cfd9cbf1eb', 'e3634b14-de4d-4cac-bc8f-d05d5b9f73da', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('0f796045-97d0-489f-bf71-15cfd9cbf1eb', 'c249dd53-45e2-4f0c-b3e9-d092e1a94c3a', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('0f796045-97d0-489f-bf71-15cfd9cbf1eb', 'c781d0b3-16b4-4260-875f-de43685a1d4e', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('0f796045-97d0-489f-bf71-15cfd9cbf1eb', '41cd314d-8c08-415d-9204-e314de509004', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('0f796045-97d0-489f-bf71-15cfd9cbf1eb', '018f0004-0001-7000-8000-00000000000a', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('0f796045-97d0-489f-bf71-15cfd9cbf1eb', '0339cd20-b6a9-4a5b-83ee-368c4f0686f4', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('0f796045-97d0-489f-bf71-15cfd9cbf1eb', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('0f796045-97d0-489f-bf71-15cfd9cbf1eb', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('0f796045-97d0-489f-bf71-15cfd9cbf1eb', '67743c21-81ff-4b5e-a588-ab0f2ae177c9', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('0f796045-97d0-489f-bf71-15cfd9cbf1eb', 'b6a3154b-30cf-4b02-9a4d-9c117e769914', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
