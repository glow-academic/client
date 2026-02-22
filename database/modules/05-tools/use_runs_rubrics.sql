-- Module: use_runs_rubrics
-- Category: tool
-- Description: use_runs_rubrics MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('9d73b780-9cfd-421a-92e4-a29b2feb26e8', 'runs_rubric_id', '', 'string', true, '', '2026-02-21T22:16:39.602906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('30248794-5180-4f91-b2e5-e710636e51a7', '9d73b780-9cfd-421a-92e4-a29b2feb26e8', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('f7fb9958-f74c-492a-ad8e-6e2a4b37f3bb', '9d73b780-9cfd-421a-92e4-a29b2feb26e8', 'id', '{{ runs_rubric_id }}', '2026-02-21T22:16:39.604747+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d8a-7da0-9bb8-df0289be507b', 'Use an existing runs rubrics resource instead of creating a new one', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d8a-7d21-aa5f-4fefaa2fd6f0', 'use_runs_rubrics', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource) VALUES ('4264ba54-2e31-4a1c-ab6b-605b2c63e759', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'use_runs_rubrics', 'Use an existing run-rubric binding by its ID', '{}', false, '{}', '{}', NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('3c119a2d-de26-4333-9f9a-ebc3238f0d4d', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('3c119a2d-de26-4333-9f9a-ebc3238f0d4d', '30248794-5180-4f91-b2e5-e710636e51a7', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('3c119a2d-de26-4333-9f9a-ebc3238f0d4d', '9d73b780-9cfd-421a-92e4-a29b2feb26e8', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('3c119a2d-de26-4333-9f9a-ebc3238f0d4d', 'f7fb9958-f74c-492a-ad8e-6e2a4b37f3bb', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('3c119a2d-de26-4333-9f9a-ebc3238f0d4d', '019c82b8-5d8a-7da0-9bb8-df0289be507b', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('3c119a2d-de26-4333-9f9a-ebc3238f0d4d', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('3c119a2d-de26-4333-9f9a-ebc3238f0d4d', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-02-22T12:36:03.817884+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('3c119a2d-de26-4333-9f9a-ebc3238f0d4d', '019c82b8-5d8a-7d21-aa5f-4fefaa2fd6f0', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('3c119a2d-de26-4333-9f9a-ebc3238f0d4d', '4264ba54-2e31-4a1c-ab6b-605b2c63e759', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
