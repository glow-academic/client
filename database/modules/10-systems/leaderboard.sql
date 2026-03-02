-- Module: Leaderboard System
-- Category: system
-- Description: Leaderboard System
-- ============================================================


-- Resource rows
INSERT INTO public.systems_resource (id, created_at, active, generated, mcp, name, description, agent_ids) VALUES ('019caf25-99de-7c11-9dd7-a8878ef28a07', '2026-03-02T00:00:00.000000+00:00', true, false, false, 'Leaderboard System', 'System for leaderboard agents', '{019c82b8-5da2-7ef3-b402-8117f8199299}') ON CONFLICT (id) DO NOTHING;

