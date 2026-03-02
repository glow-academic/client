-- Module: Record System
-- Category: system
-- Description: Record System
-- ============================================================


-- Resource rows
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, agent_ids) VALUES ('019caf25-99e8-7cd5-8d61-a7800f1a6686', '2026-03-02T00:00:00.000000+00:00', true, false, false, 'Record System', 'System for record agents', '{019c82b8-5d9f-7c16-a38f-d1978b76c5c9}') ON CONFLICT (id) DO NOTHING;

