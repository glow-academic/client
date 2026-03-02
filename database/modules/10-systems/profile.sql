-- Module: Profile System
-- Category: system
-- Description: Profile System
-- ============================================================


-- Resource rows
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, agent_ids) VALUES ('019caf25-99e5-75e8-b0f1-a5bd20b35bfa', '2026-03-02T00:00:00.000000+00:00', true, false, false, 'Profile System', 'System for profile agents', '{019c5517-4673-759e-81e6-40d247dea759}') ON CONFLICT (id) DO NOTHING;

