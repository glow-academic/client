-- Module: Lab Template
-- Category: document
-- Description: Lab Template document
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e90-77d5-9782-879984aed310', 'Template document for lab', '2025-12-06T02:59:23.893847+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.texts_resource (id, created_at, active, generated, mcp) VALUES ('019c29d6-005c-72ae-8312-4708579fd54b', '2025-12-06T02:59:23.893847+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.documents_resource (created_at, active, generated, mcp, id, name, description, department_ids, upload_id, text_id, image_ids, template, parameter_ids, parameter_field_ids) VALUES ('2025-12-06T02:59:23.893847+00:00', true, false, false, '019bb25e-e619-7822-92c0-52e05377ed22', 'Lab Template', 'Template document for lab', '{}', NULL, '019c29d6-005c-72ae-8312-4708579fd54b', '{}', true, '{019bb25e-e621-7027-abc4-9b86171ee17b}', '{59e138a8-5b11-4af2-b742-cc1a009a2475}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e8e-7a68-8518-310195699a09', 'Lab Template', '2025-12-06T02:59:23.893847+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameter_fields_resource (id, field_id, active, generated, created_at, updated_at, parameter_id) VALUES ('59e138a8-5b11-4af2-b742-cc1a009a2475', '019bb25e-e5f8-7d08-946a-bd2457820f28', true, false, '2025-12-06T02:59:23.893847+00:00', '2026-01-28T14:15:32.410937+00:00', '019bb25e-e621-7027-abc4-9b86171ee17b') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- document_artifact
INSERT INTO public.document_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-06T02:59:23.893847+00:00', '2025-12-08T22:19:28.214792+00:00', '019b3be4-324b-73f4-b489-5bcf28fe78a1', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- document_descriptions_junction
INSERT INTO public.document_descriptions_junction (document_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-324b-73f4-b489-5bcf28fe78a1', '019b995c-8e90-77d5-9782-879984aed310', '2025-12-06T02:59:23.893847+00:00', false, false, true) ON CONFLICT (document_id, description_id) DO NOTHING;
-- document_documents_junction
INSERT INTO public.document_documents_junction (document_id, documents_id, active, created_at, generated, mcp) VALUES ('019b3be4-324b-73f4-b489-5bcf28fe78a1', '019bb25e-e619-7822-92c0-52e05377ed22', true, '2025-12-06T02:59:23.893847+00:00', false, false) ON CONFLICT (document_id, documents_id) DO NOTHING;
-- document_flags_junction
INSERT INTO public.document_flags_junction (document_id, flag_id, created_at, generated, mcp, active) VALUES ('019b3be4-324b-73f4-b489-5bcf28fe78a1', '019b995a-86ef-78bb-87a8-0de554b128bb', '2025-12-06T02:59:23.893847+00:00', false, false, true) ON CONFLICT (document_id, flag_id) DO NOTHING;
INSERT INTO public.document_flags_junction (document_id, flag_id, created_at, generated, mcp, active) VALUES ('019b3be4-324b-73f4-b489-5bcf28fe78a1', '019be334-bfc4-7b69-96a1-6cf5422bba50', '2025-12-06T02:59:23.893847+00:00', false, false, true) ON CONFLICT (document_id, flag_id) DO NOTHING;
-- document_names_junction
INSERT INTO public.document_names_junction (document_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-324b-73f4-b489-5bcf28fe78a1', '019b995c-8e8e-7a68-8518-310195699a09', '2025-12-06T02:59:23.893847+00:00', false, false, true) ON CONFLICT (document_id, name_id) DO NOTHING;
-- document_parameter_fields_junction
INSERT INTO public.document_parameter_fields_junction (document_id, parameter_field_id, active, generated, mcp, created_at) VALUES ('019b3be4-324b-73f4-b489-5bcf28fe78a1', '59e138a8-5b11-4af2-b742-cc1a009a2475', true, false, false, '2025-12-06T02:59:23.893847+00:00') ON CONFLICT (document_id, parameter_field_id) DO NOTHING;
-- document_texts_junction
INSERT INTO public.document_texts_junction (document_id, texts_id, active, created_at) VALUES ('019b3be4-324b-73f4-b489-5bcf28fe78a1', '019c29d6-005c-72ae-8312-4708579fd54b', true, '2026-02-13T20:09:41.891519+00:00') ON CONFLICT (document_id, texts_id) DO NOTHING;
