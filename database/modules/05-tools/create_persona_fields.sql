-- Module: create_persona_fields
-- Category: tool
-- Description: create_persona_fields MCP tool
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bf207-ca45-7ac5-9a3a-e16046a16eb2', 'Create a persona field resource for linking persona-type parameter fields to scenarios', '2026-01-24T22:02:35.441799+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bf207-ca33-73b2-9ad0-8eccbb02e690', 'create_persona_fields', '2026-01-24T22:02:35.441799+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('019bf207-ca4b-7fcd-8c58-15d372105878', '2026-01-24T22:02:35.441799+00:00', false, false, true, 'create_persona_fields', 'Create a persona field resource for linking persona-type parameter fields to scenarios', '{}', 'create', '{}', '{}', '{}'::text[], '{}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- tool_artifact
INSERT INTO public.tool_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bf207-ca32-790d-921f-005560cc0942', '2026-01-24T22:02:35.441799+00:00', '2026-01-24T22:02:35.441799+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- tool_descriptions_junction
INSERT INTO public.tool_descriptions_junction (tool_id, description_id, created_at, generated, mcp, active) VALUES ('019bf207-ca32-790d-921f-005560cc0942', '019bf207-ca45-7ac5-9a3a-e16046a16eb2', '2026-01-24T22:02:35.441799+00:00', false, false, true) ON CONFLICT (tool_id, description_id) DO NOTHING;
-- tool_flags_junction
INSERT INTO public.tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active) VALUES ('019bf207-ca32-790d-921f-005560cc0942', '019be334-bfc6-74fb-be11-ea6b522945bb', '2026-01-24T22:02:35.441799+00:00', false, false, true) ON CONFLICT (tool_id, flag_id) DO NOTHING;
-- tool_operations_junction
INSERT INTO public.tool_operations_junction (tool_id, operation_id, created_at, active, generated, mcp) VALUES ('019bf207-ca32-790d-921f-005560cc0942', '019d0000-0001-7000-8000-000000000002', '2026-02-27T00:00:00.000000+00:00', true, false, false) ON CONFLICT (tool_id, operation_id) DO NOTHING;
-- tool_names_junction
INSERT INTO public.tool_names_junction (tool_id, name_id, created_at, generated, mcp, active) VALUES ('019bf207-ca32-790d-921f-005560cc0942', '019bf207-ca33-73b2-9ad0-8eccbb02e690', '2026-01-24T22:02:35.441799+00:00', false, false, true) ON CONFLICT (tool_id, name_id) DO NOTHING;
-- tool_tools_junction
INSERT INTO public.tool_tools_junction (tool_id, tools_id, active, created_at, generated, mcp) VALUES ('019bf207-ca32-790d-921f-005560cc0942', '019bf207-ca4b-7fcd-8c58-15d372105878', '2026-01-24T22:02:35.441799+00:00', false, false) ON CONFLICT (tool_id, tools_id) DO NOTHING;
