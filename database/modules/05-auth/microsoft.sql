-- Module: Microsoft
-- Category: auth
-- Description: Microsoft authentication provider
-- ============================================================


-- Resource rows
INSERT INTO public.auths_resource (created_at, active, generated, mcp, id, group_id, name, description, department_ids) VALUES ('2025-11-23T01:06:57.190112+00:00', true, false, false, '019bb25e-e5e2-74c2-aaf3-42c5403f26f9', '019ba0cd-762c-738a-b3fd-a113530cb09c', 'Microsoft', 'Microsoft Entra ID OAuth configuration', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8eaf-7d05-be91-06a88bab7ec8', 'Microsoft Entra ID OAuth configuration', '2025-11-23T01:06:57.190112+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.items_resource (id, name, description, encrypted, position, active, created_at, generated, mcp) VALUES ('019b3be4-3119-7ff4-a277-aa213eac5632', 'tenantId', 'Microsoft Tenant ID', false, 3, true, '2025-11-23T04:23:30.295517+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.items_resource (id, name, description, encrypted, position, active, created_at, generated, mcp) VALUES ('019b3be4-3119-7ff8-9a20-27a9c8e586d5', 'userInfoUrl', 'Microsoft UserInfo Endpoint', false, 4, true, '2025-11-23T04:41:11.809003+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.items_resource (id, name, description, encrypted, position, active, created_at, generated, mcp) VALUES ('019b3be4-311a-7004-bc8a-cd80f62b310e', 'discoveryUrl', 'Microsoft Discovery URL', false, 5, true, '2025-11-23T04:41:11.809003+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.items_resource (id, name, description, encrypted, position, active, created_at, generated, mcp) VALUES ('019b3be4-311a-7008-8bba-868f8b70fe13', 'clientAuthMethod', 'Microsoft Client Auth Method', false, 6, true, '2025-11-23T04:41:11.809003+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.items_resource (id, name, description, encrypted, position, active, created_at, generated, mcp) VALUES ('019b3be4-311a-700d-8fc0-9ba72a9bd318', 'authorizationUrl', 'Microsoft Authorization Endpoint', false, 7, true, '2025-11-23T04:41:11.809003+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.items_resource (id, name, description, encrypted, position, active, created_at, generated, mcp) VALUES ('019b3be4-311a-7014-96a8-573949e45256', 'tokenUrl', 'Microsoft Token Endpoint', false, 8, true, '2025-11-23T04:41:11.809003+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.items_resource (id, name, description, encrypted, position, active, created_at, generated, mcp) VALUES ('019b3be4-3119-7fed-b752-bf6209d31c1d', 'clientId', 'Microsoft Entra ID Client ID', true, 2, true, '2025-11-23T01:06:57.192515+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.items_resource (id, name, description, encrypted, position, active, created_at, generated, mcp) VALUES ('019b3be4-3119-7feb-9764-0741b7080380', 'clientSecret', 'Microsoft Entra ID Client Secret', true, 1, true, '2025-11-23T01:06:57.192515+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8eae-7e90-976b-9e2caf5a6853', 'Microsoft', '2025-11-23T01:06:57.190112+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- auth_artifact
INSERT INTO public.auth_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-11-23T01:06:57.190112+00:00', '2026-01-16T00:38:22.970333+00:00', '019b3be4-3117-7afc-8d1d-a2815d70f294', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- auth_auths_junction
INSERT INTO public.auth_auths_junction (auth_id, auths_id, active, created_at, generated, mcp) VALUES ('019b3be4-3117-7afc-8d1d-a2815d70f294', '019bb25e-e5e2-74c2-aaf3-42c5403f26f9', true, '2025-11-23T01:06:57.190112+00:00', false, false) ON CONFLICT (auth_id, auths_id) DO NOTHING;
-- auth_descriptions_junction
INSERT INTO public.auth_descriptions_junction (auth_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7afc-8d1d-a2815d70f294', '019b995c-8eaf-7d05-be91-06a88bab7ec8', '2025-11-23T01:06:57.190112+00:00', false, false, true) ON CONFLICT (auth_id, description_id) DO NOTHING;
-- auth_flags_junction
INSERT INTO public.auth_flags_junction (auth_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7afc-8d1d-a2815d70f294', '019be334-bfc4-79b2-949c-9f99ea25d2c0', true, '2025-11-23T01:06:57.190112+00:00', false, false, true) ON CONFLICT (auth_id, flag_id) DO NOTHING;
-- auth_items_junction
INSERT INTO public.auth_items_junction (auth_id, item_id, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7afc-8d1d-a2815d70f294', '019b3be4-3119-7ff4-a277-aa213eac5632', '2025-11-23T04:23:30.295517+00:00', false, false, true) ON CONFLICT (auth_id, item_id) DO NOTHING;
INSERT INTO public.auth_items_junction (auth_id, item_id, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7afc-8d1d-a2815d70f294', '019b3be4-3119-7ff8-9a20-27a9c8e586d5', '2025-11-23T04:41:11.809003+00:00', false, false, true) ON CONFLICT (auth_id, item_id) DO NOTHING;
INSERT INTO public.auth_items_junction (auth_id, item_id, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7afc-8d1d-a2815d70f294', '019b3be4-311a-7004-bc8a-cd80f62b310e', '2025-11-23T04:41:11.809003+00:00', false, false, true) ON CONFLICT (auth_id, item_id) DO NOTHING;
INSERT INTO public.auth_items_junction (auth_id, item_id, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7afc-8d1d-a2815d70f294', '019b3be4-311a-7008-8bba-868f8b70fe13', '2025-11-23T04:41:11.809003+00:00', false, false, true) ON CONFLICT (auth_id, item_id) DO NOTHING;
INSERT INTO public.auth_items_junction (auth_id, item_id, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7afc-8d1d-a2815d70f294', '019b3be4-311a-700d-8fc0-9ba72a9bd318', '2025-11-23T04:41:11.809003+00:00', false, false, true) ON CONFLICT (auth_id, item_id) DO NOTHING;
INSERT INTO public.auth_items_junction (auth_id, item_id, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7afc-8d1d-a2815d70f294', '019b3be4-311a-7014-96a8-573949e45256', '2025-11-23T04:41:11.809003+00:00', false, false, true) ON CONFLICT (auth_id, item_id) DO NOTHING;
INSERT INTO public.auth_items_junction (auth_id, item_id, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7afc-8d1d-a2815d70f294', '019b3be4-3119-7fed-b752-bf6209d31c1d', '2025-11-23T01:06:57.192515+00:00', false, false, true) ON CONFLICT (auth_id, item_id) DO NOTHING;
INSERT INTO public.auth_items_junction (auth_id, item_id, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7afc-8d1d-a2815d70f294', '019b3be4-3119-7feb-9764-0741b7080380', '2025-11-23T01:06:57.192515+00:00', false, false, true) ON CONFLICT (auth_id, item_id) DO NOTHING;
-- auth_names_junction
INSERT INTO public.auth_names_junction (auth_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7afc-8d1d-a2815d70f294', '019b995c-8eae-7e90-976b-9e2caf5a6853', '2025-11-23T01:06:57.190112+00:00', false, false, true) ON CONFLICT (auth_id, name_id) DO NOTHING;
-- auth_protocols_junction
INSERT INTO public.auth_protocols_junction (auth_id, protocol_id, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7afc-8d1d-a2815d70f294', '019b9fb7-4439-79ef-9aeb-a1a40b9c22b9', '2026-01-08T22:25:46.555384+00:00', false, false, true) ON CONFLICT (auth_id, protocol_id) DO NOTHING;
-- auth_slugs_junction
INSERT INTO public.auth_slugs_junction (auth_id, slug_id, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7afc-8d1d-a2815d70f294', '019b9fb7-4447-767f-b8cb-05c87cf64788', '2026-01-08T22:25:46.566757+00:00', false, false, true) ON CONFLICT (auth_id, slug_id) DO NOTHING;
