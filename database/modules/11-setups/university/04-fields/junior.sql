-- Module: Junior
-- Category: field
-- Description: Junior field
-- ============================================================


-- Resource rows
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('dd000022-0001-0000-0000-000000000001', 'Junior', '2026-02-19T09:59:35.509148+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact

-- Junctions
-- field_fields_junction
-- field_names_junction
