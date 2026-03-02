-- Module: Simulation System
-- Category: system
-- Description: Simulation System
-- ============================================================


-- Resource rows
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, agent_ids) VALUES ('019caf25-99ef-7358-87a9-29cb15f52fd3', '2026-03-02T00:00:00.000000+00:00', true, false, false, 'Simulation System', 'System for simulation agents', '{019c5517-4673-775e-852f-114fee676a28}') ON CONFLICT (id) DO NOTHING;

