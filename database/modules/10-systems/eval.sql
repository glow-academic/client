-- Module: Eval System
-- Category: system
-- Description: Eval System
-- ============================================================


-- Resource rows
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, agent_ids) VALUES ('019caf25-99d6-70d6-90eb-f580991fcf89', '2026-03-02T00:00:00.000000+00:00', true, false, false, 'Eval System', 'System for eval agents', '{019c82b8-5d91-7995-a6ef-94dcca1c92be}') ON CONFLICT (id) DO NOTHING;

