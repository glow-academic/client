-- Module: Academic Integrity Policy
-- Category: document
-- Description: Academic Integrity Policy document
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e90-77aa-b6d0-5f402ed30db6', 'Academic integrity and honor code policy document', '2025-12-12T13:44:32.428979+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.texts_resource (id, created_at, active, generated, mcp, text_id) VALUES ('019c5ad4-73dd-7afc-ac7b-972114b48ba0', '2026-02-14T06:26:38.435028+00:00', true, false, false, '019c5ad4-73da-75a6-a9bf-5c4c5e79178e') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.uploads_resource (id, created_at, active, generated, mcp, upload_id) VALUES ('019bcc94-efb5-7af4-a7d9-558119025039', '2026-01-17T15:31:11.407183+00:00', true, false, false, '019b3be4-3cf0-7032-a0e9-fd8b56aa4565') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.documents_resource (created_at, active, generated, mcp, id, name, description, department_ids, upload_id, text_id, image_ids, template) VALUES ('2025-12-12T13:44:32.428979+00:00', true, false, false, '019bb25e-e619-7834-9cb3-66671ca36a7d', 'Academic Integrity Policy', 'Academic integrity and honor code policy document', '{}', '019bcc94-efb5-7af4-a7d9-558119025039', '019c5ad4-73dd-7afc-ac7b-972114b48ba0', '{019c5ad4-74a7-7628-849e-9366a67c93f8,019c5ad4-74ae-7613-9a23-0d612d2dc214,019c5ad4-74b0-702c-a555-54a1d3e5f63b,019c5ad4-74b1-7a38-bf3a-21d2be6321a3,019c5ad4-74b3-7428-bb6e-34a47b3ab60b}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.uploads_resource (id, created_at, active, generated, mcp, upload_id) VALUES ('019c5ad4-74a4-786e-ac76-f7ea267a96eb', '2026-02-14T06:26:38.435028+00:00', true, false, false, '019c5ad4-74a3-7962-b5ec-ccb287668cf1') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.images_resource (created_at, name, active, completed, id, description, generated, mcp, upload_id) VALUES ('2026-02-14T06:26:38.435028+00:00', 'Academic Integrity Policy Page 1', true, true, '019c5ad4-74a7-7628-849e-9366a67c93f8', 'Academic Integrity Policy Page 1', false, false, '019c5ad4-74a4-786e-ac76-f7ea267a96eb') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.uploads_resource (id, created_at, active, generated, mcp, upload_id) VALUES ('019c5ad4-74ad-7cff-94a6-81afedf32539', '2026-02-14T06:26:38.435028+00:00', true, false, false, '019c5ad4-74ad-792d-8a86-d32d6a53c1f8') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.images_resource (created_at, name, active, completed, id, description, generated, mcp, upload_id) VALUES ('2026-02-14T06:26:38.435028+00:00', 'Academic Integrity Policy Page 2', true, true, '019c5ad4-74ae-7613-9a23-0d612d2dc214', 'Academic Integrity Policy Page 2', false, false, '019c5ad4-74ad-7cff-94a6-81afedf32539') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.uploads_resource (id, created_at, active, generated, mcp, upload_id) VALUES ('019c5ad4-74af-7a8f-b0b8-f0a478fba2b7', '2026-02-14T06:26:38.435028+00:00', true, false, false, '019c5ad4-74af-77ab-8b54-2a45acdf2178') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.images_resource (created_at, name, active, completed, id, description, generated, mcp, upload_id) VALUES ('2026-02-14T06:26:38.435028+00:00', 'Academic Integrity Policy Page 3', true, true, '019c5ad4-74b0-702c-a555-54a1d3e5f63b', 'Academic Integrity Policy Page 3', false, false, '019c5ad4-74af-7a8f-b0b8-f0a478fba2b7') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.uploads_resource (id, created_at, active, generated, mcp, upload_id) VALUES ('019c5ad4-74b1-7179-ac81-d2eac2f59bce', '2026-02-14T06:26:38.435028+00:00', true, false, false, '019c5ad4-74b0-7cd1-8b67-3a29cc456c32') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.images_resource (created_at, name, active, completed, id, description, generated, mcp, upload_id) VALUES ('2026-02-14T06:26:38.435028+00:00', 'Academic Integrity Policy Page 4', true, true, '019c5ad4-74b1-7a38-bf3a-21d2be6321a3', 'Academic Integrity Policy Page 4', false, false, '019c5ad4-74b1-7179-ac81-d2eac2f59bce') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.uploads_resource (id, created_at, active, generated, mcp, upload_id) VALUES ('019c5ad4-74b2-7be6-8f3f-b3f68959dc14', '2026-02-14T06:26:38.435028+00:00', true, false, false, '019c5ad4-74b2-78c5-9cc1-fc59d895dfcb') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.images_resource (created_at, name, active, completed, id, description, generated, mcp, upload_id) VALUES ('2026-02-14T06:26:38.435028+00:00', 'Academic Integrity Policy Page 5', true, true, '019c5ad4-74b3-7428-bb6e-34a47b3ab60b', 'Academic Integrity Policy Page 5', false, false, '019c5ad4-74b2-7be6-8f3f-b3f68959dc14') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e8e-7a8e-a8f5-a9cc53ce422f', 'Academic Integrity Policy', '2025-12-12T13:44:32.428979+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

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
-- document_images_junction
INSERT INTO public.document_images_junction (document_id, images_id, active, created_at) VALUES ('019b3be4-324b-7fa2-9ab0-37f8daac8d07', '019c5ad4-74a7-7628-849e-9366a67c93f8', true, '2026-02-14T06:26:38.435028+00:00') ON CONFLICT (document_id, images_id) DO NOTHING;
INSERT INTO public.document_images_junction (document_id, images_id, active, created_at) VALUES ('019b3be4-324b-7fa2-9ab0-37f8daac8d07', '019c5ad4-74ae-7613-9a23-0d612d2dc214', true, '2026-02-14T06:26:38.435028+00:00') ON CONFLICT (document_id, images_id) DO NOTHING;
INSERT INTO public.document_images_junction (document_id, images_id, active, created_at) VALUES ('019b3be4-324b-7fa2-9ab0-37f8daac8d07', '019c5ad4-74b0-702c-a555-54a1d3e5f63b', true, '2026-02-14T06:26:38.435028+00:00') ON CONFLICT (document_id, images_id) DO NOTHING;
INSERT INTO public.document_images_junction (document_id, images_id, active, created_at) VALUES ('019b3be4-324b-7fa2-9ab0-37f8daac8d07', '019c5ad4-74b1-7a38-bf3a-21d2be6321a3', true, '2026-02-14T06:26:38.435028+00:00') ON CONFLICT (document_id, images_id) DO NOTHING;
INSERT INTO public.document_images_junction (document_id, images_id, active, created_at) VALUES ('019b3be4-324b-7fa2-9ab0-37f8daac8d07', '019c5ad4-74b3-7428-bb6e-34a47b3ab60b', true, '2026-02-14T06:26:38.435028+00:00') ON CONFLICT (document_id, images_id) DO NOTHING;
-- document_names_junction
INSERT INTO public.document_names_junction (document_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-324b-7fa2-9ab0-37f8daac8d07', '019b995c-8e8e-7a8e-a8f5-a9cc53ce422f', '2025-12-12T13:44:32.428979+00:00', false, false, true) ON CONFLICT (document_id, name_id) DO NOTHING;
-- document_texts_junction
INSERT INTO public.document_texts_junction (document_id, texts_id, active, created_at) VALUES ('019b3be4-324b-7fa2-9ab0-37f8daac8d07', '019c5ad4-73dd-7afc-ac7b-972114b48ba0', true, '2026-02-14T06:26:38.435028+00:00') ON CONFLICT (document_id, texts_id) DO NOTHING;
-- document_uploads_junction
INSERT INTO public.document_uploads_junction (active, created_at, uploads_id, document_id, generated, mcp) VALUES (true, '2025-12-12T13:44:32.428979+00:00', '019bcc94-efb5-7af4-a7d9-558119025039', '019b3be4-324b-7fa2-9ab0-37f8daac8d07', false, false) ON CONFLICT (document_id, uploads_id) DO NOTHING;
