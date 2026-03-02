-- Module: Health System
-- Category: system
-- Description: Health System
-- ============================================================


-- Resource rows
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, agent_ids) VALUES ('019caf25-99da-7af2-875a-9c8eb8fd70e9', '2026-03-02T00:00:00.000000+00:00', true, false, false, 'Health System', 'System for health agents', '{019c82b8-5da2-74d6-ad4a-7c594c69f082}') ON CONFLICT (id) DO NOTHING;

