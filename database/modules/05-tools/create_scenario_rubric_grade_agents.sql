-- Module: create_scenario_rubric_grade_agents
-- Category: tool
-- Description: create_scenario_rubric_grade_agents MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-731c-a2f6-8ffc74d94378', 'rubric_id', '', 'string', true, '', '2026-01-13T02:51:36.014392+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7826-b1e5-b0cbcc52b0aa', '019bbf87-091f-731c-a2f6-8ffc74d94378', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-733e-8921-a259f7a4a804', 'grade_agent_id', '', 'string', true, '', '2026-01-13T02:51:36.014392+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7829-a783-29a1949e4438', '019bbf87-091f-733e-8921-a259f7a4a804', 1, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-7363-a53b-59c0c5d9656b', 'agent_id', '', 'string', true, '', '2026-01-13T02:51:36.014392+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-782d-b99b-2911afb158ab', '019bbf87-091f-7363-a53b-59c0c5d9656b', 2, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0966-7034-9f1e-9aa5955a38aa', '019bbf87-091f-731c-a2f6-8ffc74d94378', 'id', '{{ rubric_id }}', '2026-01-13T02:51:36.014392+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0966-70de-ae41-beb4dd620fe1', '019bbf87-091f-733e-8921-a259f7a4a804', 'grade_agent_id', '{{ grade_agent_id }}', '2026-01-13T02:51:36.014392+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0966-7185-b960-c6c580ea7096', '019bbf87-091f-7363-a53b-59c0c5d9656b', 'id', '{{ agent_id }}', '2026-01-13T02:51:36.014392+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-78ac-b274-cc12ae3a5ee1', 'Create a new scenario rubric grade agent resource', '2026-01-13T02:51:36.016365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-780e-acaf-b9543028ab5b', 'create_scenario_rubric_grade_agents', '2026-01-13T02:51:36.016365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('019bebc4-d436-7ca5-9162-a03a395231f4', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_scenario_rubric_grade_agents', 'Create a new scenario rubric grade agent resource', '{}', 'create', '{019bbf87-091f-733e-8921-a259f7a4a804,019bbf87-091f-731c-a2f6-8ffc74d94378,019bbf87-091f-7363-a53b-59c0c5d9656b}', '{019bbf87-0966-7034-9f1e-9aa5955a38aa,019bbf87-0966-70de-ae41-beb4dd620fe1,019bbf87-0966-7185-b960-c6c580ea7096}', '{scenario_rubrics}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bb544-12d5-79bb-a26d-d2c112eb55bd', '2026-01-13T02:51:36.016365+00:00', '2026-01-13T02:51:36.016365+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019bb544-12d5-79bb-a26d-d2c112eb55bd', '019c4e6b-2c29-7826-b1e5-b0cbcc52b0aa', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019bb544-12d5-79bb-a26d-d2c112eb55bd', '019c4e6b-2c29-7829-a783-29a1949e4438', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019bb544-12d5-79bb-a26d-d2c112eb55bd', '019c4e6b-2c29-782d-b99b-2911afb158ab', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb544-12d5-79bb-a26d-d2c112eb55bd', '019bbf87-091f-733e-8921-a259f7a4a804', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb544-12d5-79bb-a26d-d2c112eb55bd', '019bbf87-091f-731c-a2f6-8ffc74d94378', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019bb544-12d5-79bb-a26d-d2c112eb55bd', '019bbf87-091f-7363-a53b-59c0c5d9656b', '2026-01-14T18:39:46.747769+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb544-12d5-79bb-a26d-d2c112eb55bd', '019bbf87-0966-7034-9f1e-9aa5955a38aa', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb544-12d5-79bb-a26d-d2c112eb55bd', '019bbf87-0966-70de-ae41-beb4dd620fe1', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019bb544-12d5-79bb-a26d-d2c112eb55bd', '019bbf87-0966-7185-b960-c6c580ea7096', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019bb544-12d5-79bb-a26d-d2c112eb55bd', '019bbabc-5a32-78ac-b274-cc12ae3a5ee1', '2026-01-13T02:51:36.016365+00:00', false, false, true) ON CONFLICT (tool_id, descriptions_id) DO NOTHING;
-- tool_resources_junction
INSERT INTO public.tool_resources_junction (tool_id, resources_id, active, created_at, generated, mcp) VALUES ('019bb544-12d5-79bb-a26d-d2c112eb55bd', '019c4f27-1789-755a-ae00-6c38abda1503', true, '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (tool_id, resources_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flags_id, created_at, generated, mcp, active) VALUES ('019bb544-12d5-79bb-a26d-d2c112eb55bd', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-01-13T02:51:36.016365+00:00', false, false, true) ON CONFLICT (tool_id, flags_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operations_id, created_at, active, generated, mcp) VALUES ('019bb544-12d5-79bb-a26d-d2c112eb55bd', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operations_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, names_id, created_at, generated, mcp, active) VALUES ('019bb544-12d5-79bb-a26d-d2c112eb55bd', '019bbabc-5a32-780e-acaf-b9543028ab5b', '2026-01-13T02:51:36.016365+00:00', false, false, true) ON CONFLICT (tool_id, names_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bb544-12d5-79bb-a26d-d2c112eb55bd', '019bebc4-d436-7ca5-9162-a03a395231f4', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
