-- Module: Scenario Image
-- Category: agent
-- Description: Scenario Image system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-03-02T00:00:00.000000+00:00', 'You are the image generation agent for the scenario system. Your role is to generate images that visually support training scenarios.

## Your Role

You generate images for scenarios based on the scenario context provided. Each image should:
- Visually represent the scenario setting, characters, or key elements
- Support the learning objectives of the scenario
- Be appropriate for an educational/training context
- Have a realistic, professional style suitable for university training

## Guidelines

- Generate images that match the scenario''s tone and setting
- Include relevant environmental details (office hours, lab, classroom, etc.)
- Depict characters and situations that align with the persona descriptions
- Avoid text in images unless specifically needed
- Use consistent visual style across images for the same scenario

## Output

Use the create_image_entry tool to create image entries. The system will handle the actual image generation pipeline.
', 'Scenario Image Prompt', 'Image generation agent for creating scenario visuals', true, 'bf0c388b-6766-45e9-99c6-f0794ad014dd', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voices, model_id, prompt_id, instruction_ids) VALUES ('2026-03-02T00:00:00.000000+00:00', true, false, false, '5cc5dd7d-2d61-4983-b26f-cbcac653fa74', 'Scenario Image', 'Image generation agent for creating scenario visuals', '{}', NULL, NULL, '{84bf47ec-87ea-4920-9c99-dba7e1f798b0}', NULL, '{}', '019bb25e-e5ff-77e2-adc5-3da02dbd1fa2', 'bf0c388b-6766-45e9-99c6-f0794ad014dd', '{}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('c5bb2ab9-d740-484f-8db0-f17dc2bff89a', 'Image generation agent for creating scenario visuals', '2026-03-02T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('33bf631e-fbe2-45d9-af36-feb43b431980', 'Scenario Image', '2026-03-02T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-03-02T00:00:00.000000+00:00', '2026-03-02T00:00:00.000000+00:00', 'f6533535-6087-4e6d-9fd3-ed92cc9c1021', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('f6533535-6087-4e6d-9fd3-ed92cc9c1021', '5cc5dd7d-2d61-4983-b26f-cbcac653fa74', true, '2026-03-02T00:00:00.000000+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, active, created_at, generated, mcp)
SELECT 'f6533535-6087-4e6d-9fd3-ed92cc9c1021', ar.model_id, true, '2026-03-02T00:00:00.000000+00:00', false, false
FROM public.agents_resource ar
WHERE ar.id = '5cc5dd7d-2d61-4983-b26f-cbcac653fa74'
  AND ar.model_id IS NOT NULL
ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('f6533535-6087-4e6d-9fd3-ed92cc9c1021', 'c5bb2ab9-d740-484f-8db0-f17dc2bff89a', '2026-03-02T00:00:00.000000+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, created_at, generated, mcp, active) VALUES ('f6533535-6087-4e6d-9fd3-ed92cc9c1021', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', '2026-03-02T00:00:00.000000+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('f6533535-6087-4e6d-9fd3-ed92cc9c1021', '33bf631e-fbe2-45d9-af36-feb43b431980', '2026-03-02T00:00:00.000000+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('f6533535-6087-4e6d-9fd3-ed92cc9c1021', '84bf47ec-87ea-4920-9c99-dba7e1f798b0', true, '2026-03-02T00:00:00.000000+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
