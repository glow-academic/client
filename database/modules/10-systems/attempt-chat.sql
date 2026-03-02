-- Module: Attempt Chat System
-- Category: system
-- Description: Attempt Chat System
-- ============================================================


-- Resource rows
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, agent_ids) VALUES ('019caf25-99ca-7f95-9038-206fe1734be3', '2026-03-02T00:00:00.000000+00:00', true, false, false, 'Attempt Chat System', 'System for attempt-chat agents', '{019c82b8-5d9a-78e6-9e8d-03b45dba7d6b,019c82b8-5d9a-7b9e-92f2-278f3c55d7aa}') ON CONFLICT (id) DO NOTHING;

