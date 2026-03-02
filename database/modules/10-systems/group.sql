-- Module: Group System
-- Category: system
-- Description: Group System
-- ============================================================


-- Resource rows
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, agent_ids) VALUES ('019caf25-99d9-73dc-a8be-a47def47c3e0', '2026-03-02T00:00:00.000000+00:00', true, false, false, 'Group System', 'System for group agents', '{019c82b8-5da3-7920-b0c5-40255a3f8dc2}') ON CONFLICT (id) DO NOTHING;

