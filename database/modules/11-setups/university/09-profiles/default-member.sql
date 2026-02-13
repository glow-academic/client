-- Module: Default Member
-- Category: profile (university)
-- Description: Default Member profile — university links
-- ============================================================

-- profile_departments_junction
INSERT INTO public.profile_departments_junction (is_primary, created_at, active, department_id, profile_id, generated, mcp) VALUES (false, '2026-02-13T16:57:49.051925+00:00', true, '019bb25e-e624-73da-8cef-166028a1065a', '019b3be4-36f0-7eb3-bc4e-bcab772edd92', false, false) ON CONFLICT (profile_id, department_id) DO NOTHING;
-- emails_resource
INSERT INTO public.emails_resource (id, email, created_at, active, generated, mcp) VALUES ('019c57ef-f302-7997-aa24-5e3381fb7b7d', 'redacted@purdue.edu', '2026-02-13T16:57:49.056138+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
-- profile_emails_junction
INSERT INTO public.profile_emails_junction (email, is_primary, active, created_at, profile_id, email_id, generated, mcp) VALUES ('redacted@purdue.edu', true, true, '2026-02-13T16:57:49.058920+00:00', '019b3be4-36f0-7eb3-bc4e-bcab772edd92', '019c57ef-f302-7997-aa24-5e3381fb7b7d', false, false) ON CONFLICT (profile_id, email_id) DO NOTHING;
-- cohorts_resource
INSERT INTO public.cohorts_resource (created_at, active, generated, mcp, id, name, description, department_ids, simulation_ids) VALUES ('2026-02-03T02:23:35.540414+00:00', true, false, false, '019bb25e-e605-7500-8000-000000000001', 'Practice Cohort', NULL, '{}', '{019bb25e-e62c-78a4-a556-64cb01be3d92,019bb25e-e62c-789f-add0-0e4d307e952c,019bb25e-e62c-7899-81e2-c49cae2dbc50,019bb25e-e62c-78ae-9b5d-fa21cbd364d4,019bb25e-e62c-78b0-9cc1-39f25f8db3ef,019bb25e-e62c-7894-b18e-ddd3518cec67}') ON CONFLICT (id) DO NOTHING;
-- profile_cohorts_junction
INSERT INTO public.profile_cohorts_junction (profile_id, cohort_id, active, created_at, generated, mcp) VALUES ('019b3be4-36f0-7eb3-bc4e-bcab772edd92', '019bb25e-e605-7500-8000-000000000001', true, '2026-02-03T02:23:35.540414+00:00', false, false) ON CONFLICT (profile_id, cohort_id) DO NOTHING;
