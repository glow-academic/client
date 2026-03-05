-- Module: Default Superadmin
-- Category: profile (organization)
-- Description: Default Superadmin profile — organization links
-- ============================================================

-- profile_departments_junction
INSERT INTO public.profile_departments_junction (profile_id, departments_id, active, created_at, generated, mcp) VALUES ('019b3be4-36f0-788c-9df2-481eb5917940', '019c3f8c-b97f-70eb-86fb-4f3fae4902f8', true, '2026-02-13T16:57:49.051925+00:00', false, false) ON CONFLICT (profile_id, departments_id) DO NOTHING;
-- emails_resource
INSERT INTO public.emails_resource (id, email, created_at, active, generated, mcp) VALUES ('019c5801-d006-7d01-aee1-d82c2b03eb52', 'default-superadmin@organization.com', '2026-02-13T17:17:19.749241+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
-- profile_emails_junction
INSERT INTO public.profile_emails_junction (email, active, created_at, profile_id, emails_id, generated, mcp) VALUES ('default-superadmin@organization.com', true, '2026-02-13T17:17:19.751010+00:00', '019b3be4-36f0-788c-9df2-481eb5917940', '019c5801-d006-7d01-aee1-d82c2b03eb52', false, false) ON CONFLICT (profile_id, emails_id) DO NOTHING;
