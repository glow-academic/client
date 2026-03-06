-- Module: Lecture Template
-- Category: document
-- Description: Lecture Template document
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e90-77ca-bf25-68b91816820d', 'Template document for lecture', '2025-12-06T02:59:23.893847+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.texts_resource (id, created_at, active, generated, mcp) VALUES ('019c29d6-005c-733c-a565-88b232c706d3', '2025-12-06T02:59:23.893847+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.documents_resource (created_at, active, generated, mcp, id, name, description, department_ids, file_id, text_id, image_ids, template, parameter_field_ids) VALUES ('2025-12-06T02:59:23.893847+00:00', true, false, false, '019bb25e-e619-7825-b171-9c36d4d56c4a', 'Lecture Template', 'Template document for lecture', '{}', NULL, '019c29d6-005c-733c-a565-88b232c706d3', '{}', true, '{019bb25e-e621-7027-abc4-9b86171ee17b}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e8e-7a5b-9839-0b6c0395f901', 'Lecture Template', '2025-12-06T02:59:23.893847+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.parameter_fields_resource (id, field_id, active, generated, created_at, updated_at, parameter_id) VALUES ('97b505e9-8270-4b0f-9532-18daf0edd9dc', '019bb25e-e5f8-7d04-88c8-70ce34ceeea8', true, false, '2025-12-06T02:59:23.893847+00:00', '2026-01-28T14:15:32.410937+00:00', '019bb25e-e621-7027-abc4-9b86171ee17b') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- document_artifact
INSERT INTO public.document_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-06T02:59:23.893847+00:00', '2025-12-08T22:19:28.214792+00:00', '019b3be4-324b-73f8-8c16-42af94c6869a', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- document_descriptions_junction
INSERT INTO public.document_descriptions_junction (document_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019b3be4-324b-73f8-8c16-42af94c6869a', '019b995c-8e90-77ca-bf25-68b91816820d', '2025-12-06T02:59:23.893847+00:00', false, false, true) ON CONFLICT (document_id, descriptions_id) DO NOTHING;
-- document_documents_junction
INSERT INTO public.document_documents_junction (document_id, documents_id, active, created_at, generated, mcp) VALUES ('019b3be4-324b-73f8-8c16-42af94c6869a', '019bb25e-e619-7825-b171-9c36d4d56c4a', true, '2025-12-06T02:59:23.893847+00:00', false, false) ON CONFLICT (document_id, documents_id) DO NOTHING;
-- document_flags_junction
INSERT INTO public.document_flags_junction (document_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-324b-73f8-8c16-42af94c6869a', '019b995a-86ef-78bb-87a8-0de554b128bb', '2025-12-06T02:59:23.893847+00:00', false, false, true) ON CONFLICT (document_id, flags_id) DO NOTHING;
INSERT INTO public.document_flags_junction (document_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-324b-73f8-8c16-42af94c6869a', '019be334-bfc4-7b69-96a1-6cf5422bba50', '2025-12-06T02:59:23.893847+00:00', false, false, true) ON CONFLICT (document_id, flags_id) DO NOTHING;
-- document_names_junction
INSERT INTO public.document_names_junction (document_id, names_id, created_at, generated, mcp, active) VALUES ('019b3be4-324b-73f8-8c16-42af94c6869a', '019b995c-8e8e-7a5b-9839-0b6c0395f901', '2025-12-06T02:59:23.893847+00:00', false, false, true) ON CONFLICT (document_id, names_id) DO NOTHING;
-- document_parameter_fields_junction
INSERT INTO public.document_parameter_fields_junction (document_id, parameter_fields_id, active, generated, mcp, created_at) VALUES ('019b3be4-324b-73f8-8c16-42af94c6869a', '97b505e9-8270-4b0f-9532-18daf0edd9dc', true, false, false, '2025-12-06T02:59:23.893847+00:00') ON CONFLICT (document_id, parameter_fields_id) DO NOTHING;
-- document_texts_junction
INSERT INTO public.document_texts_junction (document_id, texts_id, active, created_at) VALUES ('019b3be4-324b-73f8-8c16-42af94c6869a', '019c29d6-005c-733c-a565-88b232c706d3', true, '2026-02-13T20:09:41.891519+00:00') ON CONFLICT (document_id, texts_id) DO NOTHING;
