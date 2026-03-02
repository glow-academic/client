-- Module: Attempt Insight System
-- Category: system
-- Description: Attempt Insight System
-- ============================================================


-- Resource rows
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, agent_ids) VALUES ('019caf25-99cc-7cc3-a040-981957508b2a', '2026-03-02T00:00:00.000000+00:00', true, false, false, 'Attempt Insight System', 'System for attempt-insight agents', '{018f0005-0006-7000-8000-000000000001}') ON CONFLICT (id) DO NOTHING;

