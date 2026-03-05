-- Module: gemini-2.5-pro
-- Provider: gemini
-- Description: gemini gemini-2.5-pro model
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8ea4-7293-bd8c-fd229ad1fffa', 'Gemini 2.5 Pro is Google''s most advanced language model with enhanced reasoning and multimodal capabilities. Pricing shown is for context windows ≤200k tokens.', '2025-08-12T12:52:09.591583+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.models_resource (created_at, value, active, generated, mcp, id, name, description, department_ids, provider_id, temperature_level_ids, reasoning_level_ids, quality_ids, voice_ids, modality_ids) VALUES ('2025-08-12T12:52:09.591583+00:00', 'gemini-2.5-pro', true, false, false, '019bb25e-e5ff-779a-b9b5-c93219bb3547', 'gemini-2.5-pro', 'Gemini 2.5 Pro is Google''s most advanced language model with enhanced reasoning and multimodal capabilities. Pricing shown is for context windows ≤200k tokens.', '{}', '019bb2af-b2a8-7035-bbfd-664ba627bd44', '{}', '{}', '{}', '{}', '{019bbce5-e608-7d5a-b937-0a22697e3f8b,019bbce5-e606-77f1-abf8-78df7462af03,019bbce5-e609-750d-90c6-cb39f1266e18,019bbce5-e607-7bc4-a6b0-a4218bc8e5f8,019bbce5-e609-7efe-8549-87dd267f086a,019bbce5-e606-77f1-abf8-78df7462af03,019bbce5-e609-7efe-8549-87dd267f086a}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8ea2-7cc3-a8b6-3b42fc5e0bbc', 'gemini-2.5-pro', '2025-08-12T12:52:09.591583+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.values_resource (id, value, created_at, active, generated, mcp) VALUES ('019bbabc-5a34-7257-9013-5d14ee4ab64a', 'gemini-2.5-pro', '2025-08-12T12:52:09.591583+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- model_artifact
INSERT INTO public.model_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.591583+00:00', '2025-08-12T12:52:09.591583+00:00', '019b3be4-36cd-7883-b878-cf77e61f5906', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- model_descriptions_junction
INSERT INTO public.model_descriptions_junction (model_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-36cd-7883-b878-cf77e61f5906', '019b995c-8ea4-7293-bd8c-fd229ad1fffa', '2025-08-12T12:52:09.591583+00:00', false, false, true) ON CONFLICT (model_id, description_id) DO NOTHING;
-- model_flags_junction
INSERT INTO public.model_flags_junction (model_id, flag_id, created_at, generated, mcp, active) VALUES ('019b3be4-36cd-7883-b878-cf77e61f5906', '019be334-bfc4-7ef6-b18f-7a556d94b225', '2025-08-12T12:52:09.591583+00:00', false, false, true) ON CONFLICT (model_id, flag_id) DO NOTHING;
-- model_modalities_junction
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36cd-7883-b878-cf77e61f5906', false, false, '019bbce5-e606-77f1-abf8-78df7462af03') ON CONFLICT (model_id, modality_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2026-01-09T16:27:38.913183+00:00', '019b3be4-36cd-7883-b878-cf77e61f5906', false, false, '019bbce5-e609-7efe-8549-87dd267f086a') ON CONFLICT (model_id, modality_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36cd-7883-b878-cf77e61f5906', false, false, '019c47d6-6c45-75df-923a-6b23040e63b3') ON CONFLICT (model_id, modality_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36cd-7883-b878-cf77e61f5906', false, false, '019c47d6-6c45-75ed-b882-53a18d4f5db6') ON CONFLICT (model_id, modality_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36cd-7883-b878-cf77e61f5906', false, false, '019c47d6-6c45-75f5-abd6-9cfc54b978a6') ON CONFLICT (model_id, modality_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36cd-7883-b878-cf77e61f5906', false, false, '019c47d6-6c45-754d-9669-73c9882d1a66') ON CONFLICT (model_id, modality_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2026-01-09T16:27:38.913183+00:00', '019b3be4-36cd-7883-b878-cf77e61f5906', false, false, '019c47d6-6c45-7602-a2b1-b2a608b0cf31') ON CONFLICT (model_id, modality_id) DO NOTHING;
-- model_models_junction
INSERT INTO public.model_models_junction (model_id, models_id, active, created_at, generated, mcp) VALUES ('019b3be4-36cd-7883-b878-cf77e61f5906', '019bb25e-e5ff-779a-b9b5-c93219bb3547', true, '2025-08-12T12:52:09.591583+00:00', false, false) ON CONFLICT (model_id, models_id) DO NOTHING;
-- model_names_junction
INSERT INTO public.model_names_junction (model_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-36cd-7883-b878-cf77e61f5906', '019b995c-8ea2-7cc3-a8b6-3b42fc5e0bbc', '2025-08-12T12:52:09.591583+00:00', false, false, true) ON CONFLICT (model_id, name_id) DO NOTHING;
-- model_pricing_junction
INSERT INTO public.model_pricing_junction (active, created_at, model_id, generated, mcp, pricing_id) VALUES (true, '2025-12-02T16:56:17.366211+00:00', '019b3be4-36cd-7883-b878-cf77e61f5906', false, false, '019bbce5-e619-71a6-805e-be8916a1565e') ON CONFLICT (model_id, pricing_id) DO NOTHING;
INSERT INTO public.model_pricing_junction (active, created_at, model_id, generated, mcp, pricing_id) VALUES (true, '2025-12-02T16:56:17.366043+00:00', '019b3be4-36cd-7883-b878-cf77e61f5906', false, false, '019bbce5-e618-7cbd-ba98-7b0d3adc15b3') ON CONFLICT (model_id, pricing_id) DO NOTHING;
INSERT INTO public.model_pricing_junction (active, created_at, model_id, generated, mcp, pricing_id) VALUES (true, '2025-12-02T16:56:17.365904+00:00', '019b3be4-36cd-7883-b878-cf77e61f5906', false, false, '019bbce5-e614-7dba-bfc7-104348e5a45e') ON CONFLICT (model_id, pricing_id) DO NOTHING;
INSERT INTO public.model_pricing_junction (active, created_at, model_id, generated, mcp, pricing_id) VALUES (true, '2025-12-02T16:56:17.365751+00:00', '019b3be4-36cd-7883-b878-cf77e61f5906', false, false, '019bbce5-e613-7f49-90e2-722d3188bb30') ON CONFLICT (model_id, pricing_id) DO NOTHING;
-- model_providers_junction
INSERT INTO public.model_providers_junction (model_id, providers_id, created_at, active, generated, mcp) VALUES ('019b3be4-36cd-7883-b878-cf77e61f5906', '019bb2af-b2a8-7035-bbfd-664ba627bd44', '2026-01-08T22:01:23.620772+00:00', true, false, false) ON CONFLICT (model_id, providers_id) DO NOTHING;
-- model_values_junction
INSERT INTO public.model_values_junction (model_id, value_id, created_at, generated, mcp, active) VALUES ('019b3be4-36cd-7883-b878-cf77e61f5906', '019bbabc-5a34-7257-9013-5d14ee4ab64a', '2025-08-12T12:52:09.591583+00:00', false, false, true) ON CONFLICT (model_id, value_id) DO NOTHING;
