-- Module: gpt-image-1-mini
-- Provider: openai
-- Description: openai gpt-image-1-mini model
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8ea4-728b-b381-645cfa6b3d58', 'GPT Image 1 Mini (Medium Quality) - 1024x1024 resolution. OpenAI''s compact image generation model with balanced quality and cost.', '2025-12-02T16:56:17.376858+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.models_resource (created_at, value, active, generated, mcp, id, name, description, department_ids, provider_id, temperature_level_ids, reasoning_level_ids, quality_ids, voice_ids, modality_ids) VALUES ('2025-12-02T16:56:17.376858+00:00', 'gpt-image-1-mini', true, false, false, '019bb25e-e5ff-77e7-a914-ff1714762007', 'gpt-image-1-mini', 'GPT Image 1 Mini (Medium Quality) - 1024x1024 resolution. OpenAI''s compact image generation model with balanced quality and cost.', '{}', '019bb2af-b2a7-7d85-a61a-0dc4fd93b3c6', '{}', '{}', '{019bbce5-e600-773a-ac8b-7044ffed731c}', '{}', '{019bbce5-e606-77f1-abf8-78df7462af03,019bbce5-e609-750d-90c6-cb39f1266e18,019bbce5-e609-750d-90c6-cb39f1266e18}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8ea2-7cb8-83c9-4bb2052a653d', 'gpt-image-1-mini', '2025-12-02T16:56:17.376664+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.values_resource (id, value, type, created_at, active, generated, mcp) VALUES ('019bbabc-5a34-7b4a-adc0-a92590412f69', 'gpt-image-1-mini', 'model', '2025-12-02T16:56:17.376664+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- model_artifact
INSERT INTO public.model_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-02T16:56:17.376858+00:00', '2025-12-02T16:56:17.376858+00:00', '019b3be4-36d1-786c-a2d6-39d1847d758c', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- model_descriptions_junction
INSERT INTO public.model_descriptions_junction (model_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-786c-a2d6-39d1847d758c', '019b995c-8ea4-728b-b381-645cfa6b3d58', '2025-12-02T16:56:17.376858+00:00', false, false, true) ON CONFLICT (model_id, descriptions_id) DO NOTHING;
-- model_flags_junction
INSERT INTO public.model_flags_junction (model_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-786c-a2d6-39d1847d758c', '019be334-bfc4-7ef6-b18f-7a556d94b225', '2025-12-02T16:56:17.376858+00:00', false, false, true) ON CONFLICT (model_id, flags_id) DO NOTHING;
-- model_modalities_junction
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modalities_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-786c-a2d6-39d1847d758c', false, false, '019bbce5-e609-750d-90c6-cb39f1266e18') ON CONFLICT (model_id, modalities_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modalities_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-786c-a2d6-39d1847d758c', false, false, '019c47d6-6c45-75f5-abd6-9cfc54b978a6') ON CONFLICT (model_id, modalities_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modalities_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-786c-a2d6-39d1847d758c', false, false, '019c47d6-6c45-754d-9669-73c9882d1a66') ON CONFLICT (model_id, modalities_id) DO NOTHING;
-- model_models_junction
INSERT INTO public.model_models_junction (model_id, models_id, active, created_at, generated, mcp) VALUES ('019b3be4-36d1-786c-a2d6-39d1847d758c', '019bb25e-e5ff-77e7-a914-ff1714762007', true, '2025-12-02T16:56:17.376858+00:00', false, false) ON CONFLICT (model_id, models_id) DO NOTHING;
-- model_names_junction
INSERT INTO public.model_names_junction (model_id, names_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-786c-a2d6-39d1847d758c', '019b995c-8ea2-7cb8-83c9-4bb2052a653d', '2025-12-02T16:56:17.376858+00:00', false, false, true) ON CONFLICT (model_id, names_id) DO NOTHING;
-- model_pricing_junction
INSERT INTO public.model_pricing_junction (active, created_at, model_id, generated, mcp, pricing_id) VALUES (true, '2025-12-02T16:56:17.382271+00:00', '019b3be4-36d1-786c-a2d6-39d1847d758c', false, false, '019bbce5-e615-7ef9-b521-fa267051866b') ON CONFLICT (model_id, pricing_id) DO NOTHING;
-- model_providers_junction
INSERT INTO public.model_providers_junction (model_id, providers_id, created_at, active, generated, mcp) VALUES ('019b3be4-36d1-786c-a2d6-39d1847d758c', '019bb2af-b2a7-7d85-a61a-0dc4fd93b3c6', '2026-01-08T22:01:23.620772+00:00', true, false, false) ON CONFLICT (model_id, providers_id) DO NOTHING;
-- model_qualities_junction
INSERT INTO public.model_qualities_junction (active, created_at, model_id, generated, mcp, qualities_id) VALUES (true, '2025-12-02T16:56:17.377389+00:00', '019b3be4-36d1-786c-a2d6-39d1847d758c', false, false, '019bbce5-e600-773a-ac8b-7044ffed731c') ON CONFLICT (model_id, qualities_id) DO NOTHING;
-- model_values_junction
INSERT INTO public.model_values_junction (model_id, values_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-786c-a2d6-39d1847d758c', '019bbabc-5a34-7b4a-adc0-a92590412f69', '2025-12-02T16:56:17.376858+00:00', false, false, true) ON CONFLICT (model_id, values_id) DO NOTHING;

-- Additional artifact: 019b3be4-36d1-7863-b8b8-571542d76f7e
-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8ea4-72ac-9e40-ca0aed0aedda', 'GPT Image 1 Mini (Low Quality) - 1024x1024 resolution. OpenAI''s compact image generation model optimized for cost efficiency.', '2025-12-02T16:56:17.376664+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.models_resource (created_at, value, active, generated, mcp, id, name, description, department_ids, provider_id, temperature_level_ids, reasoning_level_ids, quality_ids, voice_ids, modality_ids) VALUES ('2025-12-02T16:56:17.376664+00:00', 'gpt-image-1-mini', true, false, false, '019bb25e-e5ff-77e2-adc5-3da02dbd1fa2', 'gpt-image-1-mini', 'GPT Image 1 Mini (Low Quality) - 1024x1024 resolution. OpenAI''s compact image generation model optimized for cost efficiency.', '{}', '019bb2af-b2a7-7d85-a61a-0dc4fd93b3c6', '{}', '{}', '{019bbce5-e5ff-7197-bd68-b0ff7b7508af}', '{}', '{019bbce5-e606-77f1-abf8-78df7462af03,019bbce5-e609-750d-90c6-cb39f1266e18,019bbce5-e609-750d-90c6-cb39f1266e18}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- model_artifact
INSERT INTO public.model_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-02T16:56:17.376664+00:00', '2025-12-02T16:56:17.376664+00:00', '019b3be4-36d1-7863-b8b8-571542d76f7e', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- model_descriptions_junction
INSERT INTO public.model_descriptions_junction (model_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7863-b8b8-571542d76f7e', '019b995c-8ea4-72ac-9e40-ca0aed0aedda', '2025-12-02T16:56:17.376664+00:00', false, false, true) ON CONFLICT (model_id, descriptions_id) DO NOTHING;
-- model_flags_junction
INSERT INTO public.model_flags_junction (model_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7863-b8b8-571542d76f7e', '019be334-bfc4-7ef6-b18f-7a556d94b225', '2025-12-02T16:56:17.376664+00:00', false, false, true) ON CONFLICT (model_id, flags_id) DO NOTHING;
-- model_modalities_junction
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modalities_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-7863-b8b8-571542d76f7e', false, false, '019bbce5-e609-750d-90c6-cb39f1266e18') ON CONFLICT (model_id, modalities_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modalities_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-7863-b8b8-571542d76f7e', false, false, '019c47d6-6c45-75f5-abd6-9cfc54b978a6') ON CONFLICT (model_id, modalities_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modalities_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-7863-b8b8-571542d76f7e', false, false, '019c47d6-6c45-754d-9669-73c9882d1a66') ON CONFLICT (model_id, modalities_id) DO NOTHING;
-- model_models_junction
INSERT INTO public.model_models_junction (model_id, models_id, active, created_at, generated, mcp) VALUES ('019b3be4-36d1-7863-b8b8-571542d76f7e', '019bb25e-e5ff-77e2-adc5-3da02dbd1fa2', true, '2025-12-02T16:56:17.376664+00:00', false, false) ON CONFLICT (model_id, models_id) DO NOTHING;
-- model_names_junction
INSERT INTO public.model_names_junction (model_id, names_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7863-b8b8-571542d76f7e', '019b995c-8ea2-7cb8-83c9-4bb2052a653d', '2025-12-02T16:56:17.376664+00:00', false, false, true) ON CONFLICT (model_id, names_id) DO NOTHING;
-- model_pricing_junction
INSERT INTO public.model_pricing_junction (active, created_at, model_id, generated, mcp, pricing_id) VALUES (true, '2025-12-02T16:56:17.382103+00:00', '019b3be4-36d1-7863-b8b8-571542d76f7e', false, false, '019bbce5-e615-7c81-abb4-910688286758') ON CONFLICT (model_id, pricing_id) DO NOTHING;
-- model_providers_junction
INSERT INTO public.model_providers_junction (model_id, providers_id, created_at, active, generated, mcp) VALUES ('019b3be4-36d1-7863-b8b8-571542d76f7e', '019bb2af-b2a7-7d85-a61a-0dc4fd93b3c6', '2026-01-08T22:01:23.620772+00:00', true, false, false) ON CONFLICT (model_id, providers_id) DO NOTHING;
-- model_qualities_junction
INSERT INTO public.model_qualities_junction (active, created_at, model_id, generated, mcp, qualities_id) VALUES (true, '2025-12-02T16:56:17.377250+00:00', '019b3be4-36d1-7863-b8b8-571542d76f7e', false, false, '019bbce5-e5ff-7197-bd68-b0ff7b7508af') ON CONFLICT (model_id, qualities_id) DO NOTHING;
-- model_values_junction
INSERT INTO public.model_values_junction (model_id, values_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7863-b8b8-571542d76f7e', '019bbabc-5a34-7b4a-adc0-a92590412f69', '2025-12-02T16:56:17.376664+00:00', false, false, true) ON CONFLICT (model_id, values_id) DO NOTHING;

-- Additional artifact: 019b3be4-36d1-7878-90cc-a6edb6c268cf
-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8ea4-72de-89cc-dc2f3454b3b3', 'GPT Image 1 Mini (High Quality) - 1024x1024 resolution. OpenAI''s compact image generation model optimized for highest quality output.', '2025-12-02T16:56:17.377061+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.models_resource (created_at, value, active, generated, mcp, id, name, description, department_ids, provider_id, temperature_level_ids, reasoning_level_ids, quality_ids, voice_ids, modality_ids) VALUES ('2025-12-02T16:56:17.377061+00:00', 'gpt-image-1-mini', true, false, false, '019bb25e-e5ff-77eb-b7d0-939047cdf2b5', 'gpt-image-1-mini', 'GPT Image 1 Mini (High Quality) - 1024x1024 resolution. OpenAI''s compact image generation model optimized for highest quality output.', '{}', '019bb2af-b2a7-7d85-a61a-0dc4fd93b3c6', '{}', '{}', '{019bbce5-e600-7e7e-9a28-1182423e74a7}', '{}', '{019bbce5-e606-77f1-abf8-78df7462af03,019bbce5-e609-750d-90c6-cb39f1266e18,019bbce5-e609-750d-90c6-cb39f1266e18}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- model_artifact
INSERT INTO public.model_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-02T16:56:17.377061+00:00', '2025-12-02T16:56:17.377061+00:00', '019b3be4-36d1-7878-90cc-a6edb6c268cf', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- model_descriptions_junction
INSERT INTO public.model_descriptions_junction (model_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7878-90cc-a6edb6c268cf', '019b995c-8ea4-72de-89cc-dc2f3454b3b3', '2025-12-02T16:56:17.377061+00:00', false, false, true) ON CONFLICT (model_id, descriptions_id) DO NOTHING;
-- model_flags_junction
INSERT INTO public.model_flags_junction (model_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7878-90cc-a6edb6c268cf', '019be334-bfc4-7ef6-b18f-7a556d94b225', '2025-12-02T16:56:17.377061+00:00', false, false, true) ON CONFLICT (model_id, flags_id) DO NOTHING;
-- model_modalities_junction
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modalities_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-7878-90cc-a6edb6c268cf', false, false, '019bbce5-e609-750d-90c6-cb39f1266e18') ON CONFLICT (model_id, modalities_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modalities_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-7878-90cc-a6edb6c268cf', false, false, '019c47d6-6c45-75f5-abd6-9cfc54b978a6') ON CONFLICT (model_id, modalities_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modalities_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-7878-90cc-a6edb6c268cf', false, false, '019c47d6-6c45-754d-9669-73c9882d1a66') ON CONFLICT (model_id, modalities_id) DO NOTHING;
-- model_models_junction
INSERT INTO public.model_models_junction (model_id, models_id, active, created_at, generated, mcp) VALUES ('019b3be4-36d1-7878-90cc-a6edb6c268cf', '019bb25e-e5ff-77eb-b7d0-939047cdf2b5', true, '2025-12-02T16:56:17.377061+00:00', false, false) ON CONFLICT (model_id, models_id) DO NOTHING;
-- model_names_junction
INSERT INTO public.model_names_junction (model_id, names_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7878-90cc-a6edb6c268cf', '019b995c-8ea2-7cb8-83c9-4bb2052a653d', '2025-12-02T16:56:17.377061+00:00', false, false, true) ON CONFLICT (model_id, names_id) DO NOTHING;
-- model_pricing_junction
INSERT INTO public.model_pricing_junction (active, created_at, model_id, generated, mcp, pricing_id) VALUES (true, '2025-12-02T16:56:17.382461+00:00', '019b3be4-36d1-7878-90cc-a6edb6c268cf', false, false, '019bbce5-e616-73d7-bc0b-e58e7c5530ed') ON CONFLICT (model_id, pricing_id) DO NOTHING;
-- model_providers_junction
INSERT INTO public.model_providers_junction (model_id, providers_id, created_at, active, generated, mcp) VALUES ('019b3be4-36d1-7878-90cc-a6edb6c268cf', '019bb2af-b2a7-7d85-a61a-0dc4fd93b3c6', '2026-01-08T22:01:23.620772+00:00', true, false, false) ON CONFLICT (model_id, providers_id) DO NOTHING;
-- model_qualities_junction
INSERT INTO public.model_qualities_junction (active, created_at, model_id, generated, mcp, qualities_id) VALUES (true, '2025-12-02T16:56:17.377542+00:00', '019b3be4-36d1-7878-90cc-a6edb6c268cf', false, false, '019bbce5-e600-7e7e-9a28-1182423e74a7') ON CONFLICT (model_id, qualities_id) DO NOTHING;
-- model_values_junction
INSERT INTO public.model_values_junction (model_id, values_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7878-90cc-a6edb6c268cf', '019bbabc-5a34-7b4a-adc0-a92590412f69', '2025-12-02T16:56:17.377061+00:00', false, false, true) ON CONFLICT (model_id, values_id) DO NOTHING;
