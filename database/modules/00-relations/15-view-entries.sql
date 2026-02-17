-- Module: view-entries
-- Category: relations
-- Description: view-entries relation data
-- ============================================================

-- Table: view_entry_relation
INSERT INTO public.view_entry_relation (view, entry, created_at, updated_at) VALUES ('simulation_messages', 'messages', '2026-02-01T02:59:14.267322+00:00', '2026-02-01T02:59:14.267322+00:00') ON CONFLICT (view, entry) DO NOTHING;
INSERT INTO public.view_entry_relation (view, entry, created_at, updated_at) VALUES ('simulation_messages', 'highlights', '2026-02-01T02:59:14.267322+00:00', '2026-02-01T02:59:14.267322+00:00') ON CONFLICT (view, entry) DO NOTHING;
INSERT INTO public.view_entry_relation (view, entry, created_at, updated_at) VALUES ('simulation_messages', 'replacements', '2026-02-01T02:59:14.267322+00:00', '2026-02-01T02:59:14.267322+00:00') ON CONFLICT (view, entry) DO NOTHING;
INSERT INTO public.view_entry_relation (view, entry, created_at, updated_at) VALUES ('benchmark_messages', 'messages', '2026-02-01T02:59:14.267322+00:00', '2026-02-01T02:59:14.267322+00:00') ON CONFLICT (view, entry) DO NOTHING;
INSERT INTO public.view_entry_relation (view, entry, created_at, updated_at) VALUES ('benchmark_messages', 'highlights', '2026-02-01T02:59:14.267322+00:00', '2026-02-01T02:59:14.267322+00:00') ON CONFLICT (view, entry) DO NOTHING;
INSERT INTO public.view_entry_relation (view, entry, created_at, updated_at) VALUES ('benchmark_messages', 'replacements', '2026-02-01T02:59:14.267322+00:00', '2026-02-01T02:59:14.267322+00:00') ON CONFLICT (view, entry) DO NOTHING;
