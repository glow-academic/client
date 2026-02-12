-- Module: Academic Integrity Policy
-- Category: document
-- Description: Academic Integrity Policy document
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e90-77aa-b6d0-5f402ed30db6', 'Academic integrity and honor code policy document', '2025-12-12T13:44:32.428979+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.documents_resource (created_at, active, generated, mcp, id, name, description, department_ids, upload_id, text_id, html) VALUES ('2025-12-12T13:44:32.428979+00:00', true, false, false, '019bb25e-e619-7834-9cb3-66671ca36a7d', 'Academic Integrity Policy', 'Academic integrity and honor code policy document', '{}', '019b3be4-3cf0-7032-a0e9-fd8b56aa4565', NULL, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e8e-7a8e-a8f5-a9cc53ce422f', 'Academic Integrity Policy', '2025-12-12T13:44:32.428979+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.uploads_resource (id, created_at, active, generated, mcp) VALUES ('019bcc94-efb5-7af4-a7d9-558119025039', '2026-01-17T15:31:11.407183+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- document_artifact
INSERT INTO public.document_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-12T13:44:32.428979+00:00', '2026-01-07T07:25:51.826872+00:00', '019b3be4-324b-7fa2-9ab0-37f8daac8d07', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- document_descriptions_junction
INSERT INTO public.document_descriptions_junction (document_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-324b-7fa2-9ab0-37f8daac8d07', '019b995c-8e90-77aa-b6d0-5f402ed30db6', '2025-12-12T13:44:32.428979+00:00', false, false, true) ON CONFLICT (document_id, description_id) DO NOTHING;
-- document_documents_junction
INSERT INTO public.document_documents_junction (document_id, documents_id, active, created_at, generated, mcp) VALUES ('019b3be4-324b-7fa2-9ab0-37f8daac8d07', '019bb25e-e619-7834-9cb3-66671ca36a7d', true, '2025-12-12T13:44:32.428979+00:00', false, false) ON CONFLICT (document_id, documents_id) DO NOTHING;
-- document_flags_junction
INSERT INTO public.document_flags_junction (document_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-324b-7fa2-9ab0-37f8daac8d07', '019b995a-86ef-78bb-87a8-0de554b128bb', false, '2025-12-12T13:44:32.428979+00:00', false, false, true) ON CONFLICT (document_id, flag_id) DO NOTHING;
INSERT INTO public.document_flags_junction (document_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-324b-7fa2-9ab0-37f8daac8d07', '019be334-bfc4-7b69-96a1-6cf5422bba50', true, '2025-12-12T13:44:32.428979+00:00', false, false, true) ON CONFLICT (document_id, flag_id) DO NOTHING;
-- document_names_junction
INSERT INTO public.document_names_junction (document_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-324b-7fa2-9ab0-37f8daac8d07', '019b995c-8e8e-7a8e-a8f5-a9cc53ce422f', '2025-12-12T13:44:32.428979+00:00', false, false, true) ON CONFLICT (document_id, name_id) DO NOTHING;
-- document_uploads_junction
INSERT INTO public.document_uploads_junction (active, created_at, uploads_id, document_id, generated, mcp) VALUES (true, '2025-12-12T13:44:32.428979+00:00', '019bcc94-efb5-7af4-a7d9-558119025039', '019b3be4-324b-7fa2-9ab0-37f8daac8d07', false, false) ON CONFLICT (document_id, uploads_id) DO NOTHING;
