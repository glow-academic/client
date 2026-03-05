-- Module: gpt-5-nano
-- Provider: openai
-- Description: openai gpt-5-nano model
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8ea4-729b-9a6f-ba2647473a68', 'GPT-5 Nano is the smallest and fastest GPT-5 variant, ideal for real-time applications.', '2025-08-12T12:52:09.591583+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.models_resource (created_at, value, active, generated, mcp, id, name, description, department_ids, provider_id, temperature_level_ids, reasoning_level_ids, quality_ids, voice_ids, modality_ids) VALUES ('2025-08-12T12:52:09.591583+00:00', 'gpt-5-nano', true, false, false, '019bb25e-e5ff-77a5-8183-a1c18c8babae', 'gpt-5-nano', 'GPT-5 Nano is the smallest and fastest GPT-5 variant, ideal for real-time applications.', '{}', '019bb2af-b2a7-7d85-a61a-0dc4fd93b3c6', '{}', '{}', '{}', '{}', '{019bbce5-e606-77f1-abf8-78df7462af03,019bbce5-e609-750d-90c6-cb39f1266e18,019bbce5-e609-7efe-8549-87dd267f086a,019bbce5-e606-77f1-abf8-78df7462af03,019bbce5-e609-7efe-8549-87dd267f086a}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8ea2-7ca4-a802-67604403f422', 'gpt-5-nano', '2025-08-12T12:52:09.591583+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.values_resource (id, value, created_at, active, generated, mcp) VALUES ('019bbabc-5a34-75af-a6d8-68a5bb9b8ce2', 'gpt-5-nano', '2025-08-12T12:52:09.591583+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- model_artifact
INSERT INTO public.model_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-12T12:52:09.591583+00:00', '2025-08-12T12:52:09.591583+00:00', '019b3be4-36d1-7753-88ba-93ca9b8c6ee5', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- model_descriptions_junction
INSERT INTO public.model_descriptions_junction (model_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7753-88ba-93ca9b8c6ee5', '019b995c-8ea4-729b-9a6f-ba2647473a68', '2025-08-12T12:52:09.591583+00:00', false, false, true) ON CONFLICT (model_id, descriptions_id) DO NOTHING;
-- model_flags_junction
INSERT INTO public.model_flags_junction (model_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7753-88ba-93ca9b8c6ee5', '019be334-bfc4-7ef6-b18f-7a556d94b225', '2025-08-12T12:52:09.591583+00:00', false, false, true) ON CONFLICT (model_id, flags_id) DO NOTHING;
-- model_modalities_junction
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modalities_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-7753-88ba-93ca9b8c6ee5', false, false, '019bbce5-e606-77f1-abf8-78df7462af03') ON CONFLICT (model_id, modalities_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modalities_id) VALUES (true, '2026-01-09T16:27:38.918424+00:00', '019b3be4-36d1-7753-88ba-93ca9b8c6ee5', false, false, '019bbce5-e609-7efe-8549-87dd267f086a') ON CONFLICT (model_id, modalities_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modalities_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-7753-88ba-93ca9b8c6ee5', false, false, '019c47d6-6c45-75f5-abd6-9cfc54b978a6') ON CONFLICT (model_id, modalities_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modalities_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-7753-88ba-93ca9b8c6ee5', false, false, '019c47d6-6c45-754d-9669-73c9882d1a66') ON CONFLICT (model_id, modalities_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modalities_id) VALUES (true, '2026-01-09T16:27:38.918424+00:00', '019b3be4-36d1-7753-88ba-93ca9b8c6ee5', false, false, '019c47d6-6c45-7602-a2b1-b2a608b0cf31') ON CONFLICT (model_id, modalities_id) DO NOTHING;
-- model_models_junction
INSERT INTO public.model_models_junction (model_id, models_id, active, created_at, generated, mcp) VALUES ('019b3be4-36d1-7753-88ba-93ca9b8c6ee5', '019bb25e-e5ff-77a5-8183-a1c18c8babae', true, '2025-08-12T12:52:09.591583+00:00', false, false) ON CONFLICT (model_id, models_id) DO NOTHING;
-- model_names_junction
INSERT INTO public.model_names_junction (model_id, names_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7753-88ba-93ca9b8c6ee5', '019b995c-8ea2-7ca4-a802-67604403f422', '2025-08-12T12:52:09.591583+00:00', false, false, true) ON CONFLICT (model_id, names_id) DO NOTHING;
-- model_pricing_junction
INSERT INTO public.model_pricing_junction (active, created_at, model_id, generated, mcp, pricing_id) VALUES (true, '2025-12-02T16:56:17.373655+00:00', '019b3be4-36d1-7753-88ba-93ca9b8c6ee5', false, false, '019bbce5-e617-7969-b29c-8518b3ecfa80') ON CONFLICT (model_id, pricing_id) DO NOTHING;
INSERT INTO public.model_pricing_junction (active, created_at, model_id, generated, mcp, pricing_id) VALUES (true, '2025-12-02T16:56:17.373490+00:00', '019b3be4-36d1-7753-88ba-93ca9b8c6ee5', false, false, '019bbce5-e61b-751b-8ec3-984992180842') ON CONFLICT (model_id, pricing_id) DO NOTHING;
INSERT INTO public.model_pricing_junction (active, created_at, model_id, generated, mcp, pricing_id) VALUES (true, '2025-12-02T16:56:17.373347+00:00', '019b3be4-36d1-7753-88ba-93ca9b8c6ee5', false, false, '019bbce5-e612-70a7-ab5c-535d4ec6d3c1') ON CONFLICT (model_id, pricing_id) DO NOTHING;
-- model_providers_junction
INSERT INTO public.model_providers_junction (model_id, providers_id, created_at, active, generated, mcp) VALUES ('019b3be4-36d1-7753-88ba-93ca9b8c6ee5', '019bb2af-b2a7-7d85-a61a-0dc4fd93b3c6', '2026-01-08T22:01:23.620772+00:00', true, false, false) ON CONFLICT (model_id, providers_id) DO NOTHING;
-- model_values_junction
INSERT INTO public.model_values_junction (model_id, values_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-7753-88ba-93ca9b8c6ee5', '019bbabc-5a34-75af-a6d8-68a5bb9b8ce2', '2025-08-12T12:52:09.591583+00:00', false, false, true) ON CONFLICT (model_id, values_id) DO NOTHING;
