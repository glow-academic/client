-- Module: imagen-4.0-fast-generate-001
-- Provider: gemini
-- Description: gemini imagen-4.0-fast-generate-001 model
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8ea4-72b2-a268-367706e9c6b9', 'Imagen 4 Fast - Faster variant of Imagen 4 image generation model', '2025-12-02T18:34:42.754909+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.models_resource (created_at, value, active, generated, mcp, id, name, description, department_ids, provider_id, temperature_level_ids, reasoning_level_ids, quality_ids, voice_ids, modality_ids) VALUES ('2025-12-02T18:34:42.754909+00:00', 'imagen-4.0-fast-generate-001', true, false, false, '019bb25e-e5ff-77ce-b103-3e01f7a3d784', 'imagen-4.0-fast-generate-001', 'Imagen 4 Fast - Faster variant of Imagen 4 image generation model', '{}', '019bb2af-b2a8-7035-bbfd-664ba627bd44', '{}', '{}', '{019bbce5-e600-773a-ac8b-7044ffed731c}', '{}', '{019bbce5-e606-77f1-abf8-78df7462af03,019bbce5-e609-750d-90c6-cb39f1266e18}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8ea2-7caf-9dee-4f6dd762ca58', 'imagen-4.0-fast-generate-001', '2025-12-02T18:34:42.754909+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.values_resource (id, value, created_at, active, generated, mcp) VALUES ('019bbabc-5a34-79d0-8db1-25b978aa4464', 'imagen-4.0-fast-generate-001', '2025-12-02T18:34:42.754909+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- model_artifact
INSERT INTO public.model_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-02T18:34:42.754909+00:00', '2025-12-02T18:34:42.754909+00:00', '019b3be4-36d1-782b-9f07-7b368cadc1f1', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- model_descriptions_junction
INSERT INTO public.model_descriptions_junction (model_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-782b-9f07-7b368cadc1f1', '019b995c-8ea4-72b2-a268-367706e9c6b9', '2025-12-02T18:34:42.754909+00:00', false, false, true) ON CONFLICT (model_id, descriptions_id) DO NOTHING;
-- model_flags_junction
INSERT INTO public.model_flags_junction (model_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-782b-9f07-7b368cadc1f1', '019be334-bfc4-7ef6-b18f-7a556d94b225', '2025-12-02T18:34:42.754909+00:00', false, false, true) ON CONFLICT (model_id, flags_id) DO NOTHING;
-- model_modalities_junction
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modalities_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-782b-9f07-7b368cadc1f1', false, false, '019bbce5-e609-750d-90c6-cb39f1266e18') ON CONFLICT (model_id, modalities_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modalities_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36d1-782b-9f07-7b368cadc1f1', false, false, '019c47d6-6c45-754d-9669-73c9882d1a66') ON CONFLICT (model_id, modalities_id) DO NOTHING;
-- model_models_junction
INSERT INTO public.model_models_junction (model_id, models_id, active, created_at, generated, mcp) VALUES ('019b3be4-36d1-782b-9f07-7b368cadc1f1', '019bb25e-e5ff-77ce-b103-3e01f7a3d784', true, '2025-12-02T18:34:42.754909+00:00', false, false) ON CONFLICT (model_id, models_id) DO NOTHING;
-- model_names_junction
INSERT INTO public.model_names_junction (model_id, names_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-782b-9f07-7b368cadc1f1', '019b995c-8ea2-7caf-9dee-4f6dd762ca58', '2025-12-02T18:34:42.754909+00:00', false, false, true) ON CONFLICT (model_id, names_id) DO NOTHING;
-- model_pricing_junction
INSERT INTO public.model_pricing_junction (active, created_at, model_id, generated, mcp, pricing_id) VALUES (true, '2025-12-02T18:34:42.763300+00:00', '019b3be4-36d1-782b-9f07-7b368cadc1f1', false, false, '019bbce5-e616-7183-ba48-82eb73b11c6d') ON CONFLICT (model_id, pricing_id) DO NOTHING;
-- model_providers_junction
INSERT INTO public.model_providers_junction (model_id, providers_id, created_at, active, generated, mcp) VALUES ('019b3be4-36d1-782b-9f07-7b368cadc1f1', '019bb2af-b2a8-7035-bbfd-664ba627bd44', '2026-01-08T22:01:23.620772+00:00', true, false, false) ON CONFLICT (model_id, providers_id) DO NOTHING;
-- model_qualities_junction
INSERT INTO public.model_qualities_junction (active, created_at, model_id, generated, mcp, qualities_id) VALUES (true, '2025-12-02T21:29:26.459151+00:00', '019b3be4-36d1-782b-9f07-7b368cadc1f1', false, false, '019bbce5-e600-773a-ac8b-7044ffed731c') ON CONFLICT (model_id, qualities_id) DO NOTHING;
-- model_values_junction
INSERT INTO public.model_values_junction (model_id, values_id, created_at, generated, mcp, active) VALUES ('019b3be4-36d1-782b-9f07-7b368cadc1f1', '019bbabc-5a34-79d0-8db1-25b978aa4464', '2025-12-02T18:34:42.754909+00:00', false, false, true) ON CONFLICT (model_id, values_id) DO NOTHING;
