-- Module: gpt-5-mini
-- Provider: openai
-- Description: openai gpt-5-mini model
-- ============================================================

-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8ea4-729c-9be4-d64362c52b0e', 'GPT-5 Mini is a faster, more efficient version of GPT-5 optimized for speed and cost.', '2025-08-12 07:52:09.591583-05', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.flags_resource (id, name, description, created_at, active, generated, mcp, type, icon) VALUES ('019be334-bfc4-7ef6-b18f-7a556d94b225', 'model_active', 'Controls whether this AI model is available for selection by agents', '2026-01-21 18:57:23.648622-06', true, false, false, 'active', 'Power') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.models_resource (created_at, value, active, generated, mcp, id, name, description, department_ids, provider_id, temperature_level_ids, reasoning_level_ids, quality_ids, voice_ids, modality_ids) VALUES ('2025-08-12 07:52:09.591583-05', 'gpt-5-mini', true, false, false, '019bb25e-e5ff-77a3-aa13-5b6303c29e2d', 'gpt-5-mini', 'GPT-5 Mini is a faster, more efficient version of GPT-5 optimized for speed and cost.', '{}', '019bb2af-b2a7-7d85-a61a-0dc4fd93b3c6', '{}', '{}', '{}', '{}', '{019bbce5-e606-77f1-abf8-78df7462af03,019bbce5-e609-750d-90c6-cb39f1266e18,019bbce5-e609-7efe-8549-87dd267f086a,019bbce5-e606-77f1-abf8-78df7462af03,019bbce5-e609-7efe-8549-87dd267f086a}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8ea2-7c81-a652-95207daadd7a', 'gpt-5-mini', '2025-08-12 07:52:09.591583-05', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.pricing_resource (id, pricing_type, price, unit_id, created_at, active, generated, mcp) VALUES ('019bbce5-e618-70bf-a5a0-4af9f941f075', 'output', 2, '019b3be4-3ced-7acb-afab-19ceef6b410b', '2026-01-14 08:25:41.899298-06', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.pricing_resource (id, pricing_type, price, unit_id, created_at, active, generated, mcp) VALUES ('019bbce5-e61b-77d4-952b-29ed47b20942', 'cached', 0.025, '019b3be4-3ced-7acb-afab-19ceef6b410b', '2026-01-14 08:25:41.899298-06', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.pricing_resource (id, pricing_type, price, unit_id, created_at, active, generated, mcp) VALUES ('019bbce5-e612-7bea-a6df-af5f0f5aeaef', 'input', 0.25, '019b3be4-3ced-7acb-afab-19ceef6b410b', '2026-01-14 08:25:41.899298-06', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.providers_resource (id, created_at, active, generated, mcp, group_id, name, description, department_ids, value, endpoint, key) VALUES ('019bb2af-b2a7-7d85-a61a-0dc4fd93b3c6', '2026-01-12 08:50:17.639595-06', true, false, false, '019bb2af-b2a2-7ce8-a499-9e78ff8f769f', 'openai', 'Provider description', '{}', 'openai', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.values_resource (id, value, created_at, active, generated, mcp) VALUES ('019bbabc-5a34-755e-a42c-b3cf4a9a3049', 'gpt-5-mini', '2025-08-12 07:52:09.591583-05', true, false, false) ON CONFLICT (id) DO NOTHING;

