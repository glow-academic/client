-- Module: Default Guest
-- Category: profile (university)
-- Description: Default Guest profile — university links
-- ============================================================

-- profile_departments_junction
-- emails_resource
INSERT INTO public.emails_resource (id, email, created_at, active, generated, mcp) VALUES ('019c57ef-f302-787e-b140-15f193cc887d', 'default-guest@university.edu', '2026-02-13T16:57:49.056138+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
-- profile_emails_junction
INSERT INTO public.profile_emails_junction (email, is_primary, active, created_at, profile_id, email_id, generated, mcp) VALUES ('default-guest@university.edu', true, true, '2026-02-13T16:57:49.058920+00:00', '019b3be4-36f0-792c-82d6-126664ed18b6', '019c57ef-f302-787e-b140-15f193cc887d', false, false) ON CONFLICT (profile_id, email_id) DO NOTHING;
