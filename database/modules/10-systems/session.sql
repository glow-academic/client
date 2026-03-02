-- Module: Session System
-- Category: system
-- Description: Session System
-- ============================================================


-- Resource rows
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, agent_ids) VALUES ('019caf25-99ed-79c0-926c-d302897f4322', '2026-03-02T00:00:00.000000+00:00', true, false, false, 'Session System', 'System for session agents', '{019c82b8-5da1-709c-ad48-dc0a2ec99a49}') ON CONFLICT (id) DO NOTHING;

