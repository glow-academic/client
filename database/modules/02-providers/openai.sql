-- Module: openai
-- Category: provider
-- Description: openai AI provider
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bb2af-b2ca-7119-a60e-ff2d4bb4021c', 'Provider description', '2026-01-12T14:50:17.672808+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bb2af-b2a4-7eec-a8e9-328a31a4b9b2', 'openai', '2026-01-12T14:50:17.633622+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.providers_resource (id, created_at, active, generated, mcp, name, description, department_ids, value, endpoint, key) VALUES ('019bb2af-b2a7-7d85-a61a-0dc4fd93b3c6', '2026-01-12T14:50:17.639595+00:00', true, false, false, 'openai', 'Provider description', '{}', 'openai', NULL, 'LXIwod0Qb3X69kfq0tBDLTU5Ew3R5S2u0js+X2D6BzO1HDPoU12hbGjOIRi4x/AKSu1S6jrs4yJu9Bo9dI06zlhLQXPze+UBdl+QIVOC5VqAsXqYvhtQv0cD9YTcvBZ01xBPudCkCKkpA+Qrsi3kyoseFxTXwz182AGcQ66c72hf7FX8wbuFw2cP/jObj2kensTBEMfhcemLskuO86hz/uhMDp/M81ENdee0F3vMPK6vs73cWFNXNzLZ4/BTS6TnHhcZxamfyt2opZ4+gK9dkYu55d67bZjp5NdCt+udx9E=') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- provider_artifact
INSERT INTO public.provider_artifact (id, created_at, updated_at, generated, mcp) VALUES ('019bb2af-b2a3-7466-ad52-1a8593d00b6f', '2026-01-12T14:50:17.633622+00:00', '2026-01-12T14:50:17.633622+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- provider_descriptions_junction
INSERT INTO public.provider_descriptions_junction (provider_id, description_id, created_at, generated, mcp, active) VALUES ('019bb2af-b2a3-7466-ad52-1a8593d00b6f', '019bb2af-b2ca-7119-a60e-ff2d4bb4021c', '2026-01-12T14:50:17.672808+00:00', false, false, true) ON CONFLICT (provider_id, description_id) DO NOTHING;
-- provider_flags_junction
INSERT INTO public.provider_flags_junction (provider_id, flag_id, created_at, generated, mcp, active) VALUES ('019bb2af-b2a3-7466-ad52-1a8593d00b6f', '019be334-bfc5-7a16-a7ce-ed6bdc9a6e5d', '2026-01-12T14:50:17.672808+00:00', false, false, true) ON CONFLICT (provider_id, flag_id) DO NOTHING;
-- provider_names_junction
INSERT INTO public.provider_names_junction (provider_id, name_id, created_at, generated, mcp, active) VALUES ('019bb2af-b2a3-7466-ad52-1a8593d00b6f', '019bb2af-b2a4-7eec-a8e9-328a31a4b9b2', '2026-01-12T14:50:17.672808+00:00', false, false, true) ON CONFLICT (provider_id, name_id) DO NOTHING;
-- provider_providers_junction
INSERT INTO public.provider_providers_junction (provider_id, providers_id, active, created_at, generated, mcp) VALUES ('019bb2af-b2a3-7466-ad52-1a8593d00b6f', '019bb2af-b2a7-7d85-a61a-0dc4fd93b3c6', '2026-01-12T14:50:17.639595+00:00', false, false) ON CONFLICT (provider_id, providers_id) DO NOTHING;
