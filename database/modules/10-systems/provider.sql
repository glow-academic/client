-- Module: Provider System
-- Category: system
-- Description: Provider System
-- ============================================================


-- Resource rows
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, agent_ids) VALUES ('019caf25-99e6-7886-96fe-71a0bb6090d1', '2026-03-02T00:00:00.000000+00:00', true, false, false, 'Provider System', 'System for provider agents', '{019c5517-4673-762c-a096-0a35439ebf11}') ON CONFLICT (id) DO NOTHING;

