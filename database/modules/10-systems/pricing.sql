-- Module: Pricing System
-- Category: system
-- Description: Pricing System
-- ============================================================


-- Resource rows
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, agent_ids) VALUES ('019caf25-99e4-7571-8bb7-155d53173005', '2026-03-02T00:00:00.000000+00:00', true, false, false, 'Pricing System', 'System for pricing agents', '{019c82b8-5da1-7a99-9f13-ab3e41542df1}') ON CONFLICT (id) DO NOTHING;

