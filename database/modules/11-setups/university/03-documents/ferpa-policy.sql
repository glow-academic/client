-- Module: FERPA Policy
-- Category: document
-- Description: FERPA Policy document
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e90-77bc-a551-5ea801f3cc75', 'Family Educational Rights and Privacy Act (FERPA) policy document', '2025-12-12T13:44:32.428979+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.texts_resource (id, created_at, active, generated, mcp, text_id) VALUES ('019c5ad4-7b3e-76d5-9816-e3781d964ea5', '2026-02-14T06:26:38.435028+00:00', true, false, false, '019c5ad4-7a52-7a69-b03d-b31104496c0c') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.uploads_resource (id, created_at, active, generated, mcp, upload_id) VALUES ('019bcc94-efb5-7ac7-a390-938a31051739', '2026-01-17T15:31:11.407183+00:00', true, false, false, '019b3be4-3cf0-7029-82ab-3b4eda4f818d') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.documents_resource (created_at, active, generated, mcp, id, name, description, department_ids, upload_id, text_id, image_ids, template) VALUES ('2025-12-12T13:44:32.428979+00:00', true, false, false, '019bb25e-e619-7831-a70a-a7fb065a1999', 'FERPA Policy', 'Family Educational Rights and Privacy Act (FERPA) policy document', '{}', '019bcc94-efb5-7ac7-a390-938a31051739', '019c5ad4-7b3e-76d5-9816-e3781d964ea5', '{019c5ad4-7b96-712c-b8b1-6d4f111e40c3,019c5ad4-7b97-7065-8ab5-8ac198a7b73a,019c5ad4-7b98-7883-8c87-1d9f0c3c32b3,019c5ad4-7b9b-7e6c-98b6-2581302148c3,019c5ad4-7b9d-7467-9fb9-c6dcad937ef7,019c5ad4-7b9e-70e2-a644-2847c1f3bf2d}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.uploads_resource (id, created_at, active, generated, mcp, upload_id) VALUES ('019c5ad4-7b95-7805-a0c2-ef45d2d41aef', '2026-02-14T06:26:38.435028+00:00', true, false, false, '019c5ad4-7b95-7265-823d-70c836b563b4') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.images_resource (created_at, name, active, completed, id, description, generated, mcp, upload_id) VALUES ('2026-02-14T06:26:38.435028+00:00', 'FERPA Policy Page 1', true, true, '019c5ad4-7b96-712c-b8b1-6d4f111e40c3', 'FERPA Policy Page 1', false, false, '019c5ad4-7b95-7805-a0c2-ef45d2d41aef') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.uploads_resource (id, created_at, active, generated, mcp, upload_id) VALUES ('019c5ad4-7b96-7b29-9c1c-ca7eb82a9fad', '2026-02-14T06:26:38.435028+00:00', true, false, false, '019c5ad4-7b96-7902-9aa3-15c9aacabd4a') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.images_resource (created_at, name, active, completed, id, description, generated, mcp, upload_id) VALUES ('2026-02-14T06:26:38.435028+00:00', 'FERPA Policy Page 2', true, true, '019c5ad4-7b97-7065-8ab5-8ac198a7b73a', 'FERPA Policy Page 2', false, false, '019c5ad4-7b96-7b29-9c1c-ca7eb82a9fad') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.uploads_resource (id, created_at, active, generated, mcp, upload_id) VALUES ('019c5ad4-7b98-7052-8caa-f007804a8437', '2026-02-14T06:26:38.435028+00:00', true, false, false, '019c5ad4-7b97-7d09-91d3-6de3ce4d2fb3') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.images_resource (created_at, name, active, completed, id, description, generated, mcp, upload_id) VALUES ('2026-02-14T06:26:38.435028+00:00', 'FERPA Policy Page 3', true, true, '019c5ad4-7b98-7883-8c87-1d9f0c3c32b3', 'FERPA Policy Page 3', false, false, '019c5ad4-7b98-7052-8caa-f007804a8437') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.uploads_resource (id, created_at, active, generated, mcp, upload_id) VALUES ('019c5ad4-7b9b-7781-bc14-d2b10eaa3869', '2026-02-14T06:26:38.435028+00:00', true, false, false, '019c5ad4-7b9b-73db-a140-13145616ad09') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.images_resource (created_at, name, active, completed, id, description, generated, mcp, upload_id) VALUES ('2026-02-14T06:26:38.435028+00:00', 'FERPA Policy Page 4', true, true, '019c5ad4-7b9b-7e6c-98b6-2581302148c3', 'FERPA Policy Page 4', false, false, '019c5ad4-7b9b-7781-bc14-d2b10eaa3869') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.uploads_resource (id, created_at, active, generated, mcp, upload_id) VALUES ('019c5ad4-7b9c-7d15-bca2-462833dd1cfe', '2026-02-14T06:26:38.435028+00:00', true, false, false, '019c5ad4-7b9c-7976-a1bc-bd3af5ac920c') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.images_resource (created_at, name, active, completed, id, description, generated, mcp, upload_id) VALUES ('2026-02-14T06:26:38.435028+00:00', 'FERPA Policy Page 5', true, true, '019c5ad4-7b9d-7467-9fb9-c6dcad937ef7', 'FERPA Policy Page 5', false, false, '019c5ad4-7b9c-7d15-bca2-462833dd1cfe') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.uploads_resource (id, created_at, active, generated, mcp, upload_id) VALUES ('019c5ad4-7b9d-7c96-9af8-ffafcbdd9e25', '2026-02-14T06:26:38.435028+00:00', true, false, false, '019c5ad4-7b9d-7ae8-a0e9-4ddcc57ee7bd') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.images_resource (created_at, name, active, completed, id, description, generated, mcp, upload_id) VALUES ('2026-02-14T06:26:38.435028+00:00', 'FERPA Policy Page 6', true, true, '019c5ad4-7b9e-70e2-a644-2847c1f3bf2d', 'FERPA Policy Page 6', false, false, '019c5ad4-7b9d-7c96-9af8-ffafcbdd9e25') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8e8e-7a22-a285-9726b43ab391', 'FERPA Policy', '2025-12-12T13:44:32.428979+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- document_artifact
INSERT INTO public.document_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-12T13:44:32.428979+00:00', '2026-01-07T07:25:51.825324+00:00', '019b3be4-324b-7f84-8679-0b395c7c5ddb', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- document_descriptions_junction
INSERT INTO public.document_descriptions_junction (document_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-324b-7f84-8679-0b395c7c5ddb', '019b995c-8e90-77bc-a551-5ea801f3cc75', '2025-12-12T13:44:32.428979+00:00', false, false, true) ON CONFLICT (document_id, description_id) DO NOTHING;
-- document_documents_junction
INSERT INTO public.document_documents_junction (document_id, documents_id, active, created_at, generated, mcp) VALUES ('019b3be4-324b-7f84-8679-0b395c7c5ddb', '019bb25e-e619-7831-a70a-a7fb065a1999', true, '2025-12-12T13:44:32.428979+00:00', false, false) ON CONFLICT (document_id, documents_id) DO NOTHING;
-- document_flags_junction
INSERT INTO public.document_flags_junction (document_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-324b-7f84-8679-0b395c7c5ddb', '019b995a-86ef-78bb-87a8-0de554b128bb', false, '2025-12-12T13:44:32.428979+00:00', false, false, true) ON CONFLICT (document_id, flag_id) DO NOTHING;
INSERT INTO public.document_flags_junction (document_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-324b-7f84-8679-0b395c7c5ddb', '019be334-bfc4-7b69-96a1-6cf5422bba50', true, '2025-12-12T13:44:32.428979+00:00', false, false, true) ON CONFLICT (document_id, flag_id) DO NOTHING;
-- document_images_junction
INSERT INTO public.document_images_junction (document_id, images_id, active, created_at) VALUES ('019b3be4-324b-7f84-8679-0b395c7c5ddb', '019c5ad4-7b96-712c-b8b1-6d4f111e40c3', true, '2026-02-14T06:26:38.435028+00:00') ON CONFLICT (document_id, images_id) DO NOTHING;
INSERT INTO public.document_images_junction (document_id, images_id, active, created_at) VALUES ('019b3be4-324b-7f84-8679-0b395c7c5ddb', '019c5ad4-7b97-7065-8ab5-8ac198a7b73a', true, '2026-02-14T06:26:38.435028+00:00') ON CONFLICT (document_id, images_id) DO NOTHING;
INSERT INTO public.document_images_junction (document_id, images_id, active, created_at) VALUES ('019b3be4-324b-7f84-8679-0b395c7c5ddb', '019c5ad4-7b98-7883-8c87-1d9f0c3c32b3', true, '2026-02-14T06:26:38.435028+00:00') ON CONFLICT (document_id, images_id) DO NOTHING;
INSERT INTO public.document_images_junction (document_id, images_id, active, created_at) VALUES ('019b3be4-324b-7f84-8679-0b395c7c5ddb', '019c5ad4-7b9b-7e6c-98b6-2581302148c3', true, '2026-02-14T06:26:38.435028+00:00') ON CONFLICT (document_id, images_id) DO NOTHING;
INSERT INTO public.document_images_junction (document_id, images_id, active, created_at) VALUES ('019b3be4-324b-7f84-8679-0b395c7c5ddb', '019c5ad4-7b9d-7467-9fb9-c6dcad937ef7', true, '2026-02-14T06:26:38.435028+00:00') ON CONFLICT (document_id, images_id) DO NOTHING;
INSERT INTO public.document_images_junction (document_id, images_id, active, created_at) VALUES ('019b3be4-324b-7f84-8679-0b395c7c5ddb', '019c5ad4-7b9e-70e2-a644-2847c1f3bf2d', true, '2026-02-14T06:26:38.435028+00:00') ON CONFLICT (document_id, images_id) DO NOTHING;
-- document_names_junction
INSERT INTO public.document_names_junction (document_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-324b-7f84-8679-0b395c7c5ddb', '019b995c-8e8e-7a22-a285-9726b43ab391', '2025-12-12T13:44:32.428979+00:00', false, false, true) ON CONFLICT (document_id, name_id) DO NOTHING;
-- document_texts_junction
INSERT INTO public.document_texts_junction (document_id, texts_id, active, created_at) VALUES ('019b3be4-324b-7f84-8679-0b395c7c5ddb', '019c5ad4-7b3e-76d5-9816-e3781d964ea5', true, '2026-02-14T06:26:38.435028+00:00') ON CONFLICT (document_id, texts_id) DO NOTHING;
-- document_uploads_junction
INSERT INTO public.document_uploads_junction (active, created_at, uploads_id, document_id, generated, mcp) VALUES (true, '2025-12-12T13:44:32.428979+00:00', '019bcc94-efb5-7ac7-a390-938a31051739', '019b3be4-324b-7f84-8679-0b395c7c5ddb', false, false) ON CONFLICT (document_id, uploads_id) DO NOTHING;
