-- Module: Midterm Template
-- Category: document
-- Description: Midterm Template document
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e90-77cc-800b-b9884003b017', 'Template document for midterm', '2025-12-06T02:59:23.893847+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.texts_resource (id, created_at, active, generated, mcp, text_id) VALUES ('019c29d6-005c-7205-8dea-be2ddf4258ef', '2025-12-06T02:59:23.893847+00:00', true, false, false, '019c29d6-003a-731f-b918-64b6c99d0464') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.documents_resource (created_at, active, generated, mcp, id, name, description, department_ids, upload_id, text_id, image_ids, template) VALUES ('2025-12-06T02:59:23.893847+00:00', true, false, false, '019bb25e-e619-781f-9283-8bae433caa45', 'Midterm Template', 'Template document for midterm', '{}', NULL, '019c29d6-005c-7205-8dea-be2ddf4258ef', '{}', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e8e-7a88-a050-44cf02b3f9b3', 'Midterm Template', '2025-12-06T02:59:23.893847+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameter_fields_resource (id, field_id, active, generated, created_at, updated_at, parameter_id, conditional_parameter_id) VALUES ('f4cec549-e224-427d-8b10-d37725893997', '019bb25e-e5f8-7d0d-9207-6520a302d236', true, false, '2025-12-06T02:59:23.893847+00:00', '2026-01-28T14:15:32.410937+00:00', '019bb25e-e621-7027-abc4-9b86171ee17b', NULL) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- document_artifact
INSERT INTO public.document_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-06T02:59:23.893847+00:00', '2025-12-08T22:19:28.214792+00:00', '019b3be4-324b-73ee-afba-5103618244d8', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- document_descriptions_junction
INSERT INTO public.document_descriptions_junction (document_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-324b-73ee-afba-5103618244d8', '019b995c-8e90-77cc-800b-b9884003b017', '2025-12-06T02:59:23.893847+00:00', false, false, true) ON CONFLICT (document_id, description_id) DO NOTHING;
-- document_documents_junction
INSERT INTO public.document_documents_junction (document_id, documents_id, active, created_at, generated, mcp) VALUES ('019b3be4-324b-73ee-afba-5103618244d8', '019bb25e-e619-781f-9283-8bae433caa45', true, '2025-12-06T02:59:23.893847+00:00', false, false) ON CONFLICT (document_id, documents_id) DO NOTHING;
-- document_flags_junction
INSERT INTO public.document_flags_junction (document_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-324b-73ee-afba-5103618244d8', '019b995a-86ef-78bb-87a8-0de554b128bb', true, '2025-12-06T02:59:23.893847+00:00', false, false, true) ON CONFLICT (document_id, flag_id) DO NOTHING;
INSERT INTO public.document_flags_junction (document_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-324b-73ee-afba-5103618244d8', '019be334-bfc4-7b69-96a1-6cf5422bba50', true, '2025-12-06T02:59:23.893847+00:00', false, false, true) ON CONFLICT (document_id, flag_id) DO NOTHING;
-- document_names_junction
INSERT INTO public.document_names_junction (document_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-324b-73ee-afba-5103618244d8', '019b995c-8e8e-7a88-a050-44cf02b3f9b3', '2025-12-06T02:59:23.893847+00:00', false, false, true) ON CONFLICT (document_id, name_id) DO NOTHING;
-- document_parameter_fields_junction
INSERT INTO public.document_parameter_fields_junction (document_id, parameter_field_id, active, generated, mcp, created_at) VALUES ('019b3be4-324b-73ee-afba-5103618244d8', 'f4cec549-e224-427d-8b10-d37725893997', true, false, false, '2025-12-06T02:59:23.893847+00:00') ON CONFLICT (document_id, parameter_field_id) DO NOTHING;
-- document_parameters_junction
INSERT INTO public.document_parameters_junction (document_id, parameter_id, type, created_at, active, generated, mcp) VALUES ('019b3be4-324b-73ee-afba-5103618244d8', '019bb25e-e621-7027-abc4-9b86171ee17b', 'direct', '2025-12-06T02:59:23.893847+00:00', true, false, false) ON CONFLICT (document_id, parameter_id, type) DO NOTHING;
-- document_texts_junction
INSERT INTO public.document_texts_junction (document_id, texts_id, active, created_at) VALUES ('019b3be4-324b-73ee-afba-5103618244d8', '019c29d6-005c-7205-8dea-be2ddf4258ef', true, '2026-02-13T20:09:41.891519+00:00') ON CONFLICT (document_id, texts_id) DO NOTHING;
