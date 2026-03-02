-- Module: Reports System
-- Category: system
-- Description: Reports System
-- ============================================================


-- Resource rows
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, agent_ids) VALUES ('019caf25-99e9-72be-8c27-e3f264eeefa4', '2026-03-02T00:00:00.000000+00:00', true, false, false, 'Reports System', 'System for reports agents', '{019c82b8-5d9f-71af-a2ac-3bfc3d189410}') ON CONFLICT (id) DO NOTHING;

