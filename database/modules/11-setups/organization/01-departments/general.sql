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
-- department_settings_junction
INSERT INTO public.department_settings_junction (active, created_at, department_id, settings_id, generated, mcp) VALUES (true, '2026-02-25T22:07:55.636235+00:00', '019c3f8c-b97b-7350-8d77-632e29b1c3f9', '019c51c3-5130-734a-b5f4-c7e48130cc99', false, false) ON CONFLICT (department_id, settings_id) DO NOTHING;
