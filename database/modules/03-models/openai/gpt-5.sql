-- Module: gpt-5
-- Provider: openai
-- Description: openai gpt-5 model
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8ea4-7285-9dd6-2176684ed4a3', 'GPT-5 is OpenAI''s latest language model with advanced reasoning and multimodal capabilities.', '2025-08-12T12:52:09.591583+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.models_resource (created_at, value, active, generated, mcp, id, name, description, department_ids, provider_id, temperature_level_ids, reasoning_level_ids, quality_ids, voice_ids, modality_ids) VALUES ('2025-08-12T12:52:09.591583+00:00', 'gpt-5', true, false, false, '019bb25e-e5ff-7781-b262-7c33d17dec4f', 'gpt-5', 'GPT-5 is OpenAI''s latest language model with advanced reasoning and multimodal capabilities.', '{}', '019bb2af-b2a7-7d85-a61a-0dc4fd93b3c6', '{019c441a-0e9f-700c-a8c5-11434dc2ea95}', '{019bb58e-0ae0-75ee-a5d0-83b15b64064e,019bb58e-0ae0-76b9-a047-a56cab0551df,019bb58e-0ae0-7674-8f88-3d599e46389c,019bb58e-0ae0-75a8-88aa-df5679daaa42,019bb58e-0ae0-7632-b146-b0bdb933c00d}', '{}', '{}', '{019bbce5-e606-77f1-abf8-78df7462af03,019bbce5-e609-750d-90c6-cb39f1266e18,019bbce5-e609-7efe-8549-87dd267f086a,019bbce5-e606-77f1-abf8-78df7462af03,019bbce5-e609-7efe-8549-87dd267f086a}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8ea2-7c93-9553-161d7730f449', 'gpt-5', '2025-08-12T12:52:09.591583+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.values_resource (id, value, created_at, active, generated, mcp) VALUES ('019bbabc-5a34-74b9-a087-2c90175618e2', 'gpt-5', '2025-08-12T12:52:09.591583+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- model_artifact
INSERT INTO public.model_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.591583+00:00', '2025-08-12T12:52:09.591583+00:00', '019b3be4-36d1-7723-9b2e-5ea00d22ad62', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- model_descriptions_junction
INSERT INTO public.model_descriptions_junction (model_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7723-9b2e-5ea00d22ad62', '019b995c-8ea4-7285-9dd6-2176684ed4a3', '2025-08-12T12:52:09.591583+00:00', false, false, true) ON CONFLICT (model_id, descriptions_id) DO NOTHING;
-- model_flags_junction
INSERT INTO public.model_flags_junction (model_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7723-9b2e-5ea00d22ad62', '019be334-bfc4-7ef6-b18f-7a556d94b225', '2025-08-12T12:52:09.591583+00:00', false, false, true) ON CONFLICT (model_id, flags_id) DO NOTHING;
-- model_modalities_junction
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modalities_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-7723-9b2e-5ea00d22ad62', false, false, '019bbce5-e606-77f1-abf8-78df7462af03') ON CONFLICT (model_id, modalities_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modalities_id) VALUES (true, '2026-01-09T16:27:38.918424+00:00', '019b3be4-36d1-7723-9b2e-5ea00d22ad62', false, false, '019bbce5-e609-7efe-8549-87dd267f086a') ON CONFLICT (model_id, modalities_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modalities_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-7723-9b2e-5ea00d22ad62', false, false, '019c47d6-6c45-75f5-abd6-9cfc54b978a6') ON CONFLICT (model_id, modalities_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modalities_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-7723-9b2e-5ea00d22ad62', false, false, '019c47d6-6c45-754d-9669-73c9882d1a66') ON CONFLICT (model_id, modalities_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modalities_id) VALUES (true, '2026-01-09T16:27:38.918424+00:00', '019b3be4-36d1-7723-9b2e-5ea00d22ad62', false, false, '019c47d6-6c45-7602-a2b1-b2a608b0cf31') ON CONFLICT (model_id, modalities_id) DO NOTHING;
-- model_models_junction
INSERT INTO public.model_models_junction (model_id, models_id, active, created_at, generated, mcp) VALUES ('019b3be4-36d1-7723-9b2e-5ea00d22ad62', '019bb25e-e5ff-7781-b262-7c33d17dec4f', true, '2025-08-12T12:52:09.591583+00:00', false, false) ON CONFLICT (model_id, models_id) DO NOTHING;
-- model_names_junction
INSERT INTO public.model_names_junction (model_id, names_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7723-9b2e-5ea00d22ad62', '019b995c-8ea2-7c93-9553-161d7730f449', '2025-08-12T12:52:09.591583+00:00', false, false, true) ON CONFLICT (model_id, names_id) DO NOTHING;
-- model_pricing_junction
INSERT INTO public.model_pricing_junction (active, created_at, model_id, generated, mcp, pricing_id) VALUES (true, '2025-12-02T16:56:17.364237+00:00', '019b3be4-36d1-7723-9b2e-5ea00d22ad62', false, false, '019bbce5-e61b-7e7f-b6cb-6d52b3735329') ON CONFLICT (model_id, pricing_id) DO NOTHING;
INSERT INTO public.model_pricing_junction (active, created_at, model_id, generated, mcp, pricing_id) VALUES (true, '2025-12-02T16:56:17.364077+00:00', '019b3be4-36d1-7723-9b2e-5ea00d22ad62', false, false, '019bbce5-e618-7a61-8daf-07ca0f11f252') ON CONFLICT (model_id, pricing_id) DO NOTHING;
INSERT INTO public.model_pricing_junction (active, created_at, model_id, generated, mcp, pricing_id) VALUES (true, '2025-12-02T16:56:17.363896+00:00', '019b3be4-36d1-7723-9b2e-5ea00d22ad62', false, false, '019bbce5-e613-7cce-9e54-d93870e9ceb0') ON CONFLICT (model_id, pricing_id) DO NOTHING;
-- model_providers_junction
INSERT INTO public.model_providers_junction (model_id, providers_id, created_at, active, generated, mcp) VALUES ('019b3be4-36d1-7723-9b2e-5ea00d22ad62', '019bb2af-b2a7-7d85-a61a-0dc4fd93b3c6', '2026-01-08T22:01:23.620772+00:00', true, false, false) ON CONFLICT (model_id, providers_id) DO NOTHING;
-- model_reasoning_levels_junction
INSERT INTO public.model_reasoning_levels_junction (model_id, reasoning_levels_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7723-9b2e-5ea00d22ad62', '019bb58e-0ae0-76b9-a047-a56cab0551df', '2026-01-13T04:12:23.674949+00:00', false, false, true) ON CONFLICT (model_id, reasoning_levels_id) DO NOTHING;
INSERT INTO public.model_reasoning_levels_junction (model_id, reasoning_levels_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7723-9b2e-5ea00d22ad62', '019bb58e-0ae0-7674-8f88-3d599e46389c', '2026-01-13T04:12:23.674949+00:00', false, false, true) ON CONFLICT (model_id, reasoning_levels_id) DO NOTHING;
INSERT INTO public.model_reasoning_levels_junction (model_id, reasoning_levels_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7723-9b2e-5ea00d22ad62', '019bb58e-0ae0-75a8-88aa-df5679daaa42', '2026-01-13T04:12:23.674949+00:00', false, false, true) ON CONFLICT (model_id, reasoning_levels_id) DO NOTHING;
INSERT INTO public.model_reasoning_levels_junction (model_id, reasoning_levels_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7723-9b2e-5ea00d22ad62', '019bb58e-0ae0-7632-b146-b0bdb933c00d', '2026-01-13T04:12:23.674949+00:00', false, false, true) ON CONFLICT (model_id, reasoning_levels_id) DO NOTHING;
INSERT INTO public.model_reasoning_levels_junction (model_id, reasoning_levels_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7723-9b2e-5ea00d22ad62', '019bb58e-0ae0-75ee-a5d0-83b15b64064e', '2026-01-13T04:12:23.674949+00:00', false, false, true) ON CONFLICT (model_id, reasoning_levels_id) DO NOTHING;
-- model_temperature_levels_junction
INSERT INTO public.model_temperature_levels_junction (model_id, temperature_levels_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7723-9b2e-5ea00d22ad62', '019c441a-0e9f-700c-a8c5-11434dc2ea95', '2026-02-09T20:31:24.300107+00:00', false, false, true) ON CONFLICT (model_id, temperature_levels_id) DO NOTHING;
-- model_values_junction
INSERT INTO public.model_values_junction (model_id, values_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7723-9b2e-5ea00d22ad62', '019bbabc-5a34-74b9-a087-2c90175618e2', '2025-08-12T12:52:09.591583+00:00', false, false, true) ON CONFLICT (model_id, values_id) DO NOTHING;
