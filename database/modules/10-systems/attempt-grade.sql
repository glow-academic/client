-- Module: Attempt Grade System
-- Category: system
-- Description: Attempt Grade System
-- ============================================================


-- Resource rows
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, agent_ids) VALUES ('019caf25-99cb-700e-b879-41628a9218c5', '2026-03-02T00:00:00.000000+00:00', true, false, false, 'Attempt Grade System', 'System for attempt-grade agents', '{019c82b8-5d9b-7820-8ffe-93059a3e8f2f}') ON CONFLICT (id) DO NOTHING;

