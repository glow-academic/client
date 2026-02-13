-- Module: Purdue CS
-- Category: department (university)
-- Description: Purdue CS department
-- ============================================================


-- Resource rows
INSERT INTO public.departments_resource (created_at, active, generated, mcp, id, name, description, department_ids, setting_ids) VALUES ('2025-10-08T14:16:28.317660+00:00', true, false, false, '019bb25e-e624-73da-8cef-166028a1065a', 'Purdue CS', 'Innovative base of knowledge in the emerging field of computing', '{}', '{019bb25e-e615-7952-a7d4-4fdee85d18cc}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8eac-785c-b2f2-6fb4529330ce', 'Innovative base of knowledge in the emerging field of computing', '2025-10-08T14:16:28.317660+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8ea9-7b10-a229-070dd66dee55', 'Purdue CS', '2025-10-08T14:16:28.317660+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.settings_resource (created_at, active, generated, mcp, id, name, description, department_ids, agent_ids, provider_key_ids, auth_ids) VALUES ('2025-12-12T13:26:55.664826+00:00', true, false, false, '019bb25e-e615-7952-a7d4-4fdee85d18cc', 'Purdue CS Settings', 'Department-specific settings for Purdue CS', '{}', '{}', '{}', '{019bb25e-e5e2-74c2-aaf3-42c5403f26f9}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- department_artifact
INSERT INTO public.department_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-10-08T14:16:28.317660+00:00', '2025-12-12T13:26:55.606271+00:00', '019b3be4-3247-7cb0-bd74-9b2467b5e32d', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- department_departments_junction
INSERT INTO public.department_departments_junction (department_id, departments_id, active, created_at, generated, mcp) VALUES ('019b3be4-3247-7cb0-bd74-9b2467b5e32d', '019bb25e-e624-73da-8cef-166028a1065a', true, '2025-10-08T14:16:28.317660+00:00', false, false) ON CONFLICT (department_id, departments_id) DO NOTHING;
-- department_descriptions_junction
INSERT INTO public.department_descriptions_junction (department_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3247-7cb0-bd74-9b2467b5e32d', '019b995c-8eac-785c-b2f2-6fb4529330ce', '2025-10-08T14:16:28.317660+00:00', false, false, true) ON CONFLICT (department_id, description_id) DO NOTHING;
-- department_flags_junction
INSERT INTO public.department_flags_junction (department_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3247-7cb0-bd74-9b2467b5e32d', '019be334-bfc3-7c81-b7b6-de11e555da9d', true, '2025-10-08T14:16:28.317660+00:00', false, false, true) ON CONFLICT (department_id, flag_id) DO NOTHING;
-- department_names_junction
INSERT INTO public.department_names_junction (department_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3247-7cb0-bd74-9b2467b5e32d', '019b995c-8ea9-7b10-a229-070dd66dee55', '2025-10-08T14:16:28.317660+00:00', false, false, true) ON CONFLICT (department_id, name_id) DO NOTHING;
-- department_settings_junction
INSERT INTO public.department_settings_junction (active, created_at, department_id, settings_id, generated, mcp) VALUES (true, '2025-12-12T13:26:55.664826+00:00', '019b3be4-3247-7cb0-bd74-9b2467b5e32d', '019bb25e-e615-7952-a7d4-4fdee85d18cc', false, false) ON CONFLICT (department_id, settings_id) DO NOTHING;

-- Default profiles → Purdue CS department (every profile needs ≥1 department)
-- profile_departments_junction
INSERT INTO public.profile_departments_junction (profile_id, department_id, is_primary, active, created_at, generated, mcp) VALUES ('019b3be4-36ef-7a5f-98ab-ccb879770be0', '019bb25e-e624-73da-8cef-166028a1065a', false, true, '2026-02-13T00:00:00+00:00', false, false) ON CONFLICT (profile_id, department_id) DO NOTHING;
INSERT INTO public.profile_departments_junction (profile_id, department_id, is_primary, active, created_at, generated, mcp) VALUES ('019bdb94-b2b6-7001-afd4-8dea58b2b22d', '019bb25e-e624-73da-8cef-166028a1065a', false, true, '2026-02-13T00:00:00+00:00', false, false) ON CONFLICT (profile_id, department_id) DO NOTHING;
INSERT INTO public.profile_departments_junction (profile_id, department_id, is_primary, active, created_at, generated, mcp) VALUES ('019b3be4-36f0-792c-82d6-126664ed18b6', '019bb25e-e624-73da-8cef-166028a1065a', false, true, '2026-02-13T00:00:00+00:00', false, false) ON CONFLICT (profile_id, department_id) DO NOTHING;
INSERT INTO public.profile_departments_junction (profile_id, department_id, is_primary, active, created_at, generated, mcp) VALUES ('019b3be4-36f0-785d-9d61-32eae65689ca', '019bb25e-e624-73da-8cef-166028a1065a', false, true, '2026-02-13T00:00:00+00:00', false, false) ON CONFLICT (profile_id, department_id) DO NOTHING;
INSERT INTO public.profile_departments_junction (profile_id, department_id, is_primary, active, created_at, generated, mcp) VALUES ('019b3be4-36f0-7eb3-bc4e-bcab772edd92', '019bb25e-e624-73da-8cef-166028a1065a', false, true, '2026-02-13T00:00:00+00:00', false, false) ON CONFLICT (profile_id, department_id) DO NOTHING;
INSERT INTO public.profile_departments_junction (profile_id, department_id, is_primary, active, created_at, generated, mcp) VALUES ('019b3be4-36f0-788c-9df2-481eb5917940', '019bb25e-e624-73da-8cef-166028a1065a', false, true, '2026-02-13T00:00:00+00:00', false, false) ON CONFLICT (profile_id, department_id) DO NOTHING;
