-- Module: Scenario Video
-- Category: agent
-- Description: Scenario Video system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-03-02T00:00:00.000000+00:00', 'You are the video generation agent for the scenario system. Your role is to generate videos that visually support training scenarios.

## Your Role

You generate videos for scenarios based on the scenario context provided. Each video should:
- Visually represent the scenario setting, characters, or key interactions
- Support the learning objectives of the scenario
- Be appropriate for an educational/training context
- Depict realistic interactions suitable for university training simulations

## Guidelines

- Generate videos that match the scenario''s tone and setting
- Include relevant environmental details (office hours, lab, classroom, etc.)
- Depict characters and situations that align with the persona descriptions
- Keep videos concise and focused on the key scenario elements
- Specify an appropriate length in seconds for the content

## Output

Use the create_video_entry tool to create video entries. Specify the length_seconds parameter based on the complexity of the scene. The system will handle the actual video generation pipeline.
', 'Scenario Video Prompt', 'Video generation agent for creating scenario visuals', true, '6a5e8e54-03e2-424f-b3b5-9a4971544531', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voices, model_id, prompt_id, instruction_ids) VALUES ('2026-03-02T00:00:00.000000+00:00', true, false, false, 'a942aa81-bffd-43d9-bdaa-2e44bf7eebae', 'Scenario Video', 'Video generation agent for creating scenario visuals', '{}', NULL, NULL, '{f3ca206e-801e-4074-8266-f94f3d332874}', NULL, '{}', '019bb25e-e5ff-7786-906a-923b3bf6d8d7', '6a5e8e54-03e2-424f-b3b5-9a4971544531', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('15fbbb68-e16c-4500-943f-6d14dd199ba3', 'Video generation agent for creating scenario visuals', '2026-03-02T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('a238e815-43f5-45b8-b378-e9dea62f618d', 'Scenario Video', '2026-03-02T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-03-02T00:00:00.000000+00:00', '2026-03-02T00:00:00.000000+00:00', '3937bcae-527f-495f-82c5-476d18ce7fed', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('3937bcae-527f-495f-82c5-476d18ce7fed', 'a942aa81-bffd-43d9-bdaa-2e44bf7eebae', true, '2026-03-02T00:00:00.000000+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, active, created_at, generated, mcp)
SELECT '3937bcae-527f-495f-82c5-476d18ce7fed', ar.model_id, true, '2026-03-02T00:00:00.000000+00:00', false, false
FROM public.agents_resource ar
WHERE ar.id = 'a942aa81-bffd-43d9-bdaa-2e44bf7eebae'
  AND ar.model_id IS NOT NULL
ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('3937bcae-527f-495f-82c5-476d18ce7fed', '15fbbb68-e16c-4500-943f-6d14dd199ba3', '2026-03-02T00:00:00.000000+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, created_at, generated, mcp, active) VALUES ('3937bcae-527f-495f-82c5-476d18ce7fed', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', '2026-03-02T00:00:00.000000+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('3937bcae-527f-495f-82c5-476d18ce7fed', 'a238e815-43f5-45b8-b378-e9dea62f618d', '2026-03-02T00:00:00.000000+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('3937bcae-527f-495f-82c5-476d18ce7fed', 'f3ca206e-801e-4074-8266-f94f3d332874', true, '2026-03-02T00:00:00.000000+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
