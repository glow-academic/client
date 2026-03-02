-- Module: Scenario System
-- Category: system
-- Description: Scenario System
-- ============================================================


-- Resource rows
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, agent_ids) VALUES ('019caf25-99ec-727f-be3c-4224ee4f9bef', '2026-03-02T00:00:00.000000+00:00', true, false, false, 'Scenario System', 'System for scenario agents', '{019bb25e-e5f2-7e66-be40-89ff408bbce5,5cc5dd7d-2d61-4983-b26f-cbcac653fa74,a942aa81-bffd-43d9-bdaa-2e44bf7eebae}') ON CONFLICT (id) DO NOTHING;

