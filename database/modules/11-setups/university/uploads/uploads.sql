-- Module: uploads
-- Category: uploads
-- Description: Upload entries and connections for document and video uploads
-- ============================================================

-- sessions_entry (shared session for seed upload entries)
INSERT INTO public.sessions_entry (id, created_at, active, mcp, generated) VALUES ('019c29d6-0000-7000-8000-000000000002', '2025-12-02T23:06:38.169734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- uploads_entry
INSERT INTO public.uploads_entry (created_at, file_path, mime_type, size, id, generated, mcp, active, session_id) VALUES ('2025-12-02T23:06:38.169734+00:00', 'FERPA.pdf', 'application/pdf', 0, '019b3be4-3cef-7fec-886c-66e000123a8d', false, false, true, '019c29d6-0000-7000-8000-000000000002') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.uploads_entry (created_at, file_path, mime_type, size, id, generated, mcp, active, session_id) VALUES ('2025-12-12T13:44:32.428979+00:00', 'FERPA.pdf', 'application/pdf', 117807, '019b3be4-3cf0-7029-82ab-3b4eda4f818d', false, false, true, '019c29d6-0000-7000-8000-000000000002') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.uploads_entry (created_at, file_path, mime_type, size, id, generated, mcp, active, session_id) VALUES ('2025-12-12T13:44:32.428979+00:00', 'integrity.pdf', 'application/pdf', 786105, '019b3be4-3cf0-7032-a0e9-fd8b56aa4565', false, false, true, '019c29d6-0000-7000-8000-000000000002') ON CONFLICT (id) DO NOTHING;
