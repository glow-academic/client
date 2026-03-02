-- Module: Department System
-- Category: system
-- Description: Department System
-- ============================================================


-- Resource rows
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, agent_ids) VALUES ('019caf25-99d4-7fb7-8cec-e9a0de527479', '2026-03-02T00:00:00.000000+00:00', true, false, false, 'Department System', 'System for department agents', '{019c5517-4673-71f7-a48c-9f4c24d00185}') ON CONFLICT (id) DO NOTHING;

