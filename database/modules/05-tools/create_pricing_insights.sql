-- Module: create_pricing_insights
-- Category: tool
-- Description: create_pricing_insights MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('99d7a441-8767-4f33-8319-07143a933f76', 'group_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('ac998707-b55f-4e32-9a2e-e4674ff93d23', '99d7a441-8767-4f33-8319-07143a933f76', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('2c962106-639a-47f6-9eef-e789a7f035b4', '99d7a441-8767-4f33-8319-07143a933f76', 'group_id', '{{ group_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('fcdbb434-9a46-48f6-b74e-4248654bccc7', 'content', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('0125c5f2-2ed0-4aa7-8bc6-3bc1399dcc20', 'fcdbb434-9a46-48f6-b74e-4248654bccc7', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('f8d315bc-b95a-4e14-86d0-ac7659df353f', 'fcdbb434-9a46-48f6-b74e-4248654bccc7', 'content', '{{ content }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('21667dba-5e15-4ded-a19a-9a6b63455b4c', 'Create a new pricing insights entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('cd096474-967c-4f3d-919b-a690e99c3796', 'create_pricing_insights', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('ea85e96b-3b90-4b0f-bac0-a4c52d67dc65', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_pricing_insights', 'Create a new pricing insights entry', '{}', 'create', '{99d7a441-8767-4f33-8319-07143a933f76,fcdbb434-9a46-48f6-b74e-4248654bccc7}', '{2c962106-639a-47f6-9eef-e789a7f035b4,f8d315bc-b95a-4e14-86d0-ac7659df353f}', '{}'::text[], '{pricing_insights}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('9b8603a2-e1f2-482d-98b3-a4f5897580fe', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('9b8603a2-e1f2-482d-98b3-a4f5897580fe', 'ac998707-b55f-4e32-9a2e-e4674ff93d23', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('9b8603a2-e1f2-482d-98b3-a4f5897580fe', '0125c5f2-2ed0-4aa7-8bc6-3bc1399dcc20', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('9b8603a2-e1f2-482d-98b3-a4f5897580fe', '99d7a441-8767-4f33-8319-07143a933f76', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('9b8603a2-e1f2-482d-98b3-a4f5897580fe', 'fcdbb434-9a46-48f6-b74e-4248654bccc7', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('9b8603a2-e1f2-482d-98b3-a4f5897580fe', '2c962106-639a-47f6-9eef-e789a7f035b4', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('9b8603a2-e1f2-482d-98b3-a4f5897580fe', 'f8d315bc-b95a-4e14-86d0-ac7659df353f', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('9b8603a2-e1f2-482d-98b3-a4f5897580fe', '018f0004-0001-7000-8000-000000000009', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('9b8603a2-e1f2-482d-98b3-a4f5897580fe', '21667dba-5e15-4ded-a19a-9a6b63455b4c', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('9b8603a2-e1f2-482d-98b3-a4f5897580fe', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('9b8603a2-e1f2-482d-98b3-a4f5897580fe', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('9b8603a2-e1f2-482d-98b3-a4f5897580fe', 'cd096474-967c-4f3d-919b-a690e99c3796', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('9b8603a2-e1f2-482d-98b3-a4f5897580fe', 'ea85e96b-3b90-4b0f-bac0-a4c52d67dc65', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
