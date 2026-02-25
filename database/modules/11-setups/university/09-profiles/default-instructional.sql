-- Module: Default Instructional
-- Category: profile (university)
-- Description: Default Instructional profile — university links
-- ============================================================

-- profile_departments_junction
-- emails_resource
INSERT INTO public.emails_resource (id, email, created_at, active, generated, mcp) VALUES ('019c57ef-f302-77c7-9d8b-77047838df8e', 'redacted@purdue.edu', '2026-02-13T16:57:49.056138+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
-- profile_emails_junction
INSERT INTO public.profile_emails_junction (email, is_primary, active, created_at, profile_id, email_id, generated, mcp) VALUES ('redacted@purdue.edu', true, true, '2026-02-13T16:57:49.058920+00:00', '019b3be4-36f0-785d-9d61-32eae65689ca', '019c57ef-f302-77c7-9d8b-77047838df8e', false, false) ON CONFLICT (profile_id, email_id) DO NOTHING;
