-- Module: use_prompts
-- Category: tool
-- Description: use_prompts MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('9fa45ea4-efee-41b0-85e6-52e7a3ff3e4d', 'prompt_id', '', 'string', true, '', '2026-02-21T22:16:39.602906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('403e3484-64be-4e2e-9a75-df0ab882135e', '9fa45ea4-efee-41b0-85e6-52e7a3ff3e4d', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('f8453079-705d-4b16-9c03-2b15fcdd4a02', '9fa45ea4-efee-41b0-85e6-52e7a3ff3e4d', 'id', '{{ prompt_id }}', '2026-02-21T22:16:39.604747+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d89-7cd8-b1f8-73a3224d013c', 'Use an existing prompts resource instead of creating a new one', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d89-7c3f-999a-49755fb591b1', 'use_prompts', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable, args_ids, args_output_ids, resource, entry) VALUES ('b8d2fd18-ee1b-4564-b6f4-bbac30a9cbfc', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'use_prompts', 'Use an existing prompt by its ID', '{}', false, '{9fa45ea4-efee-41b0-85e6-52e7a3ff3e4d}', '{f8453079-705d-4b16-9c03-2b15fcdd4a02}', NULL, NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('087ae218-ebc0-45be-b403-665fbecbfd33', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('087ae218-ebc0-45be-b403-665fbecbfd33', '403e3484-64be-4e2e-9a75-df0ab882135e', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('087ae218-ebc0-45be-b403-665fbecbfd33', '9fa45ea4-efee-41b0-85e6-52e7a3ff3e4d', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('087ae218-ebc0-45be-b403-665fbecbfd33', 'f8453079-705d-4b16-9c03-2b15fcdd4a02', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('087ae218-ebc0-45be-b403-665fbecbfd33', '019c82b8-5d89-7cd8-b1f8-73a3224d013c', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('087ae218-ebc0-45be-b403-665fbecbfd33', '019be334-bfc6-74fb-be11-ea6b522945bb', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
INSERT INTO public.tool_flags_junction (tool_id, flag_id, value, created_at, generated, mcp, active) VALUES ('087ae218-ebc0-45be-b403-665fbecbfd33', 'df188f80-b6c5-46bc-b945-df1a40318de5', false, '2026-02-22T12:36:03.817884+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('087ae218-ebc0-45be-b403-665fbecbfd33', '019c82b8-5d89-7c3f-999a-49755fb591b1', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('087ae218-ebc0-45be-b403-665fbecbfd33', 'b8d2fd18-ee1b-4564-b6f4-bbac30a9cbfc', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
