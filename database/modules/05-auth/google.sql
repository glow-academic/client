-- Module: Google
-- Category: auth
-- Description: Google authentication provider
-- ============================================================


-- Resource rows
INSERT INTO public.auths_resource (created_at, active, generated, mcp, id, name, description, department_ids) VALUES ('2025-11-23T03:58:01.110539+00:00', true, false, false, '019bb25e-e5e2-73eb-9313-57d774b30875', 'Google', 'Google Workspace', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8eaf-7d02-a9f1-5fbd76a4f2f3', 'Google Workspace', '2025-11-23T03:58:01.110539+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.items_resource (id, name, description, encrypted, position, active, created_at, generated, mcp) VALUES ('019b3be4-3119-7fdf-908e-6a6b9430f085', 'clientId', 'Google Client ID', true, 2, true, '2025-11-23T03:58:01.111026+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.items_resource (id, name, description, encrypted, position, active, created_at, generated, mcp) VALUES ('019b3be4-3119-7fae-9dea-08a64aff6240', 'clientSecret', 'Google Client Secret', true, 1, true, '2025-11-23T03:58:01.111026+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8eae-7e98-bf7b-256de7661668', 'Google', '2025-11-23T03:58:01.110539+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- auth_artifact
INSERT INTO public.auth_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-11-23T03:58:01.110539+00:00', '2026-01-16T00:38:22.970333+00:00', '019b3be4-3117-7aa4-aa34-0041aa51d1d8', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- auth_auths_junction
INSERT INTO public.auth_auths_junction (auth_id, auths_id, active, created_at, generated, mcp) VALUES ('019b3be4-3117-7aa4-aa34-0041aa51d1d8', '019bb25e-e5e2-73eb-9313-57d774b30875', true, '2025-11-23T03:58:01.110539+00:00', false, false) ON CONFLICT (auth_id, auths_id) DO NOTHING;
-- auth_descriptions_junction
INSERT INTO public.auth_descriptions_junction (auth_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7aa4-aa34-0041aa51d1d8', '019b995c-8eaf-7d02-a9f1-5fbd76a4f2f3', '2025-11-23T03:58:01.110539+00:00', false, false, true) ON CONFLICT (auth_id, description_id) DO NOTHING;
-- auth_flags_junction
INSERT INTO public.auth_flags_junction (auth_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7aa4-aa34-0041aa51d1d8', '019be334-bfc4-79b2-949c-9f99ea25d2c0', true, '2025-11-23T03:58:01.110539+00:00', false, false, true) ON CONFLICT (auth_id, flag_id) DO NOTHING;
-- auth_items_junction
INSERT INTO public.auth_items_junction (auth_id, item_id, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7aa4-aa34-0041aa51d1d8', '019b3be4-3119-7fdf-908e-6a6b9430f085', '2025-11-23T03:58:01.111026+00:00', false, false, true) ON CONFLICT (auth_id, item_id) DO NOTHING;
INSERT INTO public.auth_items_junction (auth_id, item_id, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7aa4-aa34-0041aa51d1d8', '019b3be4-3119-7fae-9dea-08a64aff6240', '2025-11-23T03:58:01.111026+00:00', false, false, true) ON CONFLICT (auth_id, item_id) DO NOTHING;
-- auth_names_junction
INSERT INTO public.auth_names_junction (auth_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7aa4-aa34-0041aa51d1d8', '019b995c-8eae-7e98-bf7b-256de7661668', '2025-11-23T03:58:01.110539+00:00', false, false, true) ON CONFLICT (auth_id, name_id) DO NOTHING;
-- auth_protocols_junction
INSERT INTO public.auth_protocols_junction (auth_id, protocol_id, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7aa4-aa34-0041aa51d1d8', '019b9fb7-4439-7798-a670-ae8103d62ac2', '2026-01-08T22:25:46.555384+00:00', false, false, true) ON CONFLICT (auth_id, protocol_id) DO NOTHING;
-- auth_slugs_junction
INSERT INTO public.auth_slugs_junction (auth_id, slug_id, created_at, generated, mcp, active) VALUES ('019b3be4-3117-7aa4-aa34-0041aa51d1d8', '019b9fb7-4446-7ea7-b1b5-571ac76d4fad', '2026-01-08T22:25:46.566757+00:00', false, false, true) ON CONFLICT (auth_id, slug_id) DO NOTHING;
