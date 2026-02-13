-- Module: Default Member
-- Category: profile
-- Description: Default Member base profile
-- ============================================================


-- Resource rows
INSERT INTO public.cohorts_resource (created_at, active, generated, mcp, id, name, description, department_ids, simulation_ids) VALUES ('2026-02-03T02:23:35.540414+00:00', true, false, false, '019bb25e-e605-7500-8000-000000000001', 'Practice Cohort', NULL, '{}', '{019bb25e-e62c-78a4-a556-64cb01be3d92,019bb25e-e62c-789f-add0-0e4d307e952c,019bb25e-e62c-7899-81e2-c49cae2dbc50,019bb25e-e62c-78ae-9b5d-fa21cbd364d4,019bb25e-e62c-78b0-9cc1-39f25f8db3ef,019bb25e-e62c-7894-b18e-ddd3518cec67}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995b-cb82-774e-ae20-8bd47c373c00', 'Default Member', '2025-08-12T12:52:09.564220+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles_resource (last_login, created_at, role, active, generated, mcp, id, name, description, department_ids, cohort_ids, role_id) VALUES ('2025-08-12T12:52:09.564220+00:00', '2025-08-12T12:52:09.564220+00:00', 'member', true, false, false, '019bb25e-e611-78ad-9fcf-3548045e6ef8', 'Default Member', NULL, '{}', '{019bb25e-e605-7500-8000-000000000001}', '019bf21d-4d50-7039-b5ba-4aea69013072') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- profile_artifact
INSERT INTO public.profile_artifact (updated_at, created_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.564220+00:00', '2025-08-12T12:52:09.564220+00:00', '019b3be4-36f0-7eb3-bc4e-bcab772edd92', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- profile_cohorts_junction
INSERT INTO public.profile_cohorts_junction (profile_id, cohort_id, active, created_at, generated, mcp) VALUES ('019b3be4-36f0-7eb3-bc4e-bcab772edd92', '019bb25e-e605-7500-8000-000000000001', true, '2026-02-03T02:23:35.540414+00:00', false, false) ON CONFLICT (profile_id, cohort_id) DO NOTHING;
-- profile_flags_junction
INSERT INTO public.profile_flags_junction (profile_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-36f0-7eb3-bc4e-bcab772edd92', '019be334-bfc5-7197-8f3e-c203790334de', false, '2025-08-12T12:52:09.564220+00:00', false, false, true) ON CONFLICT (profile_id, flag_id) DO NOTHING;
-- profile_names_junction
INSERT INTO public.profile_names_junction (profile_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-36f0-7eb3-bc4e-bcab772edd92', '019b995b-cb82-774e-ae20-8bd47c373c00', '2025-08-12T12:52:09.564220+00:00', false, false, true) ON CONFLICT (profile_id) DO NOTHING;
-- profile_profiles_junction
INSERT INTO public.profile_profiles_junction (profile_id, profiles_id, active, created_at, generated, mcp) VALUES ('019b3be4-36f0-7eb3-bc4e-bcab772edd92', '019bb25e-e611-78ad-9fcf-3548045e6ef8', true, '2025-08-12T12:52:09.564220+00:00', false, false) ON CONFLICT (profile_id, profiles_id) DO NOTHING;
-- profile_roles_junction
INSERT INTO public.profile_roles_junction (profile_id, role_id, created_at, generated, mcp, active) VALUES ('019b3be4-36f0-7eb3-bc4e-bcab772edd92', '019bf21d-4d50-74fc-8c81-be446d602de2', '2025-08-12T12:52:09.564220+00:00', false, false, true) ON CONFLICT (profile_id, role_id) DO NOTHING;
-- profile_routes_junction
INSERT INTO public.profile_routes_junction (profile_id, route_id, active, created_at, generated, mcp) VALUES ('019b3be4-36f0-7eb3-bc4e-bcab772edd92', '019bdb94-b289-714c-9ca7-dc795902296b', true, '2026-01-20T13:25:13.995928+00:00', false, false) ON CONFLICT (profile_id, route_id) DO NOTHING;
INSERT INTO public.profile_routes_junction (profile_id, route_id, active, created_at, generated, mcp) VALUES ('019b3be4-36f0-7eb3-bc4e-bcab772edd92', '019bdb94-b289-7680-9f8a-289ff96a8ef2', true, '2026-01-20T13:25:13.995928+00:00', false, false) ON CONFLICT (profile_id, route_id) DO NOTHING;
INSERT INTO public.profile_routes_junction (profile_id, route_id, active, created_at, generated, mcp) VALUES ('019b3be4-36f0-7eb3-bc4e-bcab772edd92', '019bdb94-b289-76a2-bab2-530e5dea8f31', true, '2026-01-20T13:25:13.995928+00:00', false, false) ON CONFLICT (profile_id, route_id) DO NOTHING;
INSERT INTO public.profile_routes_junction (profile_id, route_id, active, created_at, generated, mcp) VALUES ('019b3be4-36f0-7eb3-bc4e-bcab772edd92', '019bdb94-b289-76b5-8d16-207da33a8b79', true, '2026-01-20T13:25:13.995928+00:00', false, false) ON CONFLICT (profile_id, route_id) DO NOTHING;
INSERT INTO public.profile_routes_junction (profile_id, route_id, active, created_at, generated, mcp) VALUES ('019b3be4-36f0-7eb3-bc4e-bcab772edd92', '019bdb94-b289-7741-a4c7-f47f8000212f', true, '2026-01-20T13:25:13.995928+00:00', false, false) ON CONFLICT (profile_id, route_id) DO NOTHING;
