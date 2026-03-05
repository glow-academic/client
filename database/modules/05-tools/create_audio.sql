-- Module: create_audio
-- Category: tool
-- Description: create_audio MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('019bbf87-091f-741e-9750-ffa018c4a030', 'active', '', 'boolean', true, 'true', '2026-01-13T03:25:29.718071+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('019c4e6b-2c29-7814-9312-ee6acd12dbd9', '019bbf87-091f-741e-9750-ffa018c4a030', 0, '2026-02-11T20:36:12.457770+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('019bbf87-0965-723f-9fa6-99aaa445f4fc', '019bbf87-091f-741e-9750-ffa018c4a030', 'active', '{{ active }}', '2026-01-14T18:39:46.698365+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-7677-9602-9009e7f5e56a', 'Create an audio resource. The audio will be linked to the message.', '2026-01-09T15:45:34.098832+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bbabc-5a32-75e1-970c-b6e01e42bb13', 'create_audio', '2026-01-09T15:45:34.098832+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019ba36f-3993-7149-a59f-edcd695310bb', '2026-01-09T15:45:34.098832+00:00', '2026-01-09T15:45:34.098832+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('019ba36f-3993-7149-a59f-edcd695310bb', '019c4e6b-2c29-7814-9312-ee6acd12dbd9', '2026-02-11T20:36:12.459709+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('019ba36f-3993-7149-a59f-edcd695310bb', '019bbf87-091f-741e-9750-ffa018c4a030', '2026-01-09T15:45:34.098832+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('019ba36f-3993-7149-a59f-edcd695310bb', '019bbf87-0965-723f-9fa6-99aaa445f4fc', '2026-01-15T02:40:56.673612+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019ba36f-3993-7149-a59f-edcd695310bb', '019bbabc-5a32-7677-9602-9009e7f5e56a', '2026-01-09T15:45:34.098832+00:00', false, false, true) ON CONFLICT (tool_id, descriptions_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flags_id, created_at, generated, mcp, active) VALUES ('019ba36f-3993-7149-a59f-edcd695310bb', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-01-09T15:45:34.098832+00:00', false, false, true) ON CONFLICT (tool_id, flags_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operations_id, created_at, active, generated, mcp) VALUES ('019ba36f-3993-7149-a59f-edcd695310bb', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operations_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, names_id, created_at, generated, mcp, active) VALUES ('019ba36f-3993-7149-a59f-edcd695310bb', '019bbabc-5a32-75e1-970c-b6e01e42bb13', '2026-01-09T15:45:34.098832+00:00', false, false, true) ON CONFLICT (tool_id, names_id) DO NOTHING;
