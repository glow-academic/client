-- Module: create_pricing_insights
-- Category: tool
-- Description: create_pricing_insights MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('53736703-90ed-4930-a2c6-20561b07c0cd', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('e2f9f1eb-7f4b-48bd-9daa-d5e02812e74a', '53736703-90ed-4930-a2c6-20561b07c0cd', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('d7deff85-a104-4a11-8b82-584599d59126', '53736703-90ed-4930-a2c6-20561b07c0cd', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('82db9020-b449-446b-9eca-d851c74c4dbd', 'group_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('cbb615b4-7ec0-4fda-98ff-24ddd0cd63df', '82db9020-b449-446b-9eca-d851c74c4dbd', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('0846ad61-b5c5-461c-b188-bb1e4799737d', '82db9020-b449-446b-9eca-d851c74c4dbd', 'group_id', '{{ group_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('b170b503-2850-4bbb-8677-a31d2501522f', 'content', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('d33abd3a-3fb9-4299-9300-f76c19e2aaed', 'b170b503-2850-4bbb-8677-a31d2501522f', 2, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('dc6b5d29-e769-46c2-b682-c70b102b53c2', 'b170b503-2850-4bbb-8677-a31d2501522f', 'content', '{{ content }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('8bd55e07-c0b0-4466-b446-20c461cf0272', 'Create a new pricing insights entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('be2438f5-7ef1-47fb-beb1-e6509c815941', 'create_pricing_insights', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('31a367e4-3a98-439a-b6b9-1375fcbd1b2c', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_pricing_insights', 'Create a new pricing insights entry', '{}', 'create', '{53736703-90ed-4930-a2c6-20561b07c0cd,82db9020-b449-446b-9eca-d851c74c4dbd,b170b503-2850-4bbb-8677-a31d2501522f}', '{d7deff85-a104-4a11-8b82-584599d59126,0846ad61-b5c5-461c-b188-bb1e4799737d,dc6b5d29-e769-46c2-b682-c70b102b53c2}', '{}'::text[], '{pricing_insights}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('11c24e25-48db-4f2a-9b13-2a6753a09f1f', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('11c24e25-48db-4f2a-9b13-2a6753a09f1f', 'e2f9f1eb-7f4b-48bd-9daa-d5e02812e74a', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('11c24e25-48db-4f2a-9b13-2a6753a09f1f', 'cbb615b4-7ec0-4fda-98ff-24ddd0cd63df', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('11c24e25-48db-4f2a-9b13-2a6753a09f1f', 'd33abd3a-3fb9-4299-9300-f76c19e2aaed', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('11c24e25-48db-4f2a-9b13-2a6753a09f1f', '53736703-90ed-4930-a2c6-20561b07c0cd', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('11c24e25-48db-4f2a-9b13-2a6753a09f1f', '82db9020-b449-446b-9eca-d851c74c4dbd', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('11c24e25-48db-4f2a-9b13-2a6753a09f1f', 'b170b503-2850-4bbb-8677-a31d2501522f', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('11c24e25-48db-4f2a-9b13-2a6753a09f1f', 'd7deff85-a104-4a11-8b82-584599d59126', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('11c24e25-48db-4f2a-9b13-2a6753a09f1f', '0846ad61-b5c5-461c-b188-bb1e4799737d', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('11c24e25-48db-4f2a-9b13-2a6753a09f1f', 'dc6b5d29-e769-46c2-b682-c70b102b53c2', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('11c24e25-48db-4f2a-9b13-2a6753a09f1f', '018f0004-0001-7000-8000-000000000009', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('11c24e25-48db-4f2a-9b13-2a6753a09f1f', '8bd55e07-c0b0-4466-b446-20c461cf0272', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('11c24e25-48db-4f2a-9b13-2a6753a09f1f', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('11c24e25-48db-4f2a-9b13-2a6753a09f1f', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('11c24e25-48db-4f2a-9b13-2a6753a09f1f', 'be2438f5-7ef1-47fb-beb1-e6509c815941', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('11c24e25-48db-4f2a-9b13-2a6753a09f1f', '31a367e4-3a98-439a-b6b9-1375fcbd1b2c', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
