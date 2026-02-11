-- Module: veo-3.1-generate-preview
-- Provider: gemini
-- Description: gemini veo-3.1-generate-preview model
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8ea4-727e-9b55-47a7153c42a4', 'Veo 3.1 Standard - Our latest video generation model, generates video with audio from text and image prompts', '2025-12-02T18:34:42.754909+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.models_resource (created_at, value, active, generated, mcp, id, name, description, department_ids, provider_id, temperature_level_ids, reasoning_level_ids, quality_ids, voice_ids, modality_ids) VALUES ('2025-12-02T18:34:42.754909+00:00', 'veo-3.1-generate-preview', true, false, false, '019bb25e-e5ff-77c2-9745-3abb134da3d9', 'veo-3.1-generate-preview', 'Veo 3.1 Standard - Our latest video generation model, generates video with audio from text and image prompts', '{}', '019bb2af-b2a8-7035-bbfd-664ba627bd44', '{}', '{}', '{019bbce5-e600-7e7e-9a28-1182423e74a7}', '{}', '{019bbce5-e606-77f1-abf8-78df7462af03,019bbce5-e609-750d-90c6-cb39f1266e18,019bbce5-e607-7bc4-a6b0-a4218bc8e5f8,019bbce5-e608-7d5a-b937-0a22697e3f8b}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8ea2-7cb1-8169-e2f63d2290bf', 'veo-3.1-generate-preview', '2025-12-02T18:34:42.754909+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.pricing_resource (id, pricing_type, price, unit_id, created_at, active, generated, mcp) VALUES ('019bbce5-e617-7bcd-89ad-641e506e5954', 'output', 0.4000000059604645, '019b3be4-3ced-7b23-a804-0ab3f0dff208', '2026-01-14T14:25:41.899298+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.providers_resource (id, created_at, active, generated, mcp, group_id, name, description, department_ids, value, endpoint, key) VALUES ('019bb2af-b2a8-7035-bbfd-664ba627bd44', '2026-01-12T14:50:17.639595+00:00', true, false, false, '019bb2af-b2a5-714e-be1b-eb36577f7f8e', 'gemini', 'Provider description', '{}', 'gemini', NULL, NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- model_artifact
INSERT INTO public.model_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-02T18:34:42.754909+00:00', '2025-12-02T18:34:42.754909+00:00', '019b3be4-36d1-7805-8d8b-9c811e4e765b', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- model_descriptions_junction
INSERT INTO public.model_descriptions_junction (model_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7805-8d8b-9c811e4e765b', '019b995c-8ea4-727e-9b55-47a7153c42a4', '2025-12-02T18:34:42.754909+00:00', false, false, true) ON CONFLICT (model_id, description_id) DO NOTHING;
-- model_flags_junction
INSERT INTO public.model_flags_junction (model_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7805-8d8b-9c811e4e765b', '019be334-bfc4-7ef6-b18f-7a556d94b225', true, '2025-12-02T18:34:42.754909+00:00', false, false, true) ON CONFLICT (model_id, flag_id) DO NOTHING;
-- model_modalities_junction
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-7805-8d8b-9c811e4e765b', false, false, '019bbce5-e608-7d5a-b937-0a22697e3f8b') ON CONFLICT (model_id, modality_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-7805-8d8b-9c811e4e765b', false, false, '019bbce5-e607-7bc4-a6b0-a4218bc8e5f8') ON CONFLICT (model_id, modality_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-7805-8d8b-9c811e4e765b', false, false, '019c47d6-6c45-75f5-abd6-9cfc54b978a6') ON CONFLICT (model_id, modality_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-7805-8d8b-9c811e4e765b', false, false, '019c47d6-6c45-754d-9669-73c9882d1a66') ON CONFLICT (model_id, modality_id) DO NOTHING;
-- model_models_junction
INSERT INTO public.model_models_junction (model_id, models_id, active, created_at, generated, mcp) VALUES ('019b3be4-36d1-7805-8d8b-9c811e4e765b', '019bb25e-e5ff-77c2-9745-3abb134da3d9', true, '2025-12-02T18:34:42.754909+00:00', false, false) ON CONFLICT (model_id, models_id) DO NOTHING;
-- model_names_junction
INSERT INTO public.model_names_junction (model_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7805-8d8b-9c811e4e765b', '019b995c-8ea2-7cb1-8169-e2f63d2290bf', '2025-12-02T18:34:42.754909+00:00', false, false, true) ON CONFLICT (model_id, name_id) DO NOTHING;
-- model_pricing_junction
INSERT INTO public.model_pricing_junction (active, created_at, model_id, generated, mcp, pricing_id) VALUES (true, '2025-12-02T18:34:42.763300+00:00', '019b3be4-36d1-7805-8d8b-9c811e4e765b', false, false, '019bbce5-e617-7bcd-89ad-641e506e5954') ON CONFLICT (model_id, pricing_id) DO NOTHING;
-- model_providers_junction
INSERT INTO public.model_providers_junction (model_id, providers_id, created_at, active, generated, mcp) VALUES ('019b3be4-36d1-7805-8d8b-9c811e4e765b', '019bb2af-b2a8-7035-bbfd-664ba627bd44', '2026-01-08T22:01:23.620772+00:00', true, false, false) ON CONFLICT (model_id, providers_id) DO NOTHING;
-- model_qualities_junction
INSERT INTO public.model_qualities_junction (active, created_at, model_id, generated, mcp, quality_id) VALUES (true, '2025-12-02T21:29:26.458277+00:00', '019b3be4-36d1-7805-8d8b-9c811e4e765b', false, false, '019bbce5-e600-7e7e-9a28-1182423e74a7') ON CONFLICT (model_id, quality_id) DO NOTHING;
-- model_values_junction
INSERT INTO public.model_values_junction (model_id, value_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7805-8d8b-9c811e4e765b', '019bbabc-5a34-78da-9358-d0924215cd17', '2025-12-02T18:34:42.754909+00:00', false, false, true) ON CONFLICT (model_id, value_id) DO NOTHING;
