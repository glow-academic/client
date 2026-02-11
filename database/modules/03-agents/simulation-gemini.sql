-- Module: Simulation (Gemini)
-- Category: agent
-- Description: Simulation (Gemini) system agent
-- ============================================================


-- Resource rows
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('fa599791-6c35-4b84-903d-74a5ce6041c5', 'Simulation (Gemini)', '2026-01-23T16:46:46.036849+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-01-23T16:46:46.036849+00:00', '2026-01-23T16:46:46.036849+00:00', '1a42f565-f92a-4e63-898b-2be179810a0b', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('1a42f565-f92a-4e63-898b-2be179810a0b', '019b3be4-36cd-7821-9ad2-6c260f8271b9', '2026-01-23T16:46:46.036849+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('1a42f565-f92a-4e63-898b-2be179810a0b', 'fa599791-6c35-4b84-903d-74a5ce6041c5', '2026-01-23T16:46:46.036849+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
