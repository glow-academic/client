-- Module: Model System
-- Category: system
-- Description: Model System
-- ============================================================


-- Resource rows
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, agent_ids) VALUES ('019caf25-99df-716b-abc9-a4c3ba2f32c8', '2026-03-02T00:00:00.000000+00:00', true, false, false, 'Model System', 'System for model agents', '{019c5517-4673-73a7-967b-11d2389f9cc5}') ON CONFLICT (id) DO NOTHING;

