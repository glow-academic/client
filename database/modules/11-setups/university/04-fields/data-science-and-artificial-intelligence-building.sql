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
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:10.014873+00:00', '2025-08-12T12:52:10.014873+00:00', '019b3be4-3255-7d7b-a2d4-6c5f8599c654', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-29T13:52:10.776500+00:00', '019bb25e-e624-73da-8cef-166028a1065a', '019b3be4-3255-7d7b-a2d4-6c5f8599c654', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d7b-a2d4-6c5f8599c654', '019b995c-8e9e-77e2-858e-33ad3503b4c7', '2025-08-12T12:52:10.014873+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7d7b-a2d4-6c5f8599c654', '019bb25e-e5f8-7d66-9e5a-6094e4b77a60', true, '2025-08-12T12:52:10.014873+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d7b-a2d4-6c5f8599c654', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:10.014873+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d7b-a2d4-6c5f8599c654', '019b995c-8e9b-7a84-ba34-8774e06e2d19', '2025-08-12T12:52:10.014873+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
