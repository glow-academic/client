-- Module: create_scenario_rubrics
-- Category: tool
-- Description: create_scenario_rubrics MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-7380-834d-0e0eb6b97d0c', 'scenario_id', '', 'string', true, '', '2026-01-13T02:51:36.015837+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('c405b07b-a40e-493d-8407-6a6527c6da80', '019bbf87-091f-7380-834d-0e0eb6b97d0c', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-731c-a2f6-8ffc74d94378', 'rubric_id', '', 'string', true, '', '2026-01-13T02:51:36.014392+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('a0673481-2f8f-46b8-ac49-8d3ac72970ea', '019bbf87-091f-731c-a2f6-8ffc74d94378', 1, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-096b-734d-b031-69ff82f593a4', '019bbf87-091f-7380-834d-0e0eb6b97d0c', 'scenario_id', '{{ scenario_id }}', '2026-01-13T02:51:36.015837+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0966-7034-9f1e-9aa5955a38aa', '019bbf87-091f-731c-a2f6-8ffc74d94378', 'rubric_id', '{{ rubric_id }}', '2026-01-13T02:51:36.014392+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d89-76e8-8885-a75e712c8b75', 'Create a new scenario rubrics resource', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d89-765d-aea0-46314b3f4aff', 'create_scenario_rubrics', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource, entry) VALUES ('7dc39eae-ae96-43d8-bf84-738d775b2780', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'create_scenario_rubrics', 'Create a scenario-rubric binding', '{}', true, '{019bbf87-091f-731c-a2f6-8ffc74d94378,019bbf87-091f-7380-834d-0e0eb6b97d0c}', '{019bbf87-0966-7034-9f1e-9aa5955a38aa,019bbf87-096b-734d-b031-69ff82f593a4}', 'scenario_rubrics', NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('6e855414-8af1-4cf0-bed3-c17643aba9fe', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('6e855414-8af1-4cf0-bed3-c17643aba9fe', 'c405b07b-a40e-493d-8407-6a6527c6da80', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('6e855414-8af1-4cf0-bed3-c17643aba9fe', 'a0673481-2f8f-46b8-ac49-8d3ac72970ea', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('6e855414-8af1-4cf0-bed3-c17643aba9fe', '019bbf87-091f-7380-834d-0e0eb6b97d0c', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('6e855414-8af1-4cf0-bed3-c17643aba9fe', '019bbf87-091f-731c-a2f6-8ffc74d94378', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('6e855414-8af1-4cf0-bed3-c17643aba9fe', '019bbf87-096b-734d-b031-69ff82f593a4', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('6e855414-8af1-4cf0-bed3-c17643aba9fe', '019bbf87-0966-7034-9f1e-9aa5955a38aa', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('6e855414-8af1-4cf0-bed3-c17643aba9fe', '019c82b8-5d89-76e8-8885-a75e712c8b75', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_domains_junction
INSERT INTO public.tool_domains_junction (tool_id, domain_id, active, created_at, generated, mcp) VALUES ('6e855414-8af1-4cf0-bed3-c17643aba9fe', '019c4f27-1789-755a-ae00-6c38abda1503', true, '2026-02-23T14:09:37.222956+00:00', false, false) ON CONFLICT (tool_id, domain_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('6e855414-8af1-4cf0-bed3-c17643aba9fe', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('6e855414-8af1-4cf0-bed3-c17643aba9fe', 'df188f80-b6c5-46bc-b945-df1a40318de5', true, '2026-02-22T12:36:03.817884+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('6e855414-8af1-4cf0-bed3-c17643aba9fe', '019c82b8-5d89-765d-aea0-46314b3f4aff', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('6e855414-8af1-4cf0-bed3-c17643aba9fe', '7dc39eae-ae96-43d8-bf84-738d775b2780', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
