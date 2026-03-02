-- Module: Rubric System
-- Category: system
-- Description: Rubric System
-- ============================================================


-- Resource rows
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, agent_ids) VALUES ('019caf25-99ea-7f17-8bac-4ed76165c512', '2026-03-02T00:00:00.000000+00:00', true, false, false, 'Rubric System', 'System for rubric agents', '{019bb25e-e5f2-7f73-abf4-164c630526b2}') ON CONFLICT (id) DO NOTHING;

