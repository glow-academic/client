-- Module: gpt-image-1
-- Provider: openai
-- Description: openai gpt-image-1 model
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8ea4-72d5-8617-594eb0d07730', 'GPT Image 1 (High Quality) - 1024x1024 resolution. OpenAI''s image generation model optimized for highest quality output.', '2025-12-02T16:56:17.371126+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.models_resource (created_at, value, active, generated, mcp, id, name, description, department_ids, provider_id, temperature_level_ids, reasoning_level_ids, quality_ids, voice_ids, modality_ids) VALUES ('2025-12-02T16:56:17.371126+00:00', 'gpt-image-1', true, false, false, '019bb25e-e5ff-77dd-a27a-6f8c72e2aa10', 'gpt-image-1', 'GPT Image 1 (High Quality) - 1024x1024 resolution. OpenAI''s image generation model optimized for highest quality output.', '{}', '019bb2af-b2a7-7d85-a61a-0dc4fd93b3c6', '{}', '{}', '{019bbce5-e600-7e7e-9a28-1182423e74a7}', '{}', '{019bbce5-e606-77f1-abf8-78df7462af03,019bbce5-e609-750d-90c6-cb39f1266e18,019bbce5-e609-750d-90c6-cb39f1266e18}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8ea2-7ca0-b153-931da466ac2e', 'gpt-image-1', '2025-12-02T16:56:17.370573+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.pricing_resource (id, pricing_type, price, unit_id, created_at, active, generated, mcp) VALUES ('019bbce5-e617-748c-abcb-8642f1d3f0c0', 'output', 0.16699999570846558, '019b3be4-3ced-7b2b-8fd2-54556abd3391', '2026-01-14T14:25:41.899298+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.providers_resource (id, created_at, active, generated, mcp, group_id, name, description, department_ids, value, endpoint, key) VALUES ('019bb2af-b2a7-7d85-a61a-0dc4fd93b3c6', '2026-01-12T14:50:17.639595+00:00', true, false, false, '019bb2af-b2a2-7ce8-a499-9e78ff8f769f', 'openai', 'Provider description', '{}', 'openai', NULL, NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- model_artifact
INSERT INTO public.model_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-02T16:56:17.371126+00:00', '2025-12-02T16:56:17.371126+00:00', '019b3be4-36d1-785a-afe5-6f3a911cdf01', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- model_descriptions_junction
INSERT INTO public.model_descriptions_junction (model_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-785a-afe5-6f3a911cdf01', '019b995c-8ea4-72d5-8617-594eb0d07730', '2025-12-02T16:56:17.371126+00:00', false, false, true) ON CONFLICT (model_id, description_id) DO NOTHING;
-- model_flags_junction
INSERT INTO public.model_flags_junction (model_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-785a-afe5-6f3a911cdf01', '019be334-bfc4-7ef6-b18f-7a556d94b225', true, '2025-12-02T16:56:17.371126+00:00', false, false, true) ON CONFLICT (model_id, flag_id) DO NOTHING;
-- model_modalities_junction
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-785a-afe5-6f3a911cdf01', false, false, '019bbce5-e609-750d-90c6-cb39f1266e18') ON CONFLICT (model_id, modality_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-785a-afe5-6f3a911cdf01', false, false, '019c47d6-6c45-75f5-abd6-9cfc54b978a6') ON CONFLICT (model_id, modality_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-785a-afe5-6f3a911cdf01', false, false, '019c47d6-6c45-754d-9669-73c9882d1a66') ON CONFLICT (model_id, modality_id) DO NOTHING;
-- model_models_junction
INSERT INTO public.model_models_junction (model_id, models_id, active, created_at, generated, mcp) VALUES ('019b3be4-36d1-785a-afe5-6f3a911cdf01', '019bb25e-e5ff-77dd-a27a-6f8c72e2aa10', true, '2025-12-02T16:56:17.371126+00:00', false, false) ON CONFLICT (model_id, models_id) DO NOTHING;
-- model_names_junction
INSERT INTO public.model_names_junction (model_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-785a-afe5-6f3a911cdf01', '019b995c-8ea2-7ca0-b153-931da466ac2e', '2025-12-02T16:56:17.371126+00:00', false, false, true) ON CONFLICT (model_id, name_id) DO NOTHING;
-- model_pricing_junction
INSERT INTO public.model_pricing_junction (active, created_at, model_id, generated, mcp, pricing_id) VALUES (true, '2025-12-02T16:56:17.372217+00:00', '019b3be4-36d1-785a-afe5-6f3a911cdf01', false, false, '019bbce5-e617-748c-abcb-8642f1d3f0c0') ON CONFLICT (model_id, pricing_id) DO NOTHING;
-- model_providers_junction
INSERT INTO public.model_providers_junction (model_id, providers_id, created_at, active, generated, mcp) VALUES ('019b3be4-36d1-785a-afe5-6f3a911cdf01', '019bb2af-b2a7-7d85-a61a-0dc4fd93b3c6', '2026-01-08T22:01:23.620772+00:00', true, false, false) ON CONFLICT (model_id, providers_id) DO NOTHING;
-- model_qualities_junction
INSERT INTO public.model_qualities_junction (active, created_at, model_id, generated, mcp, quality_id) VALUES (true, '2025-12-02T16:56:17.371697+00:00', '019b3be4-36d1-785a-afe5-6f3a911cdf01', false, false, '019bbce5-e600-7e7e-9a28-1182423e74a7') ON CONFLICT (model_id, quality_id) DO NOTHING;
-- model_values_junction
INSERT INTO public.model_values_junction (model_id, value_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-785a-afe5-6f3a911cdf01', '019bbabc-5a34-7a82-861f-6ef1389a25f9', '2025-12-02T16:56:17.371126+00:00', false, false, true) ON CONFLICT (model_id, value_id) DO NOTHING;

-- Additional artifact: 019b3be4-36d1-784d-9178-3cc9adfe3bc8
-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8ea4-7297-9aec-f50ee8de3907', 'GPT Image 1 (Medium Quality) - 1024x1024 resolution. OpenAI''s image generation model with balanced quality and cost.', '2025-12-02T16:56:17.370905+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.models_resource (created_at, value, active, generated, mcp, id, name, description, department_ids, provider_id, temperature_level_ids, reasoning_level_ids, quality_ids, voice_ids, modality_ids) VALUES ('2025-12-02T16:56:17.370905+00:00', 'gpt-image-1', true, false, false, '019bb25e-e5ff-77d9-806a-9daf3f56d064', 'gpt-image-1', 'GPT Image 1 (Medium Quality) - 1024x1024 resolution. OpenAI''s image generation model with balanced quality and cost.', '{}', '019bb2af-b2a7-7d85-a61a-0dc4fd93b3c6', '{}', '{}', '{019bbce5-e600-773a-ac8b-7044ffed731c}', '{}', '{019bbce5-e606-77f1-abf8-78df7462af03,019bbce5-e609-750d-90c6-cb39f1266e18,019bbce5-e609-750d-90c6-cb39f1266e18}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.pricing_resource (id, pricing_type, price, unit_id, created_at, active, generated, mcp) VALUES ('019bbce5-e616-7b20-8526-c014d3ef1b3d', 'output', 0.041999999433755875, '019b3be4-3ced-7b2b-8fd2-54556abd3391', '2026-01-14T14:25:41.899298+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- model_artifact
INSERT INTO public.model_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-02T16:56:17.370905+00:00', '2025-12-02T16:56:17.370905+00:00', '019b3be4-36d1-784d-9178-3cc9adfe3bc8', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- model_descriptions_junction
INSERT INTO public.model_descriptions_junction (model_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-784d-9178-3cc9adfe3bc8', '019b995c-8ea4-7297-9aec-f50ee8de3907', '2025-12-02T16:56:17.370905+00:00', false, false, true) ON CONFLICT (model_id, description_id) DO NOTHING;
-- model_flags_junction
INSERT INTO public.model_flags_junction (model_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-784d-9178-3cc9adfe3bc8', '019be334-bfc4-7ef6-b18f-7a556d94b225', true, '2025-12-02T16:56:17.370905+00:00', false, false, true) ON CONFLICT (model_id, flag_id) DO NOTHING;
-- model_modalities_junction
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-784d-9178-3cc9adfe3bc8', false, false, '019bbce5-e609-750d-90c6-cb39f1266e18') ON CONFLICT (model_id, modality_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-784d-9178-3cc9adfe3bc8', false, false, '019c47d6-6c45-75f5-abd6-9cfc54b978a6') ON CONFLICT (model_id, modality_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-784d-9178-3cc9adfe3bc8', false, false, '019c47d6-6c45-754d-9669-73c9882d1a66') ON CONFLICT (model_id, modality_id) DO NOTHING;
-- model_models_junction
INSERT INTO public.model_models_junction (model_id, models_id, active, created_at, generated, mcp) VALUES ('019b3be4-36d1-784d-9178-3cc9adfe3bc8', '019bb25e-e5ff-77d9-806a-9daf3f56d064', true, '2025-12-02T16:56:17.370905+00:00', false, false) ON CONFLICT (model_id, models_id) DO NOTHING;
-- model_names_junction
INSERT INTO public.model_names_junction (model_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-784d-9178-3cc9adfe3bc8', '019b995c-8ea2-7ca0-b153-931da466ac2e', '2025-12-02T16:56:17.370905+00:00', false, false, true) ON CONFLICT (model_id, name_id) DO NOTHING;
-- model_pricing_junction
INSERT INTO public.model_pricing_junction (active, created_at, model_id, generated, mcp, pricing_id) VALUES (true, '2025-12-02T16:56:17.372064+00:00', '019b3be4-36d1-784d-9178-3cc9adfe3bc8', false, false, '019bbce5-e616-7b20-8526-c014d3ef1b3d') ON CONFLICT (model_id, pricing_id) DO NOTHING;
-- model_providers_junction
INSERT INTO public.model_providers_junction (model_id, providers_id, created_at, active, generated, mcp) VALUES ('019b3be4-36d1-784d-9178-3cc9adfe3bc8', '019bb2af-b2a7-7d85-a61a-0dc4fd93b3c6', '2026-01-08T22:01:23.620772+00:00', true, false, false) ON CONFLICT (model_id, providers_id) DO NOTHING;
-- model_qualities_junction
INSERT INTO public.model_qualities_junction (active, created_at, model_id, generated, mcp, quality_id) VALUES (true, '2025-12-02T16:56:17.371535+00:00', '019b3be4-36d1-784d-9178-3cc9adfe3bc8', false, false, '019bbce5-e600-773a-ac8b-7044ffed731c') ON CONFLICT (model_id, quality_id) DO NOTHING;
-- model_values_junction
INSERT INTO public.model_values_junction (model_id, value_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-784d-9178-3cc9adfe3bc8', '019bbabc-5a34-7a82-861f-6ef1389a25f9', '2025-12-02T16:56:17.370905+00:00', false, false, true) ON CONFLICT (model_id, value_id) DO NOTHING;

-- Additional artifact: 019b3be4-36d1-7843-b885-a22e09d514e3
-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8ea4-7273-a77b-83ace387976f', 'GPT Image 1 (Low Quality) - 1024x1024 resolution. OpenAI''s image generation model optimized for cost efficiency.', '2025-12-02T16:56:17.370573+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.models_resource (created_at, value, active, generated, mcp, id, name, description, department_ids, provider_id, temperature_level_ids, reasoning_level_ids, quality_ids, voice_ids, modality_ids) VALUES ('2025-12-02T16:56:17.370573+00:00', 'gpt-image-1', true, false, false, '019bb25e-e5ff-77d4-af60-27640d3a8c6c', 'gpt-image-1', 'GPT Image 1 (Low Quality) - 1024x1024 resolution. OpenAI''s image generation model optimized for cost efficiency.', '{}', '019bb2af-b2a7-7d85-a61a-0dc4fd93b3c6', '{}', '{}', '{019bbce5-e5ff-7197-bd68-b0ff7b7508af}', '{}', '{019bbce5-e606-77f1-abf8-78df7462af03,019bbce5-e609-750d-90c6-cb39f1266e18,019bbce5-e609-750d-90c6-cb39f1266e18}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.pricing_resource (id, pricing_type, price, unit_id, created_at, active, generated, mcp) VALUES ('019bbce5-e615-7ef9-b521-fa267051866b', 'output', 0.010999999940395355, '019b3be4-3ced-7b2b-8fd2-54556abd3391', '2026-01-14T14:25:41.899298+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- model_artifact
INSERT INTO public.model_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-02T16:56:17.370573+00:00', '2025-12-02T16:56:17.370573+00:00', '019b3be4-36d1-7843-b885-a22e09d514e3', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- model_descriptions_junction
INSERT INTO public.model_descriptions_junction (model_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7843-b885-a22e09d514e3', '019b995c-8ea4-7273-a77b-83ace387976f', '2025-12-02T16:56:17.370573+00:00', false, false, true) ON CONFLICT (model_id, description_id) DO NOTHING;
-- model_flags_junction
INSERT INTO public.model_flags_junction (model_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7843-b885-a22e09d514e3', '019be334-bfc4-7ef6-b18f-7a556d94b225', true, '2025-12-02T16:56:17.370573+00:00', false, false, true) ON CONFLICT (model_id, flag_id) DO NOTHING;
-- model_modalities_junction
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-7843-b885-a22e09d514e3', false, false, '019bbce5-e609-750d-90c6-cb39f1266e18') ON CONFLICT (model_id, modality_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-7843-b885-a22e09d514e3', false, false, '019c47d6-6c45-75f5-abd6-9cfc54b978a6') ON CONFLICT (model_id, modality_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-7843-b885-a22e09d514e3', false, false, '019c47d6-6c45-754d-9669-73c9882d1a66') ON CONFLICT (model_id, modality_id) DO NOTHING;
-- model_models_junction
INSERT INTO public.model_models_junction (model_id, models_id, active, created_at, generated, mcp) VALUES ('019b3be4-36d1-7843-b885-a22e09d514e3', '019bb25e-e5ff-77d4-af60-27640d3a8c6c', true, '2025-12-02T16:56:17.370573+00:00', false, false) ON CONFLICT (model_id, models_id) DO NOTHING;
-- model_names_junction
INSERT INTO public.model_names_junction (model_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7843-b885-a22e09d514e3', '019b995c-8ea2-7ca0-b153-931da466ac2e', '2025-12-02T16:56:17.370573+00:00', false, false, true) ON CONFLICT (model_id, name_id) DO NOTHING;
-- model_pricing_junction
INSERT INTO public.model_pricing_junction (active, created_at, model_id, generated, mcp, pricing_id) VALUES (true, '2025-12-02T16:56:17.371852+00:00', '019b3be4-36d1-7843-b885-a22e09d514e3', false, false, '019bbce5-e615-7ef9-b521-fa267051866b') ON CONFLICT (model_id, pricing_id) DO NOTHING;
-- model_providers_junction
INSERT INTO public.model_providers_junction (model_id, providers_id, created_at, active, generated, mcp) VALUES ('019b3be4-36d1-7843-b885-a22e09d514e3', '019bb2af-b2a7-7d85-a61a-0dc4fd93b3c6', '2026-01-08T22:01:23.620772+00:00', true, false, false) ON CONFLICT (model_id, providers_id) DO NOTHING;
-- model_qualities_junction
INSERT INTO public.model_qualities_junction (active, created_at, model_id, generated, mcp, quality_id) VALUES (true, '2025-12-02T16:56:17.371335+00:00', '019b3be4-36d1-7843-b885-a22e09d514e3', false, false, '019bbce5-e5ff-7197-bd68-b0ff7b7508af') ON CONFLICT (model_id, quality_id) DO NOTHING;
-- model_values_junction
INSERT INTO public.model_values_junction (model_id, value_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7843-b885-a22e09d514e3', '019bbabc-5a34-7a82-861f-6ef1389a25f9', '2025-12-02T16:56:17.370573+00:00', false, false, true) ON CONFLICT (model_id, value_id) DO NOTHING;
