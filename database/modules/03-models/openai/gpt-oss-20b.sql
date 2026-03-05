-- Module: gpt-oss-20b
-- Provider: openai
-- Description: openai gpt-oss-20b model
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8ea4-72e3-a859-4e21f060ebbd', 'Open Source Running Locally', '2025-08-16T04:14:45.309000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.models_resource (created_at, value, active, generated, mcp, id, name, description, department_ids, provider_id, temperature_level_ids, reasoning_level_ids, quality_ids, voice_ids, modality_ids) VALUES ('2025-08-16T04:14:45.309000+00:00', 'gpt-oss-20b', true, false, false, '019bb25e-e5ff-779e-a760-e603914cff51', 'gpt-oss-20b', 'Open Source Running Locally', '{}', '019bb2af-b2a7-7d85-a61a-0dc4fd93b3c6', '{}', '{}', '{}', '{}', '{019bbce5-e606-77f1-abf8-78df7462af03,019bbce5-e609-7efe-8549-87dd267f086a,019bbce5-e606-77f1-abf8-78df7462af03,019bbce5-e609-7efe-8549-87dd267f086a}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8ea2-7cc7-b3bb-7af58b357159', 'gpt-oss-20b', '2025-08-16T04:14:45.309000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.values_resource (id, value, created_at, active, generated, mcp) VALUES ('019bbabc-5a34-73ed-8ac6-6d5307da5a3e', 'gpt-oss-20b', '2025-08-16T04:14:45.309000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- model_artifact
INSERT INTO public.model_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-08-16T04:14:45.309000+00:00', '2025-08-16T04:14:45.309000+00:00', '019b3be4-36cd-7891-988a-33c18c46a564', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- model_descriptions_junction
INSERT INTO public.model_descriptions_junction (model_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-36cd-7891-988a-33c18c46a564', '019b995c-8ea4-72e3-a859-4e21f060ebbd', '2025-08-16T04:14:45.309000+00:00', false, false, true) ON CONFLICT (model_id, description_id) DO NOTHING;
-- model_flags_junction
INSERT INTO public.model_flags_junction (model_id, flag_id, created_at, generated, mcp, active) VALUES ('019b3be4-36cd-7891-988a-33c18c46a564', '019be334-bfc4-7ef6-b18f-7a556d94b225', '2025-08-16T04:14:45.309000+00:00', false, false, true) ON CONFLICT (model_id, flag_id) DO NOTHING;
-- model_modalities_junction
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36cd-7891-988a-33c18c46a564', false, false, '019bbce5-e606-77f1-abf8-78df7462af03') ON CONFLICT (model_id, modality_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2026-01-09T16:27:38.918424+00:00', '019b3be4-36cd-7891-988a-33c18c46a564', false, false, '019bbce5-e609-7efe-8549-87dd267f086a') ON CONFLICT (model_id, modality_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2025-12-02T18:34:42.759389+00:00', '019b3be4-36cd-7891-988a-33c18c46a564', false, false, '019c47d6-6c45-754d-9669-73c9882d1a66') ON CONFLICT (model_id, modality_id) DO NOTHING;
INSERT INTO public.model_modalities_junction (active, created_at, model_id, generated, mcp, modality_id) VALUES (true, '2026-01-09T16:27:38.918424+00:00', '019b3be4-36cd-7891-988a-33c18c46a564', false, false, '019c47d6-6c45-7602-a2b1-b2a608b0cf31') ON CONFLICT (model_id, modality_id) DO NOTHING;
-- model_models_junction
INSERT INTO public.model_models_junction (model_id, models_id, active, created_at, generated, mcp) VALUES ('019b3be4-36cd-7891-988a-33c18c46a564', '019bb25e-e5ff-779e-a760-e603914cff51', '2025-08-16T04:14:45.309000+00:00', false, false) ON CONFLICT (model_id, models_id) DO NOTHING;
-- model_names_junction
INSERT INTO public.model_names_junction (model_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-36cd-7891-988a-33c18c46a564', '019b995c-8ea2-7cc7-b3bb-7af58b357159', '2025-08-16T04:14:45.309000+00:00', false, false, true) ON CONFLICT (model_id, name_id) DO NOTHING;
-- model_pricing_junction
INSERT INTO public.model_pricing_junction (active, created_at, model_id, generated, mcp, pricing_id) VALUES (true, '2025-12-02T18:34:42.763300+00:00', '019b3be4-36cd-7891-988a-33c18c46a564', false, false, '019bbce5-e615-79ef-973a-92765896a8d4') ON CONFLICT (model_id, pricing_id) DO NOTHING;
INSERT INTO public.model_pricing_junction (active, created_at, model_id, generated, mcp, pricing_id) VALUES (true, '2025-12-02T18:34:42.763300+00:00', '019b3be4-36cd-7891-988a-33c18c46a564', false, false, '019bbce5-e61a-7c53-b3be-99c73691f7ff') ON CONFLICT (model_id, pricing_id) DO NOTHING;
INSERT INTO public.model_pricing_junction (active, created_at, model_id, generated, mcp, pricing_id) VALUES (true, '2025-12-02T18:34:42.763300+00:00', '019b3be4-36cd-7891-988a-33c18c46a564', false, false, '019bbce5-e60f-7cbb-8f27-ae33b2c11ccc') ON CONFLICT (model_id, pricing_id) DO NOTHING;
-- model_providers_junction
INSERT INTO public.model_providers_junction (model_id, providers_id, created_at, active, generated, mcp) VALUES ('019b3be4-36cd-7891-988a-33c18c46a564', '019bb2af-b2a7-7d85-a61a-0dc4fd93b3c6', '2026-01-08T22:01:23.620772+00:00', true, false, false) ON CONFLICT (model_id, providers_id) DO NOTHING;
-- model_values_junction
INSERT INTO public.model_values_junction (model_id, value_id, created_at, generated, mcp, active) VALUES ('019b3be4-36cd-7891-988a-33c18c46a564', '019bbabc-5a34-73ed-8ac6-6d5307da5a3e', '2025-08-16T04:14:45.309000+00:00', false, false, true) ON CONFLICT (model_id, value_id) DO NOTHING;
