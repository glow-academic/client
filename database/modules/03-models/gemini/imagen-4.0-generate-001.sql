-- Module: imagen-4.0-generate-001
-- Provider: gemini
-- Description: gemini imagen-4.0-generate-001 model
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8ea4-7277-b27d-3e7c18103c3b', 'Imagen 4 Standard - Latest image generation model with significantly better text rendering and overall image quality', '2025-12-02T18:34:42.754909+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.models_resource (created_at, value, active, generated, mcp, id, name, description, department_ids, provider_id, temperature_level_ids, reasoning_level_ids, quality_ids, voice_ids, modality_ids) VALUES ('2025-12-02T18:34:42.754909+00:00', 'imagen-4.0-generate-001', true, false, false, '019bb25e-e5ff-77c8-9921-214b3fd7a6fb', 'imagen-4.0-generate-001', 'Imagen 4 Standard - Latest image generation model with significantly better text rendering and overall image quality', '{}', '019bb2af-b2a8-7035-bbfd-664ba627bd44', '{}', '{}', '{019bbce5-e600-7e7e-9a28-1182423e74a7}', '{}', '{019bbce5-e606-77f1-abf8-78df7462af03,019bbce5-e609-750d-90c6-cb39f1266e18}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8ea2-7c66-ab0d-ad961755eb4e', 'imagen-4.0-generate-001', '2025-12-02T18:34:42.754909+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.pricing_resource (id, pricing_type, price, unit_id, created_at, active, generated, mcp) VALUES ('019bbce5-e616-78c7-98da-9323f8fbe9c0', 'output', 0.03999999910593033, '019b3be4-3ced-7b2b-8fd2-54556abd3391', '2026-01-14T14:25:41.899298+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.providers_resource (id, created_at, active, generated, mcp, name, description, department_ids, value, endpoint, key) VALUES ('019bb2af-b2a8-7035-bbfd-664ba627bd44', '2026-01-12T14:50:17.639595+00:00', true, false, false, 'gemini', 'Provider description', '{}', 'gemini', NULL, NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- model_artifact
INSERT INTO public.model_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-02T18:34:42.754909+00:00', '2025-12-02T18:34:42.754909+00:00', '019b3be4-36d1-781d-9346-a9a8e2d4306d', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- model_descriptions_junction
INSERT INTO public.model_descriptions_junction (model_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-781d-9346-a9a8e2d4306d', '019b995c-8ea4-7277-b27d-3e7c18103c3b', '2025-12-02T18:34:42.754909+00:00', false, false, true) ON CONFLICT (model_id, description_id) DO NOTHING;
-- model_flags_junction
INSERT INTO public.model_flags_junction (model_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-781d-9346-a9a8e2d4306d', '019be334-bfc4-7ef6-b18f-7a556d94b225', true, '2025-12-02T18:34:42.754909+00:00', false, false, true) ON CONFLICT (model_id, flag_id) DO NOTHING;
-- model_modalities_junction
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-781d-9346-a9a8e2d4306d', false, false, '019bbce5-e609-750d-90c6-cb39f1266e18') ON CONFLICT (model_id, modality_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-781d-9346-a9a8e2d4306d', false, false, '019c47d6-6c45-754d-9669-73c9882d1a66') ON CONFLICT (model_id, modality_id) DO NOTHING;
-- model_models_junction
INSERT INTO public.model_models_junction (model_id, models_id, active, created_at, generated, mcp) VALUES ('019b3be4-36d1-781d-9346-a9a8e2d4306d', '019bb25e-e5ff-77c8-9921-214b3fd7a6fb', true, '2025-12-02T18:34:42.754909+00:00', false, false) ON CONFLICT (model_id, models_id) DO NOTHING;
-- model_names_junction
INSERT INTO public.model_names_junction (model_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-781d-9346-a9a8e2d4306d', '019b995c-8ea2-7c66-ab0d-ad961755eb4e', '2025-12-02T18:34:42.754909+00:00', false, false, true) ON CONFLICT (model_id, name_id) DO NOTHING;
-- model_pricing_junction
INSERT INTO public.model_pricing_junction (active, created_at, model_id, generated, mcp, pricing_id) VALUES (true, '2025-12-02T18:34:42.763300+00:00', '019b3be4-36d1-781d-9346-a9a8e2d4306d', false, false, '019bbce5-e616-78c7-98da-9323f8fbe9c0') ON CONFLICT (model_id, pricing_id) DO NOTHING;
-- model_providers_junction
INSERT INTO public.model_providers_junction (model_id, providers_id, created_at, active, generated, mcp) VALUES ('019b3be4-36d1-781d-9346-a9a8e2d4306d', '019bb2af-b2a8-7035-bbfd-664ba627bd44', '2026-01-08T22:01:23.620772+00:00', true, false, false) ON CONFLICT (model_id, providers_id) DO NOTHING;
-- model_qualities_junction
INSERT INTO public.model_qualities_junction (active, created_at, model_id, generated, mcp, quality_id) VALUES (true, '2025-12-02T21:29:26.459151+00:00', '019b3be4-36d1-781d-9346-a9a8e2d4306d', false, false, '019bbce5-e600-7e7e-9a28-1182423e74a7') ON CONFLICT (model_id, quality_id) DO NOTHING;
-- model_values_junction
INSERT INTO public.model_values_junction (model_id, value_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-781d-9346-a9a8e2d4306d', '019bbabc-5a34-797f-a6bd-ac67cc27d37c', '2025-12-02T18:34:42.754909+00:00', false, false, true) ON CONFLICT (model_id, value_id) DO NOTHING;
