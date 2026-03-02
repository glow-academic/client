-- Module: Agent System
-- Category: system
-- Description: Agent System
-- ============================================================


-- Resource rows
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, agent_ids) VALUES ('019caf25-99c8-7bba-946c-e6b9d55d2fc3', '2026-03-02T00:00:00.000000+00:00', true, false, false, 'Agent System', 'System for agent agents', '{019c5517-4670-7a06-8b57-8d054f851772}') ON CONFLICT (id) DO NOTHING;

