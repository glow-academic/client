-- Module: Tool System
-- Category: system
-- Description: Tool System
-- ============================================================


-- Resource rows
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, agent_ids) VALUES ('019caf25-99f3-7408-b7d0-968fe57800f7', '2026-03-02T00:00:00.000000+00:00', true, false, false, 'Tool System', 'System for tool agents', '{019c5517-4673-7adc-a363-50b6559fc4ea}') ON CONFLICT (id) DO NOTHING;

