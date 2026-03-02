-- Module: Field System
-- Category: system
-- Description: Field System
-- ============================================================


-- Resource rows
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, agent_ids) VALUES ('019caf25-99d7-792a-a47b-246dd0a84352', '2026-03-02T00:00:00.000000+00:00', true, false, false, 'Field System', 'System for field agents', '{019c82b8-5d96-7acb-8649-4d4227ae7815}') ON CONFLICT (id) DO NOTHING;

