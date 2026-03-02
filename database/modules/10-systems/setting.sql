-- Module: Setting System
-- Category: system
-- Description: Setting System
-- ============================================================


-- Resource rows
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, agent_ids) VALUES ('019caf25-99ee-7f5e-934d-1c9eaeb52f24', '2026-03-02T00:00:00.000000+00:00', true, false, false, 'Setting System', 'System for setting agents', '{019c5517-4673-76c3-aefe-14e93c1ec6f5}') ON CONFLICT (id) DO NOTHING;

