-- Module: Default Guest
-- Category: profile (university)
-- Description: Default Guest profile — university links
-- ============================================================

-- profile_departments_junction
INSERT INTO public.profile_departments_junction (is_primary, created_at, active, department_id, profile_id, generated, mcp) VALUES (false, '2026-02-13T16:57:49.051925+00:00', true, '019bb25e-e624-73da-8cef-166028a1065a', '019b3be4-36f0-792c-82d6-126664ed18b6', false, false) ON CONFLICT (profile_id, department_id) DO NOTHING;
-- emails_resource
INSERT INTO public.emails_resource (id, email, created_at, active, generated, mcp) VALUES ('019c57ef-f302-787e-b140-15f193cc887d', 'redacted@purdue.edu', '2026-02-13T16:57:49.056138+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
-- profile_emails_junction
INSERT INTO public.profile_emails_junction (email, is_primary, active, created_at, profile_id, email_id, generated, mcp) VALUES ('redacted@purdue.edu', true, true, '2026-02-13T16:57:49.058920+00:00', '019b3be4-36f0-792c-82d6-126664ed18b6', '019c57ef-f302-787e-b140-15f193cc887d', false, false) ON CONFLICT (profile_id, email_id) DO NOTHING;
