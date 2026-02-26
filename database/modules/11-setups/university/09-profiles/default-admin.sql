-- Module: Default Admin
-- Category: profile (university)
-- Description: Default Admin profile — university links
-- ============================================================

-- profile_departments_junction
-- emails_resource
INSERT INTO public.emails_resource (id, email, created_at, active, generated, mcp) VALUES ('019c57ef-f302-703f-9448-d3ca0c41f316', 'default-admin@university.edu', '2026-02-13T16:57:49.056138+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
-- profile_emails_junction
INSERT INTO public.profile_emails_junction (email, is_primary, active, created_at, profile_id, email_id, generated, mcp) VALUES ('default-admin@university.edu', true, true, '2026-02-13T16:57:49.058920+00:00', '019b3be4-36ef-7a5f-98ab-ccb879770be0', '019c57ef-f302-703f-9448-d3ca0c41f316', false, false) ON CONFLICT (profile_id, email_id) DO NOTHING;
