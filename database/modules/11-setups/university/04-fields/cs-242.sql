-- Module: CS 242
-- Category: field
-- Description: CS 242 field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-77e9-8557-675f9ce6c035', 'Data Science', '2025-08-12T16:55:05.182021+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T16:55:05.182021+00:00', true, false, false, '019bb25e-e5f8-7d2a-90de-10226a471e6b', 'CS 242', 'Data Science', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7af6-9188-727687af665c', 'CS 242', '2025-08-12T16:55:05.182021+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact

-- Junctions
-- field_departments_junction
-- field_descriptions_junction
-- field_fields_junction
-- field_flags_junction
-- field_names_junction
