-- Module: CS 373
-- Category: field
-- Description: CS 373 field
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-77cc-b961-4439f7e127c2', 'Introduction to machine learning algorithms, neural networks, feature engineering, model evaluation, and practical applications. Covers supervised and unsupervised learning techniques.', '2025-08-12T12:52:10.017187+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:10.017187+00:00', true, false, false, '019bb25e-e5f8-7d1e-8311-f9e7e06555e2', 'CS 373', 'Introduction to machine learning algorithms, neural networks, feature engineering, model evaluation, and practical applications. Covers supervised and unsupervised learning techniques.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a80-ac7f-f7aff45d47e8', 'CS 373', '2025-08-12T12:52:10.017187+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact

-- Junctions
-- field_departments_junction
-- field_descriptions_junction
-- field_fields_junction
-- field_flags_junction
-- field_names_junction
