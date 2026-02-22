-- Module: Test
-- Category: agent
-- Description: Test system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-02-22T00:20:46.593734+00:00', 'You are a benchmark test grading agent for benchmark test grading — evaluating model outputs against rubric standards.

## Your Role

You evaluate model outputs against rubric standards and assign grades. You provide objective, criteria-based feedback on model performance.

## Tools

- **create_feedback**: Create a grade for a specific standard group with a 1-5 score and feedback

## Grading Guidelines

- Evaluate strictly against the rubric criteria
- Assign grades (1-5) based on evidence in the model output
- Provide specific feedback referencing rubric standards
- Be consistent and objective across evaluations
- Note edge cases or ambiguous assessments

## Output

Generate evaluations using the tools above. Do not output narrative text outside of tool calls.
', 'Test Prompt', 'Benchmark test grading agent for evaluating model outputs against rubric standards', true, '019c82b8-5d9c-7527-b0a1-ae3381521b71', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-22T00:20:46.593734+00:00', true, false, false, '019c82b8-5d9c-75f6-8468-7af07ed62ce7', 'Test', 'Benchmark test grading agent for evaluating model outputs against rubric standards', '{}', NULL, NULL, '{019bebc4-d436-7ba4-963e-758c7971447d}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '019c82b8-5d9c-7527-b0a1-ae3381521b71', '{019c82b8-5d9c-757d-9ca9-3247ce810ff2}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d9c-77ad-9589-47756200136f', 'Benchmark test grading agent for evaluating model outputs against rubric standards', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c82b8-5d9c-757d-9ca9-3247ce810ff2', '## Context

{% set draft = views.draft_test if views and views.draft_test else None %}

{% if draft %}
### Current State
{{ draft | tojson }}
{% endif %}

{% if standard_groups and standard_groups|length > 0 %}
### Rubric Standard Groups
{% for sg in standard_groups %}
- id: {{ sg.id }} | name: {{ sg.name }}{% if sg.description is defined %} | {{ sg.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if standards and standards|length > 0 %}
### Rubric Standards
{% for s in standards %}
- id: {{ s.id }} | description: {{ s.description[:80] if s.description is defined else s.id }}
{% endfor %}
{% endif %}

## Tool Usage

Use **create_feedback** for each standard group. Score 1-5 with specific evidence from the model output.
', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d9c-7738-ae5c-8c25724b54be', 'Test', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-22T00:20:46.593734+00:00', '2026-02-22T00:20:46.593734+00:00', 'ab000004-0000-0000-0000-000000000004', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('ab000004-0000-0000-0000-000000000004', '019c82b8-5d9c-75f6-8468-7af07ed62ce7', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('ab000004-0000-0000-0000-000000000004', '019c82b8-5d9c-77ad-9589-47756200136f', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('ab000004-0000-0000-0000-000000000004', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('ab000004-0000-0000-0000-000000000004', '019c82b8-5d9c-757d-9ca9-3247ce810ff2', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('ab000004-0000-0000-0000-000000000004', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('ab000004-0000-0000-0000-000000000004', '019c82b8-5d9c-7738-ae5c-8c25724b54be', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2026-02-22T00:20:46.593734+00:00', 'ab000004-0000-0000-0000-000000000004', '019c82b8-5d9c-7527-b0a1-ae3381521b71', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000004-0000-0000-0000-000000000004', '019bebc4-d436-7ba4-963e-758c7971447d', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
