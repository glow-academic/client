-- Module: Default Member
-- Category: profile
-- Description: Default Member base profile
-- ============================================================


-- Resource rows
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995b-cb82-774e-ae20-8bd47c373c00', 'Default Member', '2025-08-12T12:52:09.564220+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles_resource (last_login, created_at, role, active, generated, mcp, id, name, description, department_ids, cohort_ids, role_id, emails, primary_email, requests_per_day) VALUES ('2025-08-12T12:52:09.564220+00:00', '2025-08-12T12:52:09.564220+00:00', 'member', true, false, false, '019bb25e-e611-78ad-9fcf-3548045e6ef8', 'Default Member', NULL, '{}', '{019bb25e-e605-7500-8000-000000000001}', '019bf21d-4d50-7039-b5ba-4aea69013072', '{019c57ef-f302-7997-aa24-5e3381fb7b7d,019c5801-d006-7da3-b0b4-4a5e112a012e}', 'redacted@purdue.edu', NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- profile_artifact
INSERT INTO public.profile_artifact (updated_at, created_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.564220+00:00', '2025-08-12T12:52:09.564220+00:00', '019b3be4-36f0-7eb3-bc4e-bcab772edd92', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- profile_flags_junction
INSERT INTO public.profile_flags_junction (profile_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-36f0-7eb3-bc4e-bcab772edd92', '019be334-bfc5-7197-8f3e-c203790334de', false, '2025-08-12T12:52:09.564220+00:00', false, false, true) ON CONFLICT (profile_id, flag_id) DO NOTHING;
-- profile_names_junction
INSERT INTO public.profile_names_junction (profile_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-36f0-7eb3-bc4e-bcab772edd92', '019b995b-cb82-774e-ae20-8bd47c373c00', '2025-08-12T12:52:09.564220+00:00', false, false, true) ON CONFLICT (profile_id) DO NOTHING;
-- profile_profiles_junction
INSERT INTO public.profile_profiles_junction (profile_id, profiles_id, active, created_at, generated, mcp) VALUES ('019b3be4-36f0-7eb3-bc4e-bcab772edd92', '019bb25e-e611-78ad-9fcf-3548045e6ef8', true, '2025-08-12T12:52:09.564220+00:00', false, false) ON CONFLICT (profile_id, profiles_id) DO NOTHING;
-- profile_roles_junction
INSERT INTO public.profile_roles_junction (profile_id, role_id, created_at, generated, mcp, active) VALUES ('019b3be4-36f0-7eb3-bc4e-bcab772edd92', '019bf21d-4d50-74fc-8c81-be446d602de2', '2025-08-12T12:52:09.564220+00:00', false, false, true) ON CONFLICT (profile_id, role_id) DO NOTHING;
