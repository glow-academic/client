-- Module: Document System
-- Category: system
-- Description: Document System
-- ============================================================


-- Resource rows
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, agent_ids) VALUES ('019caf25-99d5-7ff1-a78c-485cbcd14b60', '2026-03-02T00:00:00.000000+00:00', true, false, false, 'Document System', 'System for document agents', '{019bb25e-e5f2-7f7a-ba83-2e756143cec4}') ON CONFLICT (id) DO NOTHING;

