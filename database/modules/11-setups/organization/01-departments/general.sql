-- Module: Organization
-- Category: department (organization)
-- Description: Organization department
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c3f8c-b97c-723c-b96c-507c4959a807', 'Organization department', '2026-02-08T23:18:33.077464+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c3f8c-b97b-7bb8-8da7-d3b34193c013', 'Organization', '2026-02-08T23:18:33.077464+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- department_artifact
INSERT INTO public.department_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-08T23:18:33.077464+00:00', '2026-02-08T23:18:33.077464+00:00', '019c3f8c-b97b-7350-8d77-632e29b1c3f9', false, false) ON CONFLICT (id) DO NOTHING;

-- Denormalized resource
INSERT INTO public.departments_resource (id, name, description, setting_ids, department_ids, created_at, active, generated, mcp) VALUES ('019c3f8c-b97f-70eb-86fb-4f3fae4902f8', 'Organization', 'Organization department', ARRAY['019c51c3-5130-734a-b5f4-c7e48130cc99']::uuid[], ARRAY[]::uuid[], '2026-02-08T23:18:33.077464+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- department_departments_junction
INSERT INTO public.department_departments_junction (department_id, departments_id, active, created_at, generated, mcp) VALUES ('019c3f8c-b97b-7350-8d77-632e29b1c3f9', '019c3f8c-b97f-70eb-86fb-4f3fae4902f8', '2026-02-08T23:18:33.077464+00:00', false, false) ON CONFLICT (department_id, departments_id) DO NOTHING;
-- department_descriptions_junction
INSERT INTO public.department_descriptions_junction (department_id, description_id, created_at, generated, mcp, active) VALUES ('019c3f8c-b97b-7350-8d77-632e29b1c3f9', '019c3f8c-b97c-723c-b96c-507c4959a807', '2026-02-08T23:18:33.077464+00:00', false, false, true) ON CONFLICT (department_id, description_id) DO NOTHING;
-- department_flags_junction
INSERT INTO public.department_flags_junction (department_id, flag_id, created_at, generated, mcp, active) VALUES ('019c3f8c-b97b-7350-8d77-632e29b1c3f9', '019be334-bfc3-7c81-b7b6-de11e555da9d', '2026-02-08T23:18:33.077464+00:00', false, false, true) ON CONFLICT (department_id, flag_id) DO NOTHING;
-- department_names_junction
INSERT INTO public.department_names_junction (department_id, name_id, created_at, generated, mcp, active) VALUES ('019c3f8c-b97b-7350-8d77-632e29b1c3f9', '019c3f8c-b97b-7bb8-8da7-d3b34193c013', '2026-02-08T23:18:33.077464+00:00', false, false, true) ON CONFLICT (department_id, name_id) DO NOTHING;
-- department_settings_junction (moved to settings file — FK needs settings_resource loaded first)
