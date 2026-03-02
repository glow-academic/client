-- Module: Test Grade System
-- Category: system
-- Description: Test Grade System
-- ============================================================


-- Resource rows
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, agent_ids) VALUES ('019caf25-99f2-7ea3-8a59-24fcd0ff8b8c', '2026-03-02T00:00:00.000000+00:00', true, false, false, 'Test Grade System', 'System for test-grade agents', '{019c82b8-5d9c-75f6-8468-7af07ed62ce7}') ON CONFLICT (id) DO NOTHING;

