-- Module: Data Science and Artificial Intelligence Building
-- Category: field
-- Description: Data Science and Artificial Intelligence Building field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-77e2-858e-33ad3503b4c7', 'A specialized tech-focused lab environment in the basement of the Data Science/AI building.', '2025-08-12T12:52:10.014873+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:10.014873+00:00', true, false, false, '019bb25e-e5f8-7d66-9e5a-6094e4b77a60', 'Data Science and Artificial Intelligence Building', 'A specialized tech-focused lab environment in the basement of the Data Science/AI building.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a84-ba34-8774e06e2d19', 'Data Science and Artificial Intelligence Building', '2025-08-12T12:52:10.014873+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact

-- Junctions
-- field_departments_junction
-- field_descriptions_junction
-- field_fields_junction
-- field_flags_junction
-- field_names_junction
