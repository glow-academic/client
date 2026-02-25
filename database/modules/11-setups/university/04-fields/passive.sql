-- Module: passive
-- Category: field
-- Description: passive field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7836-a6e1-2a7c0c7761b7', 'Low engagement and tendency to avoid conflict or assertiveness', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-12-12T13:26:55.660542+00:00', true, false, false, '019bb25e-e5f8-7de3-be92-08efc9770684', 'passive', 'Low engagement and tendency to avoid conflict or assertiveness', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7b0a-8349-1bc84b5ae7ab', 'passive', '2025-12-12T13:26:55.660542+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact

-- Junctions
-- field_descriptions_junction
-- field_fields_junction
-- field_flags_junction
-- field_names_junction
