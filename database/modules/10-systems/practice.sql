-- Module: Practice System
-- Category: system
-- Description: Practice System
-- ============================================================


-- Resource rows
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, agent_ids) VALUES ('019caf25-99e3-723d-920c-78e5ac8f19dd', '2026-03-02T00:00:00.000000+00:00', true, false, false, 'Practice System', 'System for practice agents', '{019c82b8-5d9d-7a85-8319-3a24981188b7}') ON CONFLICT (id) DO NOTHING;

