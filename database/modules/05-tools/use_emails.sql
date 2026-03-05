-- Module: use_emails
-- Category: tool
-- Description: use_emails MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.args_resource (id, name, description, field_type, required, default_value, created_at, active, generated, mcp) VALUES ('e1e8afa3-68fa-479c-afd8-7a087ec5ab2d', 'email_id', '', 'string', true, '', '2026-02-21T22:16:39.602906+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.arg_positions_resource (id, args_id, value, created_at, active, generated, mcp) VALUES ('f2a96ecd-0514-451f-8b95-f067c7870cc4', 'e1e8afa3-68fa-479c-afd8-7a087ec5ab2d', 0, '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_outputs_resource (id, args_id, name, template, created_at, active, generated, mcp) VALUES ('0f859f29-a9b8-4266-8d9b-1f4a4f28bd41', 'e1e8afa3-68fa-479c-afd8-7a087ec5ab2d', 'id', '{{ email_id }}', '2026-02-21T22:16:39.604747+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d8b-741f-8851-9fe0cd2ca483', 'Use an existing emails resource instead of creating a new one', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d8b-739f-95a7-c3e81cd65611', 'use_emails', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('eb52f323-b454-48c8-8385-69fad8f8388b', '2026-02-21T22:16:39.608062+00:00', false, false, true, 'use_emails', 'Use an existing email by its ID', '{}', 'link', '{e1e8afa3-68fa-479c-afd8-7a087ec5ab2d}', '{0f859f29-a9b8-4266-8d9b-1f4a4f28bd41}', '{}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('b82f3d64-97f9-40fd-b963-368aff2f8e68', '2026-02-21T22:16:39.608062+00:00', '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_arg_positions_junction
INSERT INTO public.tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp) VALUES ('b82f3d64-97f9-40fd-b963-368aff2f8e68', 'f2a96ecd-0514-451f-8b95-f067c7870cc4', '2026-02-21T22:16:39.608062+00:00', true, false, false) ON CONFLICT (tool_id, arg_positions_id) DO NOTHING;
-- tool_args_junction
INSERT INTO public.tool_args_junction (tool_id, args_id, created_at, generated, mcp, active) VALUES ('b82f3d64-97f9-40fd-b963-368aff2f8e68', 'e1e8afa3-68fa-479c-afd8-7a087ec5ab2d', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_id) DO NOTHING;
-- tool_args_outputs_junction
INSERT INTO public.tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active) VALUES ('b82f3d64-97f9-40fd-b963-368aff2f8e68', '0f859f29-a9b8-4266-8d9b-1f4a4f28bd41', '2026-02-21T22:16:39.608062+00:00', false, false, true) ON CONFLICT (tool_id, args_outputs_id) DO NOTHING;
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, descriptions_id, created_at, generated, mcp, active) VALUES ('b82f3d64-97f9-40fd-b963-368aff2f8e68', '019c82b8-5d8b-741f-8851-9fe0cd2ca483', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, descriptions_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flags_id, created_at, generated, mcp, active) VALUES ('b82f3d64-97f9-40fd-b963-368aff2f8e68', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, flags_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operations_id, created_at, active, generated, mcp) VALUES ('b82f3d64-97f9-40fd-b963-368aff2f8e68', '019d0000-0001-7000-8000-000000000003', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operations_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, names_id, created_at, generated, mcp, active) VALUES ('b82f3d64-97f9-40fd-b963-368aff2f8e68', '019c82b8-5d8b-739f-95a7-c3e81cd65611', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (tool_id, names_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('b82f3d64-97f9-40fd-b963-368aff2f8e68', 'eb52f323-b454-48c8-8385-69fad8f8388b', true, '2026-02-21T22:16:39.608062+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
