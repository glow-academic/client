-- Module: Default Guest
-- Category: profile
-- Description: Default Guest base profile
-- ============================================================


-- Resource rows
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995b-cb82-777d-af04-d80af5048021', 'Default Guest', '2025-08-12T12:52:09.564220+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles_resource (last_login, created_at, role, active, generated, mcp, id, name, description, department_ids, cohort_ids, role_id, emails, primary_email, requests_per_day) VALUES ('2025-08-12T12:52:09.564220+00:00', '2025-08-12T12:52:09.564220+00:00', 'guest', true, false, false, '019bb25e-e611-78ab-b453-5c7720d87aec', 'Default Guest', NULL, '{}', '{019bb25e-e605-7500-8000-000000000001}', '019bbabc-5a37-7028-8b98-728b7aa54d0d', '{019c57ef-f302-787e-b140-15f193cc887d,019c5801-d006-7d59-ad92-0d98a5c02a51}', 'redacted@purdue.edu', NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- profile_artifact
INSERT INTO public.profile_artifact (updated_at, created_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.564220+00:00', '2025-08-12T12:52:09.564220+00:00', '019b3be4-36f0-792c-82d6-126664ed18b6', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- profile_flags_junction
INSERT INTO public.profile_flags_junction (profile_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-36f0-792c-82d6-126664ed18b6', '019be334-bfc5-7197-8f3e-c203790334de', false, '2025-08-12T12:52:09.564220+00:00', false, false, true) ON CONFLICT (profile_id, flag_id) DO NOTHING;
-- profile_names_junction
INSERT INTO public.profile_names_junction (profile_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-36f0-792c-82d6-126664ed18b6', '019b995b-cb82-777d-af04-d80af5048021', '2025-08-12T12:52:09.564220+00:00', false, false, true) ON CONFLICT (profile_id) DO NOTHING;
-- profile_profiles_junction
INSERT INTO public.profile_profiles_junction (profile_id, profiles_id, active, created_at, generated, mcp) VALUES ('019b3be4-36f0-792c-82d6-126664ed18b6', '019bb25e-e611-78ab-b453-5c7720d87aec', true, '2025-08-12T12:52:09.564220+00:00', false, false) ON CONFLICT (profile_id, profiles_id) DO NOTHING;
-- profile_request_limits_junction
INSERT INTO public.profile_request_limits_junction (requests_per_day, active, created_at, profile_id, request_limit_id, generated, mcp) VALUES (10, true, '2025-08-12T12:52:09.564220+00:00', '019b3be4-36f0-792c-82d6-126664ed18b6', '019bb553-e77f-797c-ae44-544fbe10351b', false, false);
-- profile_roles_junction
INSERT INTO public.profile_roles_junction (profile_id, role_id, created_at, generated, mcp, active) VALUES ('019b3be4-36f0-792c-82d6-126664ed18b6', '019bbabc-5a37-7028-8b98-728b7aa54d0d', '2025-08-12T12:52:09.564220+00:00', false, false, true) ON CONFLICT (profile_id, role_id) DO NOTHING;
