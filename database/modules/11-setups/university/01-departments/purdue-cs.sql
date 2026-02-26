-- Module: University
-- Category: department (university)
-- Description: University department
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8eac-785c-b2f2-6fb4529330ce', 'Innovative base of knowledge in the emerging field of computing', '2025-10-08T14:16:28.317660+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8ea9-7b10-a229-070dd66dee55', 'University', '2025-10-08T14:16:28.317660+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- department_artifact
INSERT INTO public.department_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-08T14:16:28.317660+00:00', '2025-12-12T13:26:55.606271+00:00', '019b3be4-3247-7cb0-bd74-9b2467b5e32d', false, false) ON CONFLICT (id) DO NOTHING;

-- Denormalized resource
INSERT INTO public.departments_resource (id, name, description, setting_ids, department_ids, created_at, active, generated, mcp) VALUES ('019bb25e-e624-73da-8cef-166028a1065a', 'University', 'Innovative base of knowledge in the emerging field of computing', ARRAY['019bb25e-e615-7952-a7d4-4fdee85d18cc']::uuid[], ARRAY[]::uuid[], '2025-10-08T14:16:28.317660+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- department_departments_junction
INSERT INTO public.department_departments_junction (department_id, departments_id, active, created_at, generated, mcp) VALUES ('019b3be4-3247-7cb0-bd74-9b2467b5e32d', '019bb25e-e624-73da-8cef-166028a1065a', true, '2025-10-08T14:16:28.317660+00:00', false, false) ON CONFLICT (department_id, departments_id) DO NOTHING;
-- department_descriptions_junction
INSERT INTO public.department_descriptions_junction (department_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3247-7cb0-bd74-9b2467b5e32d', '019b995c-8eac-785c-b2f2-6fb4529330ce', '2025-10-08T14:16:28.317660+00:00', false, false, true) ON CONFLICT (department_id, description_id) DO NOTHING;
-- department_flags_junction
INSERT INTO public.department_flags_junction (department_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3247-7cb0-bd74-9b2467b5e32d', '019be334-bfc3-7c81-b7b6-de11e555da9d', true, '2025-10-08T14:16:28.317660+00:00', false, false, true) ON CONFLICT (department_id, flag_id) DO NOTHING;
-- department_names_junction
INSERT INTO public.department_names_junction (department_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3247-7cb0-bd74-9b2467b5e32d', '019b995c-8ea9-7b10-a229-070dd66dee55', '2025-10-08T14:16:28.317660+00:00', false, false, true) ON CONFLICT (department_id, name_id) DO NOTHING;
-- department_settings_junction (moved to settings file — FK needs settings_resource loaded first)
