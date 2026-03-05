-- Module: Default Instructional
-- Category: profile
-- Description: Default Instructional base profile
-- ============================================================


-- Resource rows
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995b-cb82-743e-972c-dfa2feb7c458', 'Default Instructional', '2025-08-12T12:52:09.564220+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles_resource (last_login, created_at, role, active, generated, mcp, id, name, description, department_ids, role_id, emails, primary_email, requests_per_day) VALUES ('2025-08-12T12:52:09.564220+00:00', '2025-08-12T12:52:09.564220+00:00', 'instructional', true, false, false, '019bb25e-e611-7777-8c35-3dfafd3e87e4', 'Default Instructional', NULL, '{}', '019bbabc-5a3b-741e-bad3-474cc6c05fd6', '{019c57ef-f302-77c7-9d8b-77047838df8e,019c5801-d006-7ca6-9f37-6d7d44d4c216}', 'redacted@purdue.edu', NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- profile_artifact
INSERT INTO public.profile_artifact (updated_at, created_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.564220+00:00', '2025-08-12T12:52:09.564220+00:00', '019b3be4-36f0-785d-9d61-32eae65689ca', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- profile_flags_junction
INSERT INTO public.profile_flags_junction (profile_id, flag_id, created_at, generated, mcp, active) VALUES ('019b3be4-36f0-785d-9d61-32eae65689ca', '019be334-bfc5-7197-8f3e-c203790334de', '2025-08-12T12:52:09.564220+00:00', false, false, true) ON CONFLICT (profile_id, flag_id) DO NOTHING;
-- profile_names_junction
INSERT INTO public.profile_names_junction (profile_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-36f0-785d-9d61-32eae65689ca', '019b995b-cb82-743e-972c-dfa2feb7c458', '2025-08-12T12:52:09.564220+00:00', false, false, true) ON CONFLICT (profile_id) DO NOTHING;
-- profile_profiles_junction
INSERT INTO public.profile_profiles_junction (profile_id, profiles_id, active, created_at, generated, mcp) VALUES ('019b3be4-36f0-785d-9d61-32eae65689ca', '019bb25e-e611-7777-8c35-3dfafd3e87e4', true, '2025-08-12T12:52:09.564220+00:00', false, false) ON CONFLICT (profile_id, profiles_id) DO NOTHING;
-- profile_roles_junction
INSERT INTO public.profile_roles_junction (profile_id, role_id, created_at, generated, mcp, active) VALUES ('019b3be4-36f0-785d-9d61-32eae65689ca', '019bbabc-5a3b-741e-bad3-474cc6c05fd6', '2025-08-12T12:52:09.564220+00:00', false, false, true) ON CONFLICT (profile_id, role_id) DO NOTHING;
