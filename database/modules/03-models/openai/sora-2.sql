-- Module: sora-2
-- Provider: openai
-- Description: openai sora-2 model
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8ea4-72aa-a4df-e3241a60229a', 'Sora 2 is OpenAI''s advanced video generation model.', '2025-11-24T19:50:32.230847+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.models_resource (created_at, value, active, generated, mcp, id, name, description, department_ids, provider_id, temperature_level_ids, reasoning_level_ids, quality_ids, voice_ids, modality_ids) VALUES ('2025-11-24T19:50:32.230847+00:00', 'sora-2', true, false, false, '019bb25e-e5ff-7786-906a-923b3bf6d8d7', 'sora-2', 'Sora 2 is OpenAI''s advanced video generation model.', '{}', '019bb2af-b2a7-7d85-a61a-0dc4fd93b3c6', '{}', '{}', '{}', '{}', '{019bbce5-e609-750d-90c6-cb39f1266e18,019bbce5-e606-77f1-abf8-78df7462af03,019bbce5-e607-7bc4-a6b0-a4218bc8e5f8,019bbce5-e608-7d5a-b937-0a22697e3f8b}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8ea2-7cb7-b80a-adcaefc1dbac', 'sora-2', '2025-11-24T19:50:32.230847+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.pricing_resource (id, pricing_type, price, unit_id, created_at, active, generated, mcp) VALUES ('019bbce5-e616-7fce-ae21-4356ff8eafaf', 'output', 0.10000000149011612, '019b3be4-3ced-7b23-a804-0ab3f0dff208', '2026-01-14T14:25:41.899298+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.providers_resource (id, created_at, active, generated, mcp, name, description, department_ids, value, endpoint, key) VALUES ('019bb2af-b2a7-7d85-a61a-0dc4fd93b3c6', '2026-01-12T14:50:17.639595+00:00', true, false, false, 'openai', 'Provider description', '{}', 'openai', NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.values_resource (id, value, created_at, active, generated, mcp) VALUES ('019bbabc-5a34-7653-8352-2665159608b1', 'sora-2', '2025-11-24T19:50:32.230847+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- model_artifact
INSERT INTO public.model_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-11-24T19:50:32.230847+00:00', '2025-11-24T19:50:32.230847+00:00', '019b3be4-36d1-7777-ad9f-cbe6aa668517', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- model_descriptions_junction
INSERT INTO public.model_descriptions_junction (model_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7777-ad9f-cbe6aa668517', '019b995c-8ea4-72aa-a4df-e3241a60229a', '2025-11-24T19:50:32.230847+00:00', false, false, true) ON CONFLICT (model_id, description_id) DO NOTHING;
-- model_flags_junction
INSERT INTO public.model_flags_junction (model_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7777-ad9f-cbe6aa668517', '019be334-bfc4-7ef6-b18f-7a556d94b225', true, '2025-11-24T19:50:32.230847+00:00', false, false, true) ON CONFLICT (model_id, flag_id) DO NOTHING;
-- model_modalities_junction
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-7777-ad9f-cbe6aa668517', false, false, '019bbce5-e608-7d5a-b937-0a22697e3f8b') ON CONFLICT (model_id, modality_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-7777-ad9f-cbe6aa668517', false, false, '019bbce5-e607-7bc4-a6b0-a4218bc8e5f8') ON CONFLICT (model_id, modality_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-7777-ad9f-cbe6aa668517', false, false, '019c47d6-6c45-75f5-abd6-9cfc54b978a6') ON CONFLICT (model_id, modality_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-7777-ad9f-cbe6aa668517', false, false, '019c47d6-6c45-754d-9669-73c9882d1a66') ON CONFLICT (model_id, modality_id) DO NOTHING;
-- model_models_junction
INSERT INTO public.model_models_junction (model_id, models_id, active, created_at, generated, mcp) VALUES ('019b3be4-36d1-7777-ad9f-cbe6aa668517', '019bb25e-e5ff-7786-906a-923b3bf6d8d7', true, '2025-11-24T19:50:32.230847+00:00', false, false) ON CONFLICT (model_id, models_id) DO NOTHING;
-- model_names_junction
INSERT INTO public.model_names_junction (model_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7777-ad9f-cbe6aa668517', '019b995c-8ea2-7cb7-b80a-adcaefc1dbac', '2025-11-24T19:50:32.230847+00:00', false, false, true) ON CONFLICT (model_id, name_id) DO NOTHING;
-- model_pricing_junction
INSERT INTO public.model_pricing_junction (active, created_at, model_id, generated, mcp, pricing_id) VALUES (true, '2025-12-02T16:56:17.372368+00:00', '019b3be4-36d1-7777-ad9f-cbe6aa668517', false, false, '019bbce5-e616-7fce-ae21-4356ff8eafaf') ON CONFLICT (model_id, pricing_id) DO NOTHING;
-- model_providers_junction
INSERT INTO public.model_providers_junction (model_id, providers_id, created_at, active, generated, mcp) VALUES ('019b3be4-36d1-7777-ad9f-cbe6aa668517', '019bb2af-b2a7-7d85-a61a-0dc4fd93b3c6', '2026-01-08T22:01:23.620772+00:00', true, false, false) ON CONFLICT (model_id, providers_id) DO NOTHING;
-- model_values_junction
INSERT INTO public.model_values_junction (model_id, value_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7777-ad9f-cbe6aa668517', '019bbabc-5a34-7653-8352-2665159608b1', '2025-11-24T19:50:32.230847+00:00', false, false, true) ON CONFLICT (model_id, value_id) DO NOTHING;
