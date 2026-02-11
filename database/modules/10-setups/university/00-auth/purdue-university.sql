-- Module: Purdue University
-- Category: auth
-- Description: Purdue University authentication provider
-- ============================================================


-- Resource rows
INSERT INTO public.auths_resource (created_at, active, generated, mcp, id, name, description, department_ids) VALUES ('2025-11-23T03:58:01.111785+00:00', true, false, false, '019bb25e-e5e2-74b4-8ff7-70273a42b4c0', 'Purdue University', 'Purdue Login', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8eaf-7d0f-862f-3530d2a478b4', 'Purdue Login', '2025-11-23T03:58:01.111785+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.items_resource (id, name, description, encrypted, position, active, created_at, generated, mcp) VALUES ('019b3be4-311a-7033-9351-0c9ccb0d4ffd', 'clientSecret', 'Purdue Client Secret', true, 1, true, '2025-11-23T03:58:01.112077+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.items_resource (id, name, description, encrypted, position, active, created_at, generated, mcp) VALUES ('019b3be4-311a-7035-8010-1cd26502ebb6', 'clientId', 'Purdue Client ID', true, 2, true, '2025-11-23T03:58:01.112077+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.items_resource (id, name, description, encrypted, position, active, created_at, generated, mcp) VALUES ('019b3be4-311a-703a-8ad0-afdf21ec7c8f', 'discoveryUrl', 'Purdue Discovery URL', false, 3, true, '2025-11-23T03:58:01.112077+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8eae-7e96-b2bf-fa954addc7df', 'Purdue University', '2025-11-23T03:58:01.111785+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- auth_artifact
INSERT INTO public.auth_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-11-23T03:58:01.111785+00:00', '2025-11-23T15:36:22.017859+00:00', '019b3be4-3117-7ae8-b8d0-d3191b9cfdce', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- auth_auths_junction
INSERT INTO public.auth_auths_junction (auth_id, auths_id, active, created_at, generated, mcp) VALUES ('019b3be4-3117-7ae8-b8d0-d3191b9cfdce', '019bb25e-e5e2-74b4-8ff7-70273a42b4c0', true, '2025-11-23T03:58:01.111785+00:00', false, false) ON CONFLICT (auth_id, auths_id) DO NOTHING;
-- auth_descriptions_junction
INSERT INTO public.auth_descriptions_junction (auth_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7ae8-b8d0-d3191b9cfdce', '019b995c-8eaf-7d0f-862f-3530d2a478b4', '2025-11-23T03:58:01.111785+00:00', false, false, true) ON CONFLICT (auth_id, description_id) DO NOTHING;
-- auth_flags_junction
INSERT INTO public.auth_flags_junction (auth_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7ae8-b8d0-d3191b9cfdce', '019be334-bfc4-79b2-949c-9f99ea25d2c0', false, '2025-11-23T03:58:01.111785+00:00', false, false, true) ON CONFLICT (auth_id, flag_id) DO NOTHING;
-- auth_items_junction
INSERT INTO public.auth_items_junction (auth_id, item_id, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7ae8-b8d0-d3191b9cfdce', '019b3be4-311a-7033-9351-0c9ccb0d4ffd', '2025-11-23T03:58:01.112077+00:00', false, false, true) ON CONFLICT (auth_id, item_id) DO NOTHING;
INSERT INTO public.auth_items_junction (auth_id, item_id, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7ae8-b8d0-d3191b9cfdce', '019b3be4-311a-7035-8010-1cd26502ebb6', '2025-11-23T03:58:01.112077+00:00', false, false, true) ON CONFLICT (auth_id, item_id) DO NOTHING;
INSERT INTO public.auth_items_junction (auth_id, item_id, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7ae8-b8d0-d3191b9cfdce', '019b3be4-311a-703a-8ad0-afdf21ec7c8f', '2025-11-23T03:58:01.112077+00:00', false, false, true) ON CONFLICT (auth_id, item_id) DO NOTHING;
-- auth_names_junction
INSERT INTO public.auth_names_junction (auth_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7ae8-b8d0-d3191b9cfdce', '019b995c-8eae-7e96-b2bf-fa954addc7df', '2025-11-23T03:58:01.111785+00:00', false, false, true) ON CONFLICT (auth_id, name_id) DO NOTHING;
-- auth_protocols_junction
INSERT INTO public.auth_protocols_junction (auth_id, protocol_id, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7ae8-b8d0-d3191b9cfdce', '019b9fb7-4439-79ef-9aeb-a1a40b9c22b9', '2026-01-08T22:25:46.555384+00:00', false, false, true) ON CONFLICT (auth_id, protocol_id) DO NOTHING;
-- auth_slugs_junction
INSERT INTO public.auth_slugs_junction (auth_id, slug_id, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7ae8-b8d0-d3191b9cfdce', '019b9fb7-4447-74f5-a9ac-ede63bde8be1', '2026-01-08T22:25:46.566757+00:00', false, false, true) ON CONFLICT (auth_id, slug_id) DO NOTHING;
