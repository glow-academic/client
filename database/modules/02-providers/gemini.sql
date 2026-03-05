-- Module: gemini
-- Category: provider
-- Description: gemini AI provider
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bb2af-b2cb-78b7-9d99-aa44b063e2a1', 'Provider description', '2026-01-12T14:50:17.672808+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bb2af-b2a5-74a4-94b0-12c889e9facb', 'gemini', '2026-01-12T14:50:17.633622+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.providers_resource (id, created_at, active, generated, mcp, name, description, department_ids, value, endpoint, key) VALUES ('019bb2af-b2a8-7035-bbfd-664ba627bd44', '2026-01-12T14:50:17.639595+00:00', true, false, false, 'gemini', 'Provider description', '{}', 'gemini', NULL, 'MHj8BzhhiAWj2zl5JTEZH4gEvla5N6uqKwqFvqfJEp3wQUJ9WfR+oBdCvQohUshbJJmoib7eCoc+W7wt1hxL0MZJQu/ZwKNGwn2mKNar4+u4NVxFYIoEhcYBA2brhO6T') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- provider_artifact
INSERT INTO public.provider_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bb2af-b2a5-7219-9e1d-2439eee0b618', '2026-01-12T14:50:17.633622+00:00', '2026-01-12T14:50:17.633622+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- provider_descriptions_junction
INSERT INTO public.provider_descriptions_junction (provider_id, description_id, created_at, generated, mcp, active) VALUES ('019bb2af-b2a5-7219-9e1d-2439eee0b618', '019bb2af-b2cb-78b7-9d99-aa44b063e2a1', '2026-01-12T14:50:17.672808+00:00', false, false, true) ON CONFLICT (provider_id, description_id) DO NOTHING;
-- provider_flags_junction
INSERT INTO public.provider_flags_junction (provider_id, flag_id, created_at, generated, mcp, active) VALUES ('019bb2af-b2a5-7219-9e1d-2439eee0b618', '019be334-bfc5-7a16-a7ce-ed6bdc9a6e5d', '2026-01-12T14:50:17.672808+00:00', false, false, true) ON CONFLICT (provider_id, flag_id) DO NOTHING;
-- provider_names_junction
INSERT INTO public.provider_names_junction (provider_id, name_id, created_at, generated, mcp, active) VALUES ('019bb2af-b2a5-7219-9e1d-2439eee0b618', '019bb2af-b2a5-74a4-94b0-12c889e9facb', '2026-01-12T14:50:17.672808+00:00', false, false, true) ON CONFLICT (provider_id, name_id) DO NOTHING;
-- provider_providers_junction
INSERT INTO public.provider_providers_junction (provider_id, providers_id, active, created_at, generated, mcp) VALUES ('019bb2af-b2a5-7219-9e1d-2439eee0b618', '019bb2af-b2a8-7035-bbfd-664ba627bd44', '2026-01-12T14:50:17.639595+00:00', false, false) ON CONFLICT (provider_id, providers_id) DO NOTHING;
