-- Module: Chat System
-- Category: system
-- Description: Chat System
-- ============================================================


-- Resource rows
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, agent_ids) VALUES ('019caf25-99d0-7d2c-bfba-49be9f4acd87', '2026-03-02T00:00:00.000000+00:00', true, false, false, 'Chat System', 'System for chat agents', '{bb000003-0000-0000-0000-000000000003}') ON CONFLICT (id) DO NOTHING;

