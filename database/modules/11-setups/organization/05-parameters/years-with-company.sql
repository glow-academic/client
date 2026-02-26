-- Module: Years with Company
-- Category: parameter
-- Description: Years with Company parameter
-- ============================================================


-- Resource rows
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('dd000025-0001-0000-0000-000000000002', 'Years with Company', '2026-02-19T09:59:35.509148+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- parameter_artifact
INSERT INTO public.parameter_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-19T09:59:35.509148+00:00', '2026-02-19T09:59:35.509148+00:00', 'dd000024-0001-0000-0000-000000000002', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- parameter_fields_junction
-- parameter_names_junction
INSERT INTO public.parameter_names_junction (parameter_id, name_id, created_at, generated, mcp, active) VALUES ('dd000024-0001-0000-0000-000000000002', 'dd000025-0001-0000-0000-000000000002', '2026-02-19T09:59:35.509148+00:00', false, false, true) ON CONFLICT (parameter_id, name_id) DO NOTHING;
-- parameter_parameters_junction
