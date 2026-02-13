-- Module: CS 373
-- Category: field
-- Description: CS 373 field
-- ============================================================


-- Resource rows
INSERT INTO public.departments_resource (created_at, active, generated, mcp, id, name, description, department_ids, setting_ids) VALUES ('2025-10-08T14:16:28.317660+00:00', true, false, false, '019bb25e-e624-73da-8cef-166028a1065a', 'Purdue CS', 'Innovative base of knowledge in the emerging field of computing', '{}', '{019bb25e-e615-7952-a7d4-4fdee85d18cc}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-77cc-b961-4439f7e127c2', 'Introduction to machine learning algorithms, neural networks, feature engineering, model evaluation, and practical applications. Covers supervised and unsupervised learning techniques.', '2025-08-12T12:52:10.017187+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:10.017187+00:00', true, false, false, '019bb25e-e5f8-7d1e-8311-f9e7e06555e2', 'CS 373', 'Introduction to machine learning algorithms, neural networks, feature engineering, model evaluation, and practical applications. Covers supervised and unsupervised learning techniques.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7a80-ac7f-f7aff45d47e8', 'CS 373', '2025-08-12T12:52:10.017187+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:10.017187+00:00', '2025-08-12T12:52:10.017187+00:00', '019b3be4-3255-7db2-893f-520fa192c854', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-29T13:52:10.776500+00:00', '019bb25e-e624-73da-8cef-166028a1065a', '019b3be4-3255-7db2-893f-520fa192c854', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7db2-893f-520fa192c854', '019b995c-8e9e-77cc-b961-4439f7e127c2', '2025-08-12T12:52:10.017187+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7db2-893f-520fa192c854', '019bb25e-e5f8-7d1e-8311-f9e7e06555e2', true, '2025-08-12T12:52:10.017187+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7db2-893f-520fa192c854', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:10.017187+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7db2-893f-520fa192c854', '019b995c-8e9b-7a80-ac7f-f7aff45d47e8', '2025-08-12T12:52:10.017187+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
