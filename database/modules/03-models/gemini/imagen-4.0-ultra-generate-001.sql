-- Module: imagen-4.0-ultra-generate-001
-- Provider: gemini
-- Description: gemini imagen-4.0-ultra-generate-001 model
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8ea4-72c7-8d80-8bae3d99f783', 'Imagen 4 Ultra - Highest quality variant of Imagen 4 image generation model', '2025-12-02T18:34:42.754909+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.models_resource (created_at, value, active, generated, mcp, id, name, description, department_ids, provider_id, temperature_level_ids, reasoning_level_ids, quality_ids, voice_ids, modality_ids) VALUES ('2025-12-02T18:34:42.754909+00:00', 'imagen-4.0-ultra-generate-001', true, false, false, '019bb25e-e5ff-77d0-a1f1-5add7db366d4', 'imagen-4.0-ultra-generate-001', 'Imagen 4 Ultra - Highest quality variant of Imagen 4 image generation model', '{}', '019bb2af-b2a8-7035-bbfd-664ba627bd44', '{}', '{}', '{019bbce5-e5ff-7197-bd68-b0ff7b7508af}', '{}', '{019bbce5-e606-77f1-abf8-78df7462af03,019bbce5-e609-750d-90c6-cb39f1266e18}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8ea2-7cbf-b07e-eced50ebf906', 'imagen-4.0-ultra-generate-001', '2025-12-02T18:34:42.754909+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.pricing_resource (id, pricing_type, price, unit_id, created_at, active, generated, mcp) VALUES ('019bbce5-e616-7d80-9151-67a90c90a6a2', 'output', 0.05999999865889549, '019b3be4-3ced-7b2b-8fd2-54556abd3391', '2026-01-14T14:25:41.899298+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.providers_resource (id, created_at, active, generated, mcp, name, description, department_ids, value, endpoint, key) VALUES ('019bb2af-b2a8-7035-bbfd-664ba627bd44', '2026-01-12T14:50:17.639595+00:00', true, false, false, 'gemini', 'Provider description', '{}', 'gemini', NULL, NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- model_artifact
INSERT INTO public.model_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-02T18:34:42.754909+00:00', '2025-12-02T18:34:42.754909+00:00', '019b3be4-36d1-7837-84df-b45edebc4ee5', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- model_descriptions_junction
INSERT INTO public.model_descriptions_junction (model_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7837-84df-b45edebc4ee5', '019b995c-8ea4-72c7-8d80-8bae3d99f783', '2025-12-02T18:34:42.754909+00:00', false, false, true) ON CONFLICT (model_id, description_id) DO NOTHING;
-- model_flags_junction
INSERT INTO public.model_flags_junction (model_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7837-84df-b45edebc4ee5', '019be334-bfc4-7ef6-b18f-7a556d94b225', true, '2025-12-02T18:34:42.754909+00:00', false, false, true) ON CONFLICT (model_id, flag_id) DO NOTHING;
-- model_modalities_junction
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-7837-84df-b45edebc4ee5', false, false, '019bbce5-e609-750d-90c6-cb39f1266e18') ON CONFLICT (model_id, modality_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-7837-84df-b45edebc4ee5', false, false, '019c47d6-6c45-754d-9669-73c9882d1a66') ON CONFLICT (model_id, modality_id) DO NOTHING;
-- model_models_junction
INSERT INTO public.model_models_junction (model_id, models_id, active, created_at, generated, mcp) VALUES ('019b3be4-36d1-7837-84df-b45edebc4ee5', '019bb25e-e5ff-77d0-a1f1-5add7db366d4', true, '2025-12-02T18:34:42.754909+00:00', false, false) ON CONFLICT (model_id, models_id) DO NOTHING;
-- model_names_junction
INSERT INTO public.model_names_junction (model_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7837-84df-b45edebc4ee5', '019b995c-8ea2-7cbf-b07e-eced50ebf906', '2025-12-02T18:34:42.754909+00:00', false, false, true) ON CONFLICT (model_id, name_id) DO NOTHING;
-- model_pricing_junction
INSERT INTO public.model_pricing_junction (active, created_at, model_id, generated, mcp, pricing_id) VALUES (true, '2025-12-02T18:34:42.763300+00:00', '019b3be4-36d1-7837-84df-b45edebc4ee5', false, false, '019bbce5-e616-7d80-9151-67a90c90a6a2') ON CONFLICT (model_id, pricing_id) DO NOTHING;
-- model_providers_junction
INSERT INTO public.model_providers_junction (model_id, providers_id, created_at, active, generated, mcp) VALUES ('019b3be4-36d1-7837-84df-b45edebc4ee5', '019bb2af-b2a8-7035-bbfd-664ba627bd44', '2026-01-08T22:01:23.620772+00:00', true, false, false) ON CONFLICT (model_id, providers_id) DO NOTHING;
-- model_qualities_junction
INSERT INTO public.model_qualities_junction (active, created_at, model_id, generated, mcp, quality_id) VALUES (true, '2025-12-02T21:29:26.459151+00:00', '019b3be4-36d1-7837-84df-b45edebc4ee5', false, false, '019bbce5-e5ff-7197-bd68-b0ff7b7508af') ON CONFLICT (model_id, quality_id) DO NOTHING;
-- model_values_junction
INSERT INTO public.model_values_junction (model_id, value_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7837-84df-b45edebc4ee5', '019bbabc-5a34-7a24-9b06-52c4d3ed167c', '2025-12-02T18:34:42.754909+00:00', false, false, true) ON CONFLICT (model_id, value_id) DO NOTHING;
