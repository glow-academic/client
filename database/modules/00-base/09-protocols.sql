-- Module: protocols
-- Category: base
-- Description: protocols system data
-- ============================================================

-- Table: protocols_resource
INSERT INTO public.protocols_resource VALUES ('019b9fb7-4439-7a12-acef-95c81fe1436d', 'saml', '2026-01-08 16:25:46.553408-06', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.protocols_resource VALUES ('019b9fb7-4439-7798-a670-ae8103d62ac2', 'google', '2026-01-08 16:25:46.553408-06', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.protocols_resource VALUES ('019b9fb7-4439-79ef-9aeb-a1a40b9c22b9', 'oidc', '2026-01-08 16:25:46.553408-06', false, false) ON CONFLICT (id) DO NOTHING;
