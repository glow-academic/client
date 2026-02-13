-- Module: gemini-2.5-flash-image
-- Provider: gemini
-- Description: gemini gemini-2.5-flash-image model
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8ea4-72d1-948f-a9ed4e841d7f', 'Gemini 2.5 Flash Image is Google''s native image generation model, optimized for speed, flexibility, and contextual understanding. Text input and output is priced the same as 2.5 Flash.', '2025-12-02T16:56:17.375164+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.models_resource (created_at, value, active, generated, mcp, id, name, description, department_ids, provider_id, temperature_level_ids, reasoning_level_ids, quality_ids, voice_ids, modality_ids) VALUES ('2025-12-02T16:56:17.375164+00:00', 'gemini-2.5-flash-image', true, false, false, '019bb25e-e5ff-77bb-a0ef-84466777c5eb', 'gemini-2.5-flash-image', 'Gemini 2.5 Flash Image is Google''s native image generation model, optimized for speed, flexibility, and contextual understanding. Text input and output is priced the same as 2.5 Flash.', '{}', '019bb2af-b2a8-7035-bbfd-664ba627bd44', '{}', '{}', '{}', '{}', '{019bbce5-e606-77f1-abf8-78df7462af03,019bbce5-e609-750d-90c6-cb39f1266e18,019bbce5-e609-7efe-8549-87dd267f086a,019bbce5-e606-77f1-abf8-78df7462af03,019bbce5-e609-750d-90c6-cb39f1266e18,019bbce5-e609-7efe-8549-87dd267f086a}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8ea2-7cab-8342-ea2e9b7f3b6a', 'gemini-2.5-flash-image', '2025-12-02T16:56:17.375164+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.pricing_resource (id, pricing_type, price, unit_id, created_at, active, generated, mcp) VALUES ('019bbce5-e616-7639-bdef-fe85d318ea5d', 'output', 0.039000000804662704, '019b3be4-3ced-7b2b-8fd2-54556abd3391', '2026-01-14T14:25:41.899298+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.pricing_resource (id, pricing_type, price, unit_id, created_at, active, generated, mcp) VALUES ('019bbce5-e613-7123-884c-ce90a613ecfa', 'input', 0.30000001192092896, '019b3be4-3ced-7acb-afab-19ceef6b410b', '2026-01-14T14:25:41.899298+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.providers_resource (id, created_at, active, generated, mcp, name, description, department_ids, value, endpoint, key) VALUES ('019bb2af-b2a8-7035-bbfd-664ba627bd44', '2026-01-12T14:50:17.639595+00:00', true, false, false, 'gemini', 'Provider description', '{}', 'gemini', NULL, NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- model_artifact
INSERT INTO public.model_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-02T16:56:17.375164+00:00', '2025-12-02T16:56:17.375164+00:00', '019b3be4-36d1-77e9-a142-1caa685eefb0', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- model_descriptions_junction
INSERT INTO public.model_descriptions_junction (model_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-77e9-a142-1caa685eefb0', '019b995c-8ea4-72d1-948f-a9ed4e841d7f', '2025-12-02T16:56:17.375164+00:00', false, false, true) ON CONFLICT (model_id, description_id) DO NOTHING;
-- model_flags_junction
INSERT INTO public.model_flags_junction (model_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-77e9-a142-1caa685eefb0', '019be334-bfc4-7ef6-b18f-7a556d94b225', true, '2025-12-02T16:56:17.375164+00:00', false, false, true) ON CONFLICT (model_id, flag_id) DO NOTHING;
-- model_modalities_junction
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-77e9-a142-1caa685eefb0', false, false, '019bbce5-e609-750d-90c6-cb39f1266e18') ON CONFLICT (model_id, modality_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-77e9-a142-1caa685eefb0', false, false, '019bbce5-e606-77f1-abf8-78df7462af03') ON CONFLICT (model_id, modality_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2026-01-09T16:27:38.913183+00:00', '019b3be4-36d1-77e9-a142-1caa685eefb0', false, false, '019bbce5-e609-7efe-8549-87dd267f086a') ON CONFLICT (model_id, modality_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-77e9-a142-1caa685eefb0', false, false, '019c47d6-6c45-75f5-abd6-9cfc54b978a6') ON CONFLICT (model_id, modality_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-77e9-a142-1caa685eefb0', false, false, '019c47d6-6c45-754d-9669-73c9882d1a66') ON CONFLICT (model_id, modality_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2026-01-09T16:27:38.913183+00:00', '019b3be4-36d1-77e9-a142-1caa685eefb0', false, false, '019c47d6-6c45-7602-a2b1-b2a608b0cf31') ON CONFLICT (model_id, modality_id) DO NOTHING;
-- model_models_junction
INSERT INTO public.model_models_junction (model_id, models_id, active, created_at, generated, mcp) VALUES ('019b3be4-36d1-77e9-a142-1caa685eefb0', '019bb25e-e5ff-77bb-a0ef-84466777c5eb', true, '2025-12-02T16:56:17.375164+00:00', false, false) ON CONFLICT (model_id, models_id) DO NOTHING;
-- model_names_junction
INSERT INTO public.model_names_junction (model_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-77e9-a142-1caa685eefb0', '019b995c-8ea2-7cab-8342-ea2e9b7f3b6a', '2025-12-02T16:56:17.375164+00:00', false, false, true) ON CONFLICT (model_id, name_id) DO NOTHING;
-- model_pricing_junction
INSERT INTO public.model_pricing_junction (active, created_at, model_id, generated, mcp, pricing_id) VALUES (true, '2025-12-02T16:56:17.375669+00:00', '019b3be4-36d1-77e9-a142-1caa685eefb0', false, false, '019bbce5-e616-7639-bdef-fe85d318ea5d') ON CONFLICT (model_id, pricing_id) DO NOTHING;
INSERT INTO public.model_pricing_junction (active, created_at, model_id, generated, mcp, pricing_id) VALUES (true, '2025-12-02T16:56:17.375525+00:00', '019b3be4-36d1-77e9-a142-1caa685eefb0', false, false, '019bbce5-e613-7123-884c-ce90a613ecfa') ON CONFLICT (model_id, pricing_id) DO NOTHING;
-- model_providers_junction
INSERT INTO public.model_providers_junction (model_id, providers_id, created_at, active, generated, mcp) VALUES ('019b3be4-36d1-77e9-a142-1caa685eefb0', '019bb2af-b2a8-7035-bbfd-664ba627bd44', '2026-01-08T22:01:23.620772+00:00', true, false, false) ON CONFLICT (model_id, providers_id) DO NOTHING;
-- model_values_junction
INSERT INTO public.model_values_junction (model_id, value_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-77e9-a142-1caa685eefb0', '019bbabc-5a34-7832-8c61-b6fbd4320201', '2025-12-02T16:56:17.375164+00:00', false, false, true) ON CONFLICT (model_id, value_id) DO NOTHING;
