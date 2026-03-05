-- Module: Default Superadmin
-- Category: profile
-- Description: Default Superadmin base profile
-- ============================================================


-- Resource rows
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995b-cb82-7434-8aa6-307286f97f19', 'Default Superadmin', '2025-08-12T12:52:09.564220+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles_resource (last_login, created_at, role, active, generated, mcp, id, name, description, department_ids, role_id, emails, primary_email, requests_per_day) VALUES ('2025-08-12T12:52:09.564220+00:00', '2025-08-12T12:52:09.564220+00:00', 'superadmin', true, false, false, '019bb25e-e611-7785-8858-989402fb8992', 'Default Superadmin', NULL, '{}', '019bbabc-5a3b-7481-bbf5-a7c2193bc5e4', '{019c57ef-f302-7821-90c9-55c4556bfe92,019c5801-d006-7d01-aee1-d82c2b03eb52}', 'redacted@purdue.edu', NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- profile_artifact
INSERT INTO public.profile_artifact (updated_at, created_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.564220+00:00', '2025-08-12T12:52:09.564220+00:00', '019b3be4-36f0-788c-9df2-481eb5917940', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- profile_flags_junction
INSERT INTO public.profile_flags_junction (profile_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-36f0-788c-9df2-481eb5917940', '019be334-bfc5-7197-8f3e-c203790334de', '2025-08-12T12:52:09.564220+00:00', false, false, true) ON CONFLICT (profile_id, flags_id) DO NOTHING;
-- profile_names_junction
INSERT INTO public.profile_names_junction (profile_id, names_id, created_at, generated, mcp, active) VALUES ('019b3be4-36f0-788c-9df2-481eb5917940', '019b995b-cb82-7434-8aa6-307286f97f19', '2025-08-12T12:52:09.564220+00:00', false, false, true) ON CONFLICT (profile_id) DO NOTHING;
-- profile_profiles_junction
INSERT INTO public.profile_profiles_junction (profile_id, profiles_id, active, created_at, generated, mcp) VALUES ('019b3be4-36f0-788c-9df2-481eb5917940', '019bb25e-e611-7785-8858-989402fb8992', true, '2025-08-12T12:52:09.564220+00:00', false, false) ON CONFLICT (profile_id, profiles_id) DO NOTHING;
-- profile_roles_junction
INSERT INTO public.profile_roles_junction (profile_id, roles_id, created_at, generated, mcp, active) VALUES ('019b3be4-36f0-788c-9df2-481eb5917940', '019bbabc-5a3b-7481-bbf5-a7c2193bc5e4', '2025-08-12T12:52:09.564220+00:00', false, false, true) ON CONFLICT (profile_id, roles_id) DO NOTHING;
