-- Module: Test Insight System
-- Category: system
-- Description: Test Insight System
-- ============================================================


-- Resource rows
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, agent_ids) VALUES ('019caf25-99f1-7230-bee2-f5e15bd56400', '2026-03-02T00:00:00.000000+00:00', true, false, false, 'Test Insight System', 'System for test-insight agents', '{018f0005-0006-7000-8000-000000000002}') ON CONFLICT (id) DO NOTHING;

