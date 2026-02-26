-- Module: Default Admin
-- Category: profile (organization)
-- Description: Default Admin profile — organization links
-- ============================================================

-- profile_departments_junction
INSERT INTO public.profile_departments_junction (profile_id, department_id, is_primary, active, created_at, generated, mcp) VALUES ('019b3be4-36ef-7a5f-98ab-ccb879770be0', '019c3f8c-b97f-70eb-86fb-4f3fae4902f8', true, true, '2026-02-13T16:57:49.051925+00:00', false, false) ON CONFLICT (profile_id, department_id) DO NOTHING;
-- emails_resource
INSERT INTO public.emails_resource (id, email, created_at, active, generated, mcp) VALUES ('019c5801-d006-7898-b044-cac8b2f6e0be', 'default-admin@organization.com', '2026-02-13T17:17:19.749241+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
-- profile_emails_junction
INSERT INTO public.profile_emails_junction (email, is_primary, active, created_at, profile_id, email_id, generated, mcp) VALUES ('default-admin@organization.com', false, true, '2026-02-13T17:17:19.751010+00:00', '019b3be4-36ef-7a5f-98ab-ccb879770be0', '019c5801-d006-7898-b044-cac8b2f6e0be', false, false) ON CONFLICT (profile_id, email_id) DO NOTHING;
