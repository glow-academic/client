-- Module: gemini
-- Category: provider
-- Description: gemini AI provider
-- ============================================================

-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bb2af-b2cb-78b7-9d99-aa44b063e2a1', 'Provider description', '2026-01-12 08:50:17.672808-06', t, f, f) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.flags_resource (id, name, description, created_at, active, generated, mcp, type, icon) VALUES ('019be334-bfc5-7a16-a7ce-ed6bdc9a6e5d', 'provider_active', 'Controls whether this AI provider is available for use', '2026-01-21 18:57:23.648622-06', t, f, f, 'active', 'Power') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bb2af-b2a5-74a4-94b0-12c889e9facb', 'gemini', '2026-01-12 08:50:17.633622-06', t, f, f) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.providers_resource (id, created_at, active, generated, mcp, group_id, name, description, department_ids, value, endpoint, key) VALUES ('019bb2af-b2a8-7035-bbfd-664ba627bd44', '2026-01-12 08:50:17.639595-06', t, f, f, '019bb2af-b2a5-714e-be1b-eb36577f7f8e', 'gemini', 'Provider description', '{}', 'gemini', NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- provider_artifact
INSERT INTO public.provider_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bb2af-b2a5-7219-9e1d-2439eee0b618', '2026-01-12 08:50:17.633622-06', '2026-01-12 08:50:17.633622-06', f, f) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- provider_descriptions_junction
INSERT INTO public.provider_descriptions_junction (provider_id, description_id, created_at, generated, mcp, active) VALUES ('019bb2af-b2a5-7219-9e1d-2439eee0b618', '019bb2af-b2cb-78b7-9d99-aa44b063e2a1', '2026-01-12 08:50:17.672808-06', f, f, t) ON CONFLICT (provider_id, description_id) DO NOTHING;
-- provider_flags_junction
INSERT INTO public.provider_flags_junction (provider_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019bb2af-b2a5-7219-9e1d-2439eee0b618', '019be334-bfc5-7a16-a7ce-ed6bdc9a6e5d', t, '2026-01-12 08:50:17.672808-06', f, f, t) ON CONFLICT (provider_id, flag_id) DO NOTHING;
-- provider_names_junction
INSERT INTO public.provider_names_junction (provider_id, name_id, created_at, generated, mcp, active) VALUES ('019bb2af-b2a5-7219-9e1d-2439eee0b618', '019bb2af-b2a5-74a4-94b0-12c889e9facb', '2026-01-12 08:50:17.672808-06', f, f, t) ON CONFLICT (provider_id, name_id) DO NOTHING;
-- provider_providers_junction
INSERT INTO public.provider_providers_junction (provider_id, providers_id, active, created_at, generated, mcp) VALUES ('019bb2af-b2a5-7219-9e1d-2439eee0b618', '019bb2af-b2a8-7035-bbfd-664ba627bd44', t, '2026-01-12 08:50:17.639595-06', f, f) ON CONFLICT (provider_id, providers_id) DO NOTHING;
