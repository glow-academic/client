-- Module: General
-- Category: department (organization)
-- Description: General department
-- ============================================================


-- Resource rows
INSERT INTO public.departments_resource (created_at, active, generated, mcp, id, name, description, department_ids, setting_ids) VALUES ('2026-02-08T23:18:33.077464+00:00', true, false, false, '019c3f8c-b97f-70eb-86fb-4f3fae4902f8', 'General', 'General department', '{}', '{019c51c3-5130-734a-b5f4-c7e48130cc99}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c3f8c-b97c-723c-b96c-507c4959a807', 'General department', '2026-02-08T23:18:33.077464+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c3f8c-b97b-7bb8-8da7-d3b34193c013', 'General', '2026-02-08T23:18:33.077464+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- department_artifact
INSERT INTO public.department_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-08T23:18:33.077464+00:00', '2026-02-08T23:18:33.077464+00:00', '019c3f8c-b97b-7350-8d77-632e29b1c3f9', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- department_departments_junction
INSERT INTO public.department_departments_junction (department_id, departments_id, active, created_at, generated, mcp) VALUES ('019c3f8c-b97b-7350-8d77-632e29b1c3f9', '019c3f8c-b97f-70eb-86fb-4f3fae4902f8', true, '2026-02-08T23:18:33.077464+00:00', false, false) ON CONFLICT (department_id, departments_id) DO NOTHING;
-- department_descriptions_junction
INSERT INTO public.department_descriptions_junction (department_id, description_id, created_at, generated, mcp, active) VALUES ('019c3f8c-b97b-7350-8d77-632e29b1c3f9', '019c3f8c-b97c-723c-b96c-507c4959a807', '2026-02-08T23:18:33.077464+00:00', false, false, true) ON CONFLICT (department_id, description_id) DO NOTHING;
-- department_flags_junction
INSERT INTO public.department_flags_junction (department_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019c3f8c-b97b-7350-8d77-632e29b1c3f9', '019be334-bfc3-7c81-b7b6-de11e555da9d', true, '2026-02-08T23:18:33.077464+00:00', false, false, true) ON CONFLICT (department_id, flag_id) DO NOTHING;
-- department_names_junction
INSERT INTO public.department_names_junction (department_id, name_id, created_at, generated, mcp, active) VALUES ('019c3f8c-b97b-7350-8d77-632e29b1c3f9', '019c3f8c-b97b-7bb8-8da7-d3b34193c013', '2026-02-08T23:18:33.077464+00:00', false, false, true) ON CONFLICT (department_id, name_id) DO NOTHING;

-- Default profiles → General department (every profile needs ≥1 department)
-- profile_departments_junction
INSERT INTO public.profile_departments_junction (profile_id, department_id, is_primary, active, created_at, generated, mcp) VALUES ('019b3be4-36ef-7a5f-98ab-ccb879770be0', '019c3f8c-b97f-70eb-86fb-4f3fae4902f8', true, true, '2026-02-13T00:00:00+00:00', false, false) ON CONFLICT (profile_id, department_id) DO NOTHING;
INSERT INTO public.profile_departments_junction (profile_id, department_id, is_primary, active, created_at, generated, mcp) VALUES ('019bdb94-b2b6-7001-afd4-8dea58b2b22d', '019c3f8c-b97f-70eb-86fb-4f3fae4902f8', true, true, '2026-02-13T00:00:00+00:00', false, false) ON CONFLICT (profile_id, department_id) DO NOTHING;
INSERT INTO public.profile_departments_junction (profile_id, department_id, is_primary, active, created_at, generated, mcp) VALUES ('019b3be4-36f0-792c-82d6-126664ed18b6', '019c3f8c-b97f-70eb-86fb-4f3fae4902f8', true, true, '2026-02-13T00:00:00+00:00', false, false) ON CONFLICT (profile_id, department_id) DO NOTHING;
INSERT INTO public.profile_departments_junction (profile_id, department_id, is_primary, active, created_at, generated, mcp) VALUES ('019b3be4-36f0-785d-9d61-32eae65689ca', '019c3f8c-b97f-70eb-86fb-4f3fae4902f8', true, true, '2026-02-13T00:00:00+00:00', false, false) ON CONFLICT (profile_id, department_id) DO NOTHING;
INSERT INTO public.profile_departments_junction (profile_id, department_id, is_primary, active, created_at, generated, mcp) VALUES ('019b3be4-36f0-7eb3-bc4e-bcab772edd92', '019c3f8c-b97f-70eb-86fb-4f3fae4902f8', true, true, '2026-02-13T00:00:00+00:00', false, false) ON CONFLICT (profile_id, department_id) DO NOTHING;
INSERT INTO public.profile_departments_junction (profile_id, department_id, is_primary, active, created_at, generated, mcp) VALUES ('019b3be4-36f0-788c-9df2-481eb5917940', '019c3f8c-b97f-70eb-86fb-4f3fae4902f8', true, true, '2026-02-13T00:00:00+00:00', false, false) ON CONFLICT (profile_id, department_id) DO NOTHING;
