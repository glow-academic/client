-- Module: Default Admin
-- Category: profile
-- Description: Default Admin base profile
-- ============================================================


-- Resource rows
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995b-cb82-75d7-a98e-77ead2e72539', 'Default Admin', '2025-08-12T12:52:09.564220+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles_resource (last_login, created_at, role, active, generated, mcp, id, name, description, department_ids, role_id, emails, primary_email, requests_per_day) VALUES ('2025-08-12T12:52:09.564220+00:00', '2025-08-12T12:52:09.564220+00:00', 'admin', true, false, false, '019bb25e-e611-74f8-9a0c-eab4a6208857', 'Default Admin', NULL, '{}', '019bbabc-5a36-76d3-8fc3-8415fe308cd3', '{019c57ef-f302-703f-9448-d3ca0c41f316,019c5801-d006-7898-b044-cac8b2f6e0be}', 'redacted@purdue.edu', NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- profile_artifact
INSERT INTO public.profile_artifact (updated_at, created_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.564220+00:00', '2025-08-12T12:52:09.564220+00:00', '019b3be4-36ef-7a5f-98ab-ccb879770be0', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- profile_flags_junction
INSERT INTO public.profile_flags_junction (profile_id, flag_id, created_at, generated, mcp, active) VALUES ('019b3be4-36ef-7a5f-98ab-ccb879770be0', '019be334-bfc5-7197-8f3e-c203790334de', '2025-08-12T12:52:09.564220+00:00', false, false, true) ON CONFLICT (profile_id, flag_id) DO NOTHING;
-- profile_names_junction
INSERT INTO public.profile_names_junction (profile_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-36ef-7a5f-98ab-ccb879770be0', '019b995b-cb82-75d7-a98e-77ead2e72539', '2025-08-12T12:52:09.564220+00:00', false, false, true) ON CONFLICT (profile_id) DO NOTHING;
-- profile_profiles_junction
INSERT INTO public.profile_profiles_junction (profile_id, profiles_id, active, created_at, generated, mcp) VALUES ('019b3be4-36ef-7a5f-98ab-ccb879770be0', '019bb25e-e611-74f8-9a0c-eab4a6208857', true, '2025-08-12T12:52:09.564220+00:00', false, false) ON CONFLICT (profile_id, profiles_id) DO NOTHING;
-- profile_roles_junction
INSERT INTO public.profile_roles_junction (profile_id, role_id, created_at, generated, mcp, active) VALUES ('019b3be4-36ef-7a5f-98ab-ccb879770be0', '019bbabc-5a36-76d3-8fc3-8415fe308cd3', '2025-08-12T12:52:09.564220+00:00', false, false, true) ON CONFLICT (profile_id, role_id) DO NOTHING;
