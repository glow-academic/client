-- Module: Auth System
-- Category: system
-- Description: Auth System
-- ============================================================


-- Resource rows
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, agent_ids) VALUES ('019caf25-99cd-7470-bc4b-7eb189b96d43', '2026-03-02T00:00:00.000000+00:00', true, false, false, 'Auth System', 'System for auth agents', '{019c5517-4672-7c5f-953f-8c064353f7d4}') ON CONFLICT (id) DO NOTHING;