-- model_artifact
INSERT INTO public.model_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12 07:52:09.591583-05', '2025-08-12 07:52:09.591583-05', '019b3be4-36d1-7742-89d5-a4dabeba6ae3', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- model_descriptions_junction
INSERT INTO public.model_descriptions_junction (model_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7742-89d5-a4dabeba6ae3', '019b995c-8ea4-729c-9be4-d64362c52b0e', '2025-08-12 07:52:09.591583-05', false, false, true) ON CONFLICT (model_id, description_id) DO NOTHING;
-- model_flags_junction
INSERT INTO public.model_flags_junction (model_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7742-89d5-a4dabeba6ae3', '019be334-bfc4-7ef6-b18f-7a556d94b225', true, '2025-08-12 07:52:09.591583-05', false, false, true) ON CONFLICT (model_id, flag_id) DO NOTHING;
-- model_modalities_junction
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2025-12-02 12:34:42.759389-06', '019b3be4-36d1-7742-89d5-a4dabeba6ae3', false, false, '019bbce5-e606-77f1-abf8-78df7462af03') ON CONFLICT (model_id, modality_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2026-01-09 10:27:38.918424-06', '019b3be4-36d1-7742-89d5-a4dabeba6ae3', false, false, '019bbce5-e609-7efe-8549-87dd267f086a') ON CONFLICT (model_id, modality_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2025-12-02 12:34:42.759389-06', '019b3be4-36d1-7742-89d5-a4dabeba6ae3', false, false, '019c47d6-6c45-75f5-abd6-9cfc54b978a6') ON CONFLICT (model_id, modality_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2025-12-02 12:34:42.759389-06', '019b3be4-36d1-7742-89d5-a4dabeba6ae3', false, false, '019c47d6-6c45-754d-9669-73c9882d1a66') ON CONFLICT (model_id, modality_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2026-01-09 10:27:38.918424-06', '019b3be4-36d1-7742-89d5-a4dabeba6ae3', false, false, '019c47d6-6c45-7602-a2b1-b2a608b0cf31') ON CONFLICT (model_id, modality_id) DO NOTHING;
-- model_models_junction
INSERT INTO public.model_models_junction (model_id, models_id, active, created_at, generated, mcp) VALUES ('019b3be4-36d1-7742-89d5-a4dabeba6ae3', '019bb25e-e5ff-77a3-aa13-5b6303c29e2d', true, '2025-08-12 07:52:09.591583-05', false, false) ON CONFLICT (model_id, models_id) DO NOTHING;
-- model_names_junction
INSERT INTO public.model_names_junction (model_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7742-89d5-a4dabeba6ae3', '019b995c-8ea2-7c81-a652-95207daadd7a', '2025-08-12 07:52:09.591583-05', false, false, true) ON CONFLICT (model_id, name_id) DO NOTHING;
-- model_pricing_junction
INSERT INTO public.model_pricing_junction (active, created_at, model_id, generated, mcp, pricing_id) VALUES (true, '2025-12-02 10:56:17.373172-06', '019b3be4-36d1-7742-89d5-a4dabeba6ae3', false, false, '019bbce5-e618-70bf-a5a0-4af9f941f075') ON CONFLICT (model_id, pricing_id) DO NOTHING;
INSERT INTO public.model_pricing_junction (active, created_at, model_id, generated, mcp, pricing_id) VALUES (true, '2025-12-02 10:56:17.373015-06', '019b3be4-36d1-7742-89d5-a4dabeba6ae3', false, false, '019bbce5-e61b-77d4-952b-29ed47b20942') ON CONFLICT (model_id, pricing_id) DO NOTHING;
INSERT INTO public.model_pricing_junction (active, created_at, model_id, generated, mcp, pricing_id) VALUES (true, '2025-12-02 10:56:17.372852-06', '019b3be4-36d1-7742-89d5-a4dabeba6ae3', false, false, '019bbce5-e612-7bea-a6df-af5f0f5aeaef') ON CONFLICT (model_id, pricing_id) DO NOTHING;
-- model_providers_junction
INSERT INTO public.model_providers_junction (model_id, providers_id, created_at, active, generated, mcp) VALUES ('019b3be4-36d1-7742-89d5-a4dabeba6ae3', '019bb2af-b2a7-7d85-a61a-0dc4fd93b3c6', '2026-01-08 16:01:23.620772-06', true, false, false) ON CONFLICT (model_id, providers_id) DO NOTHING;
-- model_values_junction
INSERT INTO public.model_values_junction (model_id, value_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7742-89d5-a4dabeba6ae3', '019bbabc-5a34-755e-a42c-b3cf4a9a3049', '2025-08-12 07:52:09.591583-05', false, false, true) ON CONFLICT (model_id, value_id) DO NOTHING;
