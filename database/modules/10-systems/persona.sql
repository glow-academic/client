-- Module: Persona System
-- Category: system
-- Description: Persona System
-- ============================================================


-- Resource rows
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, agent_ids) VALUES ('019caf25-99e1-717c-b4ea-8a6055664887', '2026-03-02T00:00:00.000000+00:00', true, false, false, 'Persona System', 'System for persona agents', '{019bb25e-e5f2-7f9e-8027-3334ababb644}') ON CONFLICT (id) DO NOTHING;

