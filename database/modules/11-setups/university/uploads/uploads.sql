-- Module: uploads
-- Category: uploads
-- Description: Upload entries and connections for document uploads
-- ============================================================

-- uploads_entry
INSERT INTO public.uploads_entry (created_at, updated_at, file_path, mime_type, size, id, generated, mcp, active) VALUES ('2025-12-12T13:44:32.428979+00:00', '2025-12-12T13:44:32.428979+00:00', 'integrity.pdf', 'application/pdf', 786105, '019b3be4-3cf0-7032-a0e9-fd8b56aa4565', false, false, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.uploads_entry (created_at, updated_at, file_path, mime_type, size, id, generated, mcp, active) VALUES ('2025-12-02T23:06:38.169734+00:00', '2025-12-02T23:06:38.169734+00:00', 'FERPA.pdf', 'application/pdf', 0, '019b3be4-3cef-7fec-886c-66e000123a8d', false, false, true) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.uploads_entry (created_at, updated_at, file_path, mime_type, size, id, generated, mcp, active) VALUES ('2025-12-12T13:44:32.428979+00:00', '2025-12-12T13:44:32.428979+00:00', 'FERPA.pdf', 'application/pdf', 117807, '019b3be4-3cf0-7029-82ab-3b4eda4f818d', false, false, true) ON CONFLICT (id) DO NOTHING;

-- uploads_uploads_connection
INSERT INTO public.uploads_uploads_connection (uploads_id, upload_id, active, created_at, updated_at) VALUES ('019bcc94-efb5-7af4-a7d9-558119025039', '019b3be4-3cf0-7032-a0e9-fd8b56aa4565', true, '2026-01-17T15:31:11.407183+00:00', '2026-01-25T17:13:59.948615+00:00') ON CONFLICT (uploads_id, upload_id) DO NOTHING;
INSERT INTO public.uploads_uploads_connection (uploads_id, upload_id, active, created_at, updated_at) VALUES ('019bcc94-efb5-7817-954e-38e6c05e1d7a', '019b3be4-3cef-7fec-886c-66e000123a8d', true, '2026-01-17T15:31:11.407183+00:00', '2026-01-25T17:13:59.948615+00:00') ON CONFLICT (uploads_id, upload_id) DO NOTHING;
INSERT INTO public.uploads_uploads_connection (uploads_id, upload_id, active, created_at, updated_at) VALUES ('019bcc94-efb5-7ac7-a390-938a31051739', '019b3be4-3cf0-7029-82ab-3b4eda4f818d', true, '2026-01-17T15:31:11.407183+00:00', '2026-01-25T17:13:59.948615+00:00') ON CONFLICT (uploads_id, upload_id) DO NOTHING;
