-- Module: create_simulation_availability
-- Category: tool
-- Description: create_simulation_availability MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('a8be5da6-d2f0-4c53-98b6-bab0b076c974', 'available', '', 'boolean', true, '', '2026-02-21T22:16:39.602906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('d5459e86-6945-48ab-bd76-2d6ff376ddd0', 'a8be5da6-d2f0-4c53-98b6-bab0b076c974', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('5f423266-490c-41dc-9bfd-aa68ac37887e', 'a8be5da6-d2f0-4c53-98b6-bab0b076c974', 'available', '{{ available }}', '2026-02-21T22:16:39.604747+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d88-7be6-b02f-4e60fb234c81', 'Create a new simulation availability resource', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d88-7b4e-b8a4-592b8ba9e236', 'create_simulation_availability', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource, entry, artifact) VALUES ('eebab06c-460f-45d8-94ca-64cfa9d7e20c', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'create_simulation_availability', 'Create a simulation availability setting', '{}', true, '{a8be5da6-d2f0-4c53-98b6-bab0b076c974}', '{5f423266-490c-41dc-9bfd-aa68ac37887e}', 'simulation_availability', NULL, NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('f595ec06-41a3-49d8-8999-b6ee39034ba4', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('f595ec06-41a3-49d8-8999-b6ee39034ba4', 'd5459e86-6945-48ab-bd76-2d6ff376ddd0', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('f595ec06-41a3-49d8-8999-b6ee39034ba4', 'a8be5da6-d2f0-4c53-98b6-bab0b076c974', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('f595ec06-41a3-49d8-8999-b6ee39034ba4', '5f423266-490c-41dc-9bfd-aa68ac37887e', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('f595ec06-41a3-49d8-8999-b6ee39034ba4', '019c82b8-5d88-7be6-b02f-4e60fb234c81', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('f595ec06-41a3-49d8-8999-b6ee39034ba4', '9f42547f-1e25-49ba-97dc-8b85e1398666', true, '2026-02-23T14:09:37.222956+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('f595ec06-41a3-49d8-8999-b6ee39034ba4', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('f595ec06-41a3-49d8-8999-b6ee39034ba4', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-02-22T12:36:03.817884+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('f595ec06-41a3-49d8-8999-b6ee39034ba4', '019c82b8-5d88-7b4e-b8a4-592b8ba9e236', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('f595ec06-41a3-49d8-8999-b6ee39034ba4', 'eebab06c-460f-45d8-94ca-64cfa9d7e20c', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
