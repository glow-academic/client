-- Module: Parameter System
-- Category: system
-- Description: Parameter System
-- ============================================================


-- Resource rows
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, agent_ids) VALUES ('019caf25-99e0-7e2c-9f64-37bde94a00c6', '2026-03-02T00:00:00.000000+00:00', true, false, false, 'Parameter System', 'System for parameter agents', '{019c5517-4673-74b4-991e-153c7b8a9174}') ON CONFLICT (id) DO NOTHING;

