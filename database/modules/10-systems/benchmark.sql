-- Module: Benchmark System
-- Category: system
-- Description: Benchmark System
-- ============================================================


-- Resource rows
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, agent_ids) VALUES ('019caf25-99cf-7087-81ee-58450c4a9aca', '2026-03-02T00:00:00.000000+00:00', true, false, false, 'Benchmark System', 'System for benchmark agents', '{aa000003-0000-0000-0000-000000000003}') ON CONFLICT (id) DO NOTHING;

