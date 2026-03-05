-- Module: create_times
-- Category: tool
-- Description: create_times MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-7380-834d-0e0eb6b97d0c', 'scenario_id', '', 'string', true, '', '2026-01-13T02:51:36.015837+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-77e5-9bb4-0e5b70dd5389', '019bbf87-091f-7380-834d-0e0eb6b97d0c', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091e-7fe7-be5c-f809786ca7ff', 'time_taken', '', 'number', true, '', '2026-01-06T15:55:22.222790+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-77ea-8699-d5a75713518a', '019bbf87-091e-7fe7-be5c-f809786ca7ff', 1, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-096b-734d-b031-69ff82f593a4', '019bbf87-091f-7380-834d-0e0eb6b97d0c', 'scenario_id', '{{ scenario_id }}', '2026-01-13T02:51:36.015837+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-096a-7997-80ef-78cc7a63cb2b', '019bbf87-091e-7fe7-be5c-f809786ca7ff', 'time_limit_seconds', '{{ time_taken }}', '2026-01-06T15:55:22.222790+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-7039-b3a9-d51296dd346f', 'Create a new times resource', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a31-7fa6-bdeb-f9909b1cd4c2', 'create_times', '2026-01-08T20:52:05.827256+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('019bebc4-d436-7c7f-a1f3-9bc8a7bc70ba', '2026-01-17T17:58:56.053417+00:00', false, false, true, 'create_times', 'Create a new times resource', '{}', 'create', '{019bbf87-091e-7fe7-be5c-f809786ca7ff,019bbf87-091f-7380-834d-0e0eb6b97d0c}', '{019bbf87-096a-7997-80ef-78cc7a63cb2b,019bbf87-096b-734d-b031-69ff82f593a4}', '{scenario_time_limits}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019b9f61-804a-7035-8e24-ae6bd4c7ddb8', '2026-01-08T20:52:05.827256+00:00', '2026-01-08T20:52:05.827256+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019b9f61-804a-7035-8e24-ae6bd4c7ddb8', '019c4e6b-2c29-77e5-9bb4-0e5b70dd5389', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019b9f61-804a-7035-8e24-ae6bd4c7ddb8', '019c4e6b-2c29-77ea-8699-d5a75713518a', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-804a-7035-8e24-ae6bd4c7ddb8', '019bbf87-091e-7fe7-be5c-f809786ca7ff', '2026-01-09T03:07:20.516811+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019b9f61-804a-7035-8e24-ae6bd4c7ddb8', '019bbf87-091f-7380-834d-0e0eb6b97d0c', '2026-02-10T19:10:26.375145+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-804a-7035-8e24-ae6bd4c7ddb8', '019bbf87-096b-734d-b031-69ff82f593a4', '2026-02-10T19:10:26.375145+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019b9f61-804a-7035-8e24-ae6bd4c7ddb8', '019bbf87-096a-7997-80ef-78cc7a63cb2b', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019b9f61-804a-7035-8e24-ae6bd4c7ddb8', '019bbabc-5a32-7039-b3a9-d51296dd346f', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_resources_junction
INSERT INTO public.tool_resources_junction (tool_id, resource_id, active, created_at, generated, mcp) VALUES ('019b9f61-804a-7035-8e24-ae6bd4c7ddb8', '019c4f27-1788-77d1-80c2-d5f6a884ea5e', true, '2026-02-12T00:01:27.881501+00:00', false, false) ON CONFLICT (tool_id, resource_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('019b9f61-804a-7035-8e24-ae6bd4c7ddb8', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('019b9f61-804a-7035-8e24-ae6bd4c7ddb8', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019b9f61-804a-7035-8e24-ae6bd4c7ddb8', '019bbabc-5a31-7fa6-bdeb-f9909b1cd4c2', '2026-01-08T20:52:05.827256+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019b9f61-804a-7035-8e24-ae6bd4c7ddb8', '019bebc4-d436-7c7f-a1f3-9bc8a7bc70ba', true, '2026-01-17T17:58:56.053417+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
