-- Module: sora-2-pro
-- Provider: openai
-- Description: openai sora-2-pro model
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8ea4-72b6-8e3c-15b0d4cec7a2', 'Sora 2 Pro (Low Quality) - 720x1280/1280x720 resolution. OpenAI''s advanced video generation model optimized for cost efficiency.', '2025-12-02T16:56:17.374474+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.models_resource (created_at, value, active, generated, mcp, id, name, description, department_ids, provider_id, temperature_level_ids, reasoning_level_ids, quality_ids, voice_ids, modality_ids) VALUES ('2025-12-02T16:56:17.374474+00:00', 'sora-2-pro', true, false, false, '019bb25e-e5ff-77ec-96de-1d9bca096cef', 'sora-2-pro', 'Sora 2 Pro (Low Quality) - 720x1280/1280x720 resolution. OpenAI''s advanced video generation model optimized for cost efficiency.', '{}', '019bb2af-b2a7-7d85-a61a-0dc4fd93b3c6', '{}', '{}', '{019bbce5-e5ff-7197-bd68-b0ff7b7508af}', '{}', '{019bbce5-e606-77f1-abf8-78df7462af03,019bbce5-e609-750d-90c6-cb39f1266e18,019bbce5-e607-7bc4-a6b0-a4218bc8e5f8,019bbce5-e608-7d5a-b937-0a22697e3f8b}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8ea2-7c76-beb6-9bb23af39f7e', 'sora-2-pro', '2025-12-02T16:56:17.374474+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.values_resource (id, value, type, created_at, active, generated, mcp) VALUES ('019bbabc-5a34-7c16-a0e7-5b2525ae4843', 'sora-2-pro', 'model', '2025-12-02T16:56:17.374474+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- model_artifact
INSERT INTO public.model_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-02T16:56:17.374474+00:00', '2025-12-02T16:56:17.374474+00:00', '019b3be4-36d1-7887-a4a4-c282641fe9e3', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- model_descriptions_junction
INSERT INTO public.model_descriptions_junction (model_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7887-a4a4-c282641fe9e3', '019b995c-8ea4-72b6-8e3c-15b0d4cec7a2', '2025-12-02T16:56:17.374474+00:00', false, false, true) ON CONFLICT (model_id, descriptions_id) DO NOTHING;
-- model_flags_junction
INSERT INTO public.model_flags_junction (model_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7887-a4a4-c282641fe9e3', '019be334-bfc4-7ef6-b18f-7a556d94b225', '2025-12-02T16:56:17.374474+00:00', false, false, true) ON CONFLICT (model_id, flags_id) DO NOTHING;
-- model_modalities_junction
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modalities_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-7887-a4a4-c282641fe9e3', false, false, '019bbce5-e608-7d5a-b937-0a22697e3f8b') ON CONFLICT (model_id, modalities_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modalities_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-7887-a4a4-c282641fe9e3', false, false, '019bbce5-e607-7bc4-a6b0-a4218bc8e5f8') ON CONFLICT (model_id, modalities_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modalities_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-7887-a4a4-c282641fe9e3', false, false, '019c47d6-6c45-75f5-abd6-9cfc54b978a6') ON CONFLICT (model_id, modalities_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modalities_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-7887-a4a4-c282641fe9e3', false, false, '019c47d6-6c45-754d-9669-73c9882d1a66') ON CONFLICT (model_id, modalities_id) DO NOTHING;
-- model_models_junction
INSERT INTO public.model_models_junction (model_id, models_id, active, created_at, generated, mcp) VALUES ('019b3be4-36d1-7887-a4a4-c282641fe9e3', '019bb25e-e5ff-77ec-96de-1d9bca096cef', true, '2025-12-02T16:56:17.374474+00:00', false, false) ON CONFLICT (model_id, models_id) DO NOTHING;
-- model_names_junction
INSERT INTO public.model_names_junction (model_id, names_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7887-a4a4-c282641fe9e3', '019b995c-8ea2-7c76-beb6-9bb23af39f7e', '2025-12-02T16:56:17.374474+00:00', false, false, true) ON CONFLICT (model_id, names_id) DO NOTHING;
-- model_pricing_junction
INSERT INTO public.model_pricing_junction (active, created_at, model_id, generated, mcp, pricing_id) VALUES (true, '2025-12-02T16:56:17.382657+00:00', '019b3be4-36d1-7887-a4a4-c282641fe9e3', false, false, '019bbce5-e617-770f-a354-a94fbf7fe764') ON CONFLICT (model_id, pricing_id) DO NOTHING;
-- model_providers_junction
INSERT INTO public.model_providers_junction (model_id, providers_id, created_at, active, generated, mcp) VALUES ('019b3be4-36d1-7887-a4a4-c282641fe9e3', '019bb2af-b2a7-7d85-a61a-0dc4fd93b3c6', '2026-01-08T22:01:23.620772+00:00', true, false, false) ON CONFLICT (model_id, providers_id) DO NOTHING;
-- model_qualities_junction
INSERT INTO public.model_qualities_junction (active, created_at, model_id, generated, mcp, qualities_id) VALUES (true, '2025-12-02T16:56:17.374857+00:00', '019b3be4-36d1-7887-a4a4-c282641fe9e3', false, false, '019bbce5-e5ff-7197-bd68-b0ff7b7508af') ON CONFLICT (model_id, qualities_id) DO NOTHING;
-- model_values_junction
INSERT INTO public.model_values_junction (model_id, values_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7887-a4a4-c282641fe9e3', '019bbabc-5a34-7c16-a0e7-5b2525ae4843', '2025-12-02T16:56:17.374474+00:00', false, false, true) ON CONFLICT (model_id, values_id) DO NOTHING;

-- Additional artifact: 019b3be4-36d1-788c-9a89-a340a6d9f62b
-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8ea4-72d8-b472-a0be9b346a81', 'Sora 2 Pro (High Quality) - 1024x1792/1792x1024 resolution. OpenAI''s advanced video generation model optimized for highest quality output.', '2025-12-02T16:56:17.374659+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.models_resource (created_at, value, active, generated, mcp, id, name, description, department_ids, provider_id, temperature_level_ids, reasoning_level_ids, quality_ids, voice_ids, modality_ids) VALUES ('2025-12-02T16:56:17.374659+00:00', 'sora-2-pro', true, false, false, '019bb25e-e5ff-77f0-b13f-f68e7ffd264f', 'sora-2-pro', 'Sora 2 Pro (High Quality) - 1024x1792/1792x1024 resolution. OpenAI''s advanced video generation model optimized for highest quality output.', '{}', '019bb2af-b2a7-7d85-a61a-0dc4fd93b3c6', '{}', '{}', '{019bbce5-e600-7e7e-9a28-1182423e74a7}', '{}', '{019bbce5-e606-77f1-abf8-78df7462af03,019bbce5-e609-750d-90c6-cb39f1266e18,019bbce5-e607-7bc4-a6b0-a4218bc8e5f8,019bbce5-e608-7d5a-b937-0a22697e3f8b}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- model_artifact
INSERT INTO public.model_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-02T16:56:17.374659+00:00', '2025-12-02T16:56:17.374659+00:00', '019b3be4-36d1-788c-9a89-a340a6d9f62b', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- model_descriptions_junction
INSERT INTO public.model_descriptions_junction (model_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-788c-9a89-a340a6d9f62b', '019b995c-8ea4-72d8-b472-a0be9b346a81', '2025-12-02T16:56:17.374659+00:00', false, false, true) ON CONFLICT (model_id, descriptions_id) DO NOTHING;
-- model_flags_junction
INSERT INTO public.model_flags_junction (model_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-788c-9a89-a340a6d9f62b', '019be334-bfc4-7ef6-b18f-7a556d94b225', '2025-12-02T16:56:17.374659+00:00', false, false, true) ON CONFLICT (model_id, flags_id) DO NOTHING;
-- model_modalities_junction
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modalities_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-788c-9a89-a340a6d9f62b', false, false, '019bbce5-e608-7d5a-b937-0a22697e3f8b') ON CONFLICT (model_id, modalities_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modalities_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-788c-9a89-a340a6d9f62b', false, false, '019bbce5-e607-7bc4-a6b0-a4218bc8e5f8') ON CONFLICT (model_id, modalities_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modalities_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-788c-9a89-a340a6d9f62b', false, false, '019c47d6-6c45-75f5-abd6-9cfc54b978a6') ON CONFLICT (model_id, modalities_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modalities_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-788c-9a89-a340a6d9f62b', false, false, '019c47d6-6c45-754d-9669-73c9882d1a66') ON CONFLICT (model_id, modalities_id) DO NOTHING;
-- model_models_junction
INSERT INTO public.model_models_junction (model_id, models_id, active, created_at, generated, mcp) VALUES ('019b3be4-36d1-788c-9a89-a340a6d9f62b', '019bb25e-e5ff-77f0-b13f-f68e7ffd264f', true, '2025-12-02T16:56:17.374659+00:00', false, false) ON CONFLICT (model_id, models_id) DO NOTHING;
-- model_names_junction
INSERT INTO public.model_names_junction (model_id, names_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-788c-9a89-a340a6d9f62b', '019b995c-8ea2-7c76-beb6-9bb23af39f7e', '2025-12-02T16:56:17.374659+00:00', false, false, true) ON CONFLICT (model_id, names_id) DO NOTHING;
-- model_pricing_junction
INSERT INTO public.model_pricing_junction (active, created_at, model_id, generated, mcp, pricing_id) VALUES (true, '2025-12-02T16:56:17.382807+00:00', '019b3be4-36d1-788c-9a89-a340a6d9f62b', false, false, '019bbce5-e617-7e3b-ba13-e97571ba8013') ON CONFLICT (model_id, pricing_id) DO NOTHING;
-- model_providers_junction
INSERT INTO public.model_providers_junction (model_id, providers_id, created_at, active, generated, mcp) VALUES ('019b3be4-36d1-788c-9a89-a340a6d9f62b', '019bb2af-b2a7-7d85-a61a-0dc4fd93b3c6', '2026-01-08T22:01:23.620772+00:00', true, false, false) ON CONFLICT (model_id, providers_id) DO NOTHING;
-- model_qualities_junction
INSERT INTO public.model_qualities_junction (active, created_at, model_id, generated, mcp, qualities_id) VALUES (true, '2025-12-02T16:56:17.375015+00:00', '019b3be4-36d1-788c-9a89-a340a6d9f62b', false, false, '019bbce5-e600-7e7e-9a28-1182423e74a7') ON CONFLICT (model_id, qualities_id) DO NOTHING;
-- model_values_junction
INSERT INTO public.model_values_junction (model_id, values_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-788c-9a89-a340a6d9f62b', '019bbabc-5a34-7c16-a0e7-5b2525ae4843', '2025-12-02T16:56:17.374659+00:00', false, false, true) ON CONFLICT (model_id, values_id) DO NOTHING;
