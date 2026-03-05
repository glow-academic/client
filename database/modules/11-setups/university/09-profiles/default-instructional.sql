-- Module: Default Instructional
-- Category: profile (university)
-- Description: Default Instructional profile — university links
-- ============================================================

-- profile_departments_junction
INSERT INTO public.profile_departments_junction (profile_id, departments_id, active, created_at, generated, mcp) VALUES ('019b3be4-36f0-785d-9d61-32eae65689ca', '019bb25e-e624-73da-8cef-166028a1065a', true, '2026-02-13T16:57:49.051925+00:00', false, false) ON CONFLICT (profile_id, departments_id) DO NOTHING;
-- emails_resource
INSERT INTO public.emails_resource (id, email, created_at, active, generated, mcp) VALUES ('019c57ef-f302-77c7-9d8b-77047838df8e', 'default-instructional@university.edu', '2026-02-13T16:57:49.056138+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
-- profile_emails_junction
INSERT INTO public.profile_emails_junction (email, active, created_at, profile_id, emails_id, generated, mcp) VALUES ('default-instructional@university.edu', true, '2026-02-13T16:57:49.058920+00:00', '019b3be4-36f0-785d-9d61-32eae65689ca', '019c57ef-f302-77c7-9d8b-77047838df8e', false, false) ON CONFLICT (profile_id, emails_id) DO NOTHING;
