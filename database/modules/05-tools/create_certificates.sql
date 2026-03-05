-- Module: create_certificates
-- Category: tool
-- Description: create_certificates MCP tool
-- ============================================================


-- Entry resource
INSERT INTO public.entries_resource (id, entry, created_at, active, generated, mcp) VALUES ('7ce51727-4469-4801-9797-5925956f6b6b', 'certificates', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('c8516836-36f8-4604-b250-15e981ea2f09', 'call_id', '', 'string', false, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('8bc886df-6738-4ecd-9c4d-20ca31ea8cfd', 'c8516836-36f8-4604-b250-15e981ea2f09', 0, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('bbda9b4d-816e-4560-85dc-3fbd28567121', 'c8516836-36f8-4604-b250-15e981ea2f09', 'call_id', '{{ call_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('c358ca35-3494-48ff-8dce-79f3baf34b2b', 'upload_id', '', 'string', true, '', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('a9bc8386-e159-4879-b50e-1ed35731c5aa', 'c358ca35-3494-48ff-8dce-79f3baf34b2b', 1, '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('ea9a1a03-d4d2-4cc3-8b7a-0d8abb1723c9', 'c358ca35-3494-48ff-8dce-79f3baf34b2b', 'upload_id', '{{ upload_id }}', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('aed5ab8c-0228-4ff4-88d0-54be4e913b29', 'Create a new certificates entry', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('c1fcd728-69fd-441c-bca9-d7ebbc81c07c', 'create_certificates', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('d3505e1c-3e5c-49ca-b8a5-7c0c09ea1e79', '2026-02-27T00:00:00.000000+00:00', false, false, true, 'create_certificates', 'Create a new certificates entry', '{}', 'create', '{c8516836-36f8-4604-b250-15e981ea2f09,c358ca35-3494-48ff-8dce-79f3baf34b2b}', '{bbda9b4d-816e-4560-85dc-3fbd28567121,ea9a1a03-d4d2-4cc3-8b7a-0d8abb1723c9}', '{}'::text[], '{certificates}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('c4961fd3-ac68-44ed-8966-8806ae60c79e', '2026-02-27T00:00:00.000000+00:00', '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('c4961fd3-ac68-44ed-8966-8806ae60c79e', '8bc886df-6738-4ecd-9c4d-20ca31ea8cfd', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('c4961fd3-ac68-44ed-8966-8806ae60c79e', 'a9bc8386-e159-4879-b50e-1ed35731c5aa', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('c4961fd3-ac68-44ed-8966-8806ae60c79e', 'c8516836-36f8-4604-b250-15e981ea2f09', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('c4961fd3-ac68-44ed-8966-8806ae60c79e', 'c358ca35-3494-48ff-8dce-79f3baf34b2b', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('c4961fd3-ac68-44ed-8966-8806ae60c79e', 'bbda9b4d-816e-4560-85dc-3fbd28567121', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('c4961fd3-ac68-44ed-8966-8806ae60c79e', 'ea9a1a03-d4d2-4cc3-8b7a-0d8abb1723c9', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_entries_junction
INSERT INTO public.tool_entries_junction (tool_id, entry_id, active, created_at, generated, mcp) VALUES ('c4961fd3-ac68-44ed-8966-8806ae60c79e', '7ce51727-4469-4801-9797-5925956f6b6b', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, entry_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('c4961fd3-ac68-44ed-8966-8806ae60c79e', 'aed5ab8c-0228-4ff4-88d0-54be4e913b29', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('c4961fd3-ac68-44ed-8966-8806ae60c79e', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('c4961fd3-ac68-44ed-8966-8806ae60c79e', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('c4961fd3-ac68-44ed-8966-8806ae60c79e', 'c1fcd728-69fd-441c-bca9-d7ebbc81c07c', '2026-02-27T00:00:00.000000+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('c4961fd3-ac68-44ed-8966-8806ae60c79e', 'd3505e1c-3e5c-49ca-b8a5-7c0c09ea1e79', true, '2026-02-27T00:00:00.000000+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
