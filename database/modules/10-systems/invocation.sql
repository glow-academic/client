-- Module: Invocation System
-- Category: system
-- Description: Invocation System
-- ============================================================


-- Resource rows
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, agent_ids) VALUES ('019caf25-99dc-73fa-848e-fcc5947b6bb1', '2026-03-02T00:00:00.000000+00:00', true, false, false, 'Invocation System', 'System for invocation agents', '{019c82b8-5d98-7674-8cd4-2ed7bdddf354}') ON CONFLICT (id) DO NOTHING;

