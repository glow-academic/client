-- Module: Activity System
-- Category: system
-- Description: Activity System
-- ============================================================


-- Resource rows
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, agent_ids) VALUES ('019caf25-99c7-78a6-849d-1258f99e47e4', '2026-03-02T00:00:00.000000+00:00', true, false, false, 'Activity System', 'System for activity agents', '{019c82b8-5da0-7643-85e9-141ecd4b1235}') ON CONFLICT (id) DO NOTHING;

