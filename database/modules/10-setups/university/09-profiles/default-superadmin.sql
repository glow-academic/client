-- Module: Default Superadmin
-- Category: profile (university)
-- Description: Default Superadmin profile — university links
-- ============================================================

-- profile_departments_junction
INSERT INTO public.profile_departments_junction (is_primary, created_at, active, department_id, profile_id, generated, mcp) VALUES (false, '2026-02-13T16:57:49.051925+00:00', true, '019bb25e-e624-73da-8cef-166028a1065a', '019b3be4-36f0-788c-9df2-481eb5917940', false, false) ON CONFLICT (profile_id, department_id) DO NOTHING;
-- emails_resource
INSERT INTO public.emails_resource (id, email, created_at, active, generated, mcp) VALUES ('019c57ef-f302-7821-90c9-55c4556bfe92', 'redacted@purdue.edu', '2026-02-13T16:57:49.056138+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
-- profile_emails_junction
INSERT INTO public.profile_emails_junction (email, is_primary, active, created_at, profile_id, email_id, generated, mcp) VALUES ('redacted@purdue.edu', true, true, '2026-02-13T16:57:49.058920+00:00', '019b3be4-36f0-788c-9df2-481eb5917940', '019c57ef-f302-7821-90c9-55c4556bfe92', false, false) ON CONFLICT (profile_id, email_id) DO NOTHING;
-- cohorts_resource
INSERT INTO public.cohorts_resource (created_at, active, generated, mcp, id, name, description, department_ids, simulation_ids) VALUES ('2025-08-14T18:15:01.709000+00:00', true, false, false, '019bb25e-e605-7406-b985-0a3e9f95395c', 'First Time GTA''s', 'New-To-Purdue GTAs & First Time GTA (but may be a returning student)
2025-2026', '{}', '{019bb25e-e62c-77e2-b28d-23a973c68ebb,019bb25e-e62c-7863-8135-e591447d42e6}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.cohorts_resource (created_at, active, generated, mcp, id, name, description, department_ids, simulation_ids) VALUES ('2025-08-18T15:00:34.010000+00:00', false, false, false, '019bb25e-e605-7497-9ea7-9ab10588dcce', '[DEMO] TESTING SIMULATIONS', 'TO USE: Add the simulation you wish to test to this simulation.  DO NOT ADD STUDENTS.  The simulation will show up on your dashboard for you to test.
Remove any old simulations you don''t want to test at the same time. Grades for those simulations will remain in your history on "Home."', '{}', '{019bb25e-e62c-7872-b843-abe9462f94b3,019bb25e-e62c-78a0-a305-70daf72ee453,019bb25e-e62c-78ab-ae9f-76c6eafd5ca6}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.cohorts_resource (created_at, active, generated, mcp, id, name, description, department_ids, simulation_ids) VALUES ('2025-05-01T00:00:00+00:00', true, false, false, '019bb25e-e605-749f-a376-47857f500e1c', 'Returning GTAs', 'Returning GTAs
2025-2026
(Have been a GTA before)', '{}', '{019bb25e-e62c-7868-9c45-1c50c29ff8dc,019bb25e-e62c-786c-b16c-d435ce8d7ed6}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.cohorts_resource (created_at, active, generated, mcp, id, name, description, department_ids, simulation_ids) VALUES ('2026-02-03T02:23:35.540414+00:00', true, false, false, '019bb25e-e605-7500-8000-000000000001', 'Practice Cohort', NULL, '{}', '{019bb25e-e62c-78a4-a556-64cb01be3d92,019bb25e-e62c-789f-add0-0e4d307e952c,019bb25e-e62c-7899-81e2-c49cae2dbc50,019bb25e-e62c-78ae-9b5d-fa21cbd364d4,019bb25e-e62c-78b0-9cc1-39f25f8db3ef,019bb25e-e62c-7894-b18e-ddd3518cec67}') ON CONFLICT (id) DO NOTHING;
-- profile_cohorts_junction
INSERT INTO public.profile_cohorts_junction (profile_id, cohort_id, active, created_at, generated, mcp) VALUES ('019b3be4-36f0-788c-9df2-481eb5917940', '019bb25e-e605-7406-b985-0a3e9f95395c', true, '2025-10-17T21:29:29.988860+00:00', false, false) ON CONFLICT (profile_id, cohort_id) DO NOTHING;
INSERT INTO public.profile_cohorts_junction (profile_id, cohort_id, active, created_at, generated, mcp) VALUES ('019b3be4-36f0-788c-9df2-481eb5917940', '019bb25e-e605-7497-9ea7-9ab10588dcce', true, '2025-10-17T21:29:29.988860+00:00', false, false) ON CONFLICT (profile_id, cohort_id) DO NOTHING;
INSERT INTO public.profile_cohorts_junction (profile_id, cohort_id, active, created_at, generated, mcp) VALUES ('019b3be4-36f0-788c-9df2-481eb5917940', '019bb25e-e605-749f-a376-47857f500e1c', true, '2025-10-17T21:29:29.988860+00:00', false, false) ON CONFLICT (profile_id, cohort_id) DO NOTHING;
INSERT INTO public.profile_cohorts_junction (profile_id, cohort_id, active, created_at, generated, mcp) VALUES ('019b3be4-36f0-788c-9df2-481eb5917940', '019bb25e-e605-7500-8000-000000000001', true, '2026-02-03T02:23:35.540414+00:00', false, false) ON CONFLICT (profile_id, cohort_id) DO NOTHING;
