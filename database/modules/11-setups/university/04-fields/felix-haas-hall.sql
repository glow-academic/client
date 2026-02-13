-- Module: Felix Haas Hall
-- Category: field
-- Description: Felix Haas Hall field
-- ============================================================


-- Resource rows
INSERT INTO public.departments_resource (created_at, active, generated, mcp, id, name, description, department_ids, setting_ids) VALUES ('2025-10-08T14:16:28.317660+00:00', true, false, false, '019bb25e-e624-73da-8cef-166028a1065a', 'Purdue CS', 'Innovative base of knowledge in the emerging field of computing', '{}', '{019bb25e-e615-7952-a7d4-4fdee85d18cc}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e9e-7864-89f5-5bc4289124ea', 'A quiet, focused study environment in the lower level of the HAAS building.', '2025-08-12T12:52:10.014873+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.fields_resource (created_at, active, generated, mcp, id, name, description, value, department_ids, conditional_parameter_ids) VALUES ('2025-08-12T12:52:10.014873+00:00', true, false, false, '019bb25e-e5f8-7dcd-8f4e-a986b0a7ebba', 'Felix Haas Hall', 'A quiet, focused study environment in the lower level of the HAAS building.', NULL, '{}', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e9b-7ab0-80e7-306cf7cb8505', 'Felix Haas Hall', '2025-08-12T12:52:10.014873+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- field_artifact
INSERT INTO public.field_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:10.014873+00:00', '2025-08-12T12:52:10.014873+00:00', '019b3be4-3255-7d73-8bb1-704b59eacfc7', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- field_departments_junction
INSERT INTO public.field_departments_junction (active, created_at, department_id, field_id, generated, mcp) VALUES (true, '2025-10-29T13:52:10.776500+00:00', '019bb25e-e624-73da-8cef-166028a1065a', '019b3be4-3255-7d73-8bb1-704b59eacfc7', false, false) ON CONFLICT (field_id, department_id) DO NOTHING;
-- field_descriptions_junction
INSERT INTO public.field_descriptions_junction (field_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d73-8bb1-704b59eacfc7', '019b995c-8e9e-7864-89f5-5bc4289124ea', '2025-08-12T12:52:10.014873+00:00', false, false, true) ON CONFLICT (field_id, description_id) DO NOTHING;
-- field_fields_junction
INSERT INTO public.field_fields_junction (field_id, fields_id, active, created_at, generated, mcp) VALUES ('019b3be4-3255-7d73-8bb1-704b59eacfc7', '019bb25e-e5f8-7dcd-8f4e-a986b0a7ebba', true, '2025-08-12T12:52:10.014873+00:00', false, false) ON CONFLICT (field_id, fields_id) DO NOTHING;
-- field_flags_junction
INSERT INTO public.field_flags_junction (field_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d73-8bb1-704b59eacfc7', '019be334-bfc4-7dd2-bcbd-93f1af18c233', true, '2025-08-12T12:52:10.014873+00:00', false, false, true) ON CONFLICT (field_id, flag_id) DO NOTHING;
-- field_names_junction
INSERT INTO public.field_names_junction (field_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3255-7d73-8bb1-704b59eacfc7', '019b995c-8e9b-7ab0-80e7-306cf7cb8505', '2025-08-12T12:52:10.014873+00:00', false, false, true) ON CONFLICT (field_id, name_id) DO NOTHING;
