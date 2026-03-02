-- Module: Home System
-- Category: system
-- Description: Home System
-- ============================================================


-- Resource rows
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, agent_ids) VALUES ('019caf25-99db-7090-87a2-0c2dff148860', '2026-03-02T00:00:00.000000+00:00', true, false, false, 'Home System', 'System for home agents', '{019c82b8-5d9d-710d-ae51-3080db0b7b55}') ON CONFLICT (id) DO NOTHING;

