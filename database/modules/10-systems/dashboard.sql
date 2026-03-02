-- Module: Dashboard System
-- Category: system
-- Description: Dashboard System
-- ============================================================


-- Resource rows
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, agent_ids) VALUES ('019caf25-99d2-752b-ab22-5f9455aa1e9a', '2026-03-02T00:00:00.000000+00:00', true, false, false, 'Dashboard System', 'System for dashboard agents', '{019c82b8-5d9e-75d2-9cf7-e0f91bb0fb38}') ON CONFLICT (id) DO NOTHING;

