-- Module: Cohort System
-- Category: system
-- Description: Cohort System
-- ============================================================


-- Resource rows
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, agent_ids) VALUES ('019caf25-99d1-771d-a01f-80f8aae924df', '2026-03-02T00:00:00.000000+00:00', true, false, false, 'Cohort System', 'System for cohort agents', '{019c5517-4673-7073-adf9-00c0bd4e21dc}') ON CONFLICT (id) DO NOTHING;

