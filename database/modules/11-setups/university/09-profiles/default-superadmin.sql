-- Module: Default Superadmin
-- Category: profile (university)
-- Description: Default Superadmin profile — university links
-- ============================================================

-- profile_departments_junction
INSERT INTO public.profile_departments_junction (profile_id, departments_id, active, created_at, generated, mcp) VALUES ('019b3be4-36f0-788c-9df2-481eb5917940', '019bb25e-e624-73da-8cef-166028a1065a', true, '2026-02-13T16:57:49.051925+00:00', false, false) ON CONFLICT (profile_id, departments_id) DO NOTHING;
-- emails_resource
INSERT INTO public.emails_resource (id, email, created_at, active, generated, mcp) VALUES ('019c57ef-f302-7821-90c9-55c4556bfe92', 'default-superadmin@university.edu', '2026-02-13T16:57:49.056138+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
-- profile_emails_junction
INSERT INTO public.profile_emails_junction (email, active, created_at, profile_id, emails_id, generated, mcp) VALUES ('default-superadmin@university.edu', true, '2026-02-13T16:57:49.058920+00:00', '019b3be4-36f0-788c-9df2-481eb5917940', '019c57ef-f302-7821-90c9-55c4556bfe92', false, false) ON CONFLICT (profile_id, emails_id) DO NOTHING;
-- redacted@purdue.edu (additional email for superadmin)
INSERT INTO public.emails_resource (id, email, created_at, active, generated, mcp) VALUES ('019c9941-058d-79e9-8d05-41dc25f19025', 'redacted@purdue.edu', '2026-02-26T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profile_emails_junction (email, active, created_at, profile_id, emails_id, generated, mcp) VALUES ('redacted@purdue.edu', true, '2026-02-26T00:00:00.000000+00:00', '019b3be4-36f0-788c-9df2-481eb5917940', '019c9941-058d-79e9-8d05-41dc25f19025', false, false) ON CONFLICT (profile_id, emails_id) DO NOTHING;
