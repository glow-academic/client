-- Module: Defensive
-- Category: persona
-- Description: Defensive persona
-- ============================================================


-- Resource rows
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('dd000012-0001-0000-0000-000000000003', 'Defensive', '2026-02-19T09:59:35.509148+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- persona_artifact
INSERT INTO public.persona_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-19T09:59:35.509148+00:00', '2026-02-19T09:59:35.509148+00:00', 'dd000011-0001-0000-0000-000000000003', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- persona_departments_junction
-- persona_names_junction
INSERT INTO public.persona_names_junction (persona_id, names_id, created_at, generated, mcp, active) VALUES ('dd000011-0001-0000-0000-000000000003', 'dd000012-0001-0000-0000-000000000003', '2026-02-19T09:59:35.509148+00:00', false, false, true) ON CONFLICT (persona_id, names_id) DO NOTHING;
-- persona_personas_junction
