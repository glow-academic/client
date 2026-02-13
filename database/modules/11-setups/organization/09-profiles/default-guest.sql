-- Module: Default Guest
-- Category: profile (organization)
-- Description: Default Guest profile — organization links
-- ============================================================

-- profile_departments_junction
INSERT INTO public.profile_departments_junction (is_primary, created_at, active, department_id, profile_id, generated, mcp) VALUES (true, '2026-02-13T16:57:49.051925+00:00', true, '019c3f8c-b97f-70eb-86fb-4f3fae4902f8', '019b3be4-36f0-792c-82d6-126664ed18b6', false, false) ON CONFLICT (profile_id, department_id) DO NOTHING;
-- emails_resource
INSERT INTO public.emails_resource (id, email, created_at, active, generated, mcp) VALUES ('019c5801-d006-7d59-ad92-0d98a5c02a51', 'redacted@gmail.com', '2026-02-13T17:17:19.749241+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
-- profile_emails_junction
INSERT INTO public.profile_emails_junction (email, is_primary, active, created_at, profile_id, email_id, generated, mcp) VALUES ('redacted@gmail.com', false, true, '2026-02-13T17:17:19.751010+00:00', '019b3be4-36f0-792c-82d6-126664ed18b6', '019c5801-d006-7d59-ad92-0d98a5c02a51', false, false) ON CONFLICT (profile_id, email_id) DO NOTHING;
