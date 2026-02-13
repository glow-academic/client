-- Module: FERPA Policy
-- Category: document
-- Description: FERPA Policy document
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8e90-77bc-a551-5ea801f3cc75', 'Family Educational Rights and Privacy Act (FERPA) policy document', '2025-12-12T13:44:32.428979+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.uploads_resource (id, created_at, active, generated, mcp, upload_id) VALUES ('019bcc94-efb5-7ac7-a390-938a31051739', '2026-01-17T15:31:11.407183+00:00', true, false, false, '019b3be4-3cf0-7029-82ab-3b4eda4f818d') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.documents_resource (created_at, active, generated, mcp, id, name, description, department_ids, upload_id, text_id, html, image_ids) VALUES ('2025-12-12T13:44:32.428979+00:00', true, false, false, '019bb25e-e619-7831-a70a-a7fb065a1999', 'FERPA Policy', 'Family Educational Rights and Privacy Act (FERPA) policy document', '{}', '019bcc94-efb5-7ac7-a390-938a31051739', NULL, false, '{}') ON CONFLICT (id) DO NOTHING;
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
-- document_names_junction
INSERT INTO public.document_names_junction (document_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-324b-7f84-8679-0b395c7c5ddb', '019b995c-8e8e-7a22-a285-9726b43ab391', '2025-12-12T13:44:32.428979+00:00', false, false, true) ON CONFLICT (document_id, name_id) DO NOTHING;
-- document_uploads_junction
INSERT INTO public.document_uploads_junction (active, created_at, uploads_id, document_id, generated, mcp) VALUES (true, '2025-12-12T13:44:32.428979+00:00', '019bcc94-efb5-7ac7-a390-938a31051739', '019b3be4-324b-7f84-8679-0b395c7c5ddb', false, false) ON CONFLICT (document_id, uploads_id) DO NOTHING;
