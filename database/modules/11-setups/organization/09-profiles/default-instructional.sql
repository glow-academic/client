-- Module: Default Instructional
-- Category: profile (organization)
-- Description: Default Instructional profile — organization links
-- ============================================================

-- profile_departments_junction
INSERT INTO public.profile_departments_junction (profile_id, departments_id, active, created_at, generated, mcp) VALUES ('019b3be4-36f0-785d-9d61-32eae65689ca', '019c3f8c-b97f-70eb-86fb-4f3fae4902f8', true, '2026-02-13T16:57:49.051925+00:00', false, false) ON CONFLICT (profile_id, departments_id) DO NOTHING;
-- emails_resource
INSERT INTO public.emails_resource (id, email, created_at, active, generated, mcp) VALUES ('019c5801-d006-7ca6-9f37-6d7d44d4c216', 'default-instructional@organization.com', '2026-02-13T17:17:19.749241+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
-- profile_emails_junction
INSERT INTO public.profile_emails_junction (email, active, created_at, profile_id, emails_id, generated, mcp) VALUES ('default-instructional@organization.com', true, '2026-02-13T17:17:19.751010+00:00', '019b3be4-36f0-785d-9d61-32eae65689ca', '019c5801-d006-7ca6-9f37-6d7d44d4c216', false, false) ON CONFLICT (profile_id, emails_id) DO NOTHING;
