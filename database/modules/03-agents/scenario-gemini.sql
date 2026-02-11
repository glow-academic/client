-- Module: Scenario (Gemini)
-- Category: agent
-- Description: Scenario (Gemini) system agent
-- ============================================================


-- Resource rows
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('842fd8e9-a853-41c0-9319-db3c28fffe98', 'Scenario (Gemini)', '2026-01-23T16:46:46.036849+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-01-23T16:46:46.036849+00:00', '2026-01-23T16:46:46.036849+00:00', '73e9692c-88b3-420a-9a3f-b17b150b2505', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('73e9692c-88b3-420a-9a3f-b17b150b2505', '019b3be4-36cd-7821-9ad2-6c260f8271b9', '2026-01-23T16:46:46.036849+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('73e9692c-88b3-420a-9a3f-b17b150b2505', '842fd8e9-a853-41c0-9319-db3c28fffe98', '2026-01-23T16:46:46.036849+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
