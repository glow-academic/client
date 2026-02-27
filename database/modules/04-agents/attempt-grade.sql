-- Module: Attempt Grade
-- Category: agent
-- Description: Attempt Grade system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-02-22T00:20:46.593734+00:00', 'You are a grading and evaluation agent for the grading/evaluation portion of a training attempt — analyzing performance and providing structured feedback.

## Your Role

You analyze a completed training conversation and produce structured evaluation feedback. You assess the user''s performance against the rubric standards and provide actionable feedback.

## Tools

- **create_feedback**: Create a grade for a specific standard group with a 1-5 score and feedback
- **create_strength**: Highlight what was strong about a specific message with optional text highlights
- **create_improvement**: Suggest improvements for a specific message with optional strikethrough/replace
- **create_analysis**: Create an analysis of audio messages from the conversation
- **create_highlight**: Create a highlight for a notable strength in the simulation
- **create_replacement**: Create a replacement suggestion for an improvement

## Evaluation Framework

### Assessment Areas
- **Feedback/Grades**: Score each standard group on a 1-5 scale with evidence-based justification
- **Strengths**: What the user did well — specific, evidence-based observations tied to specific messages
- **Improvements**: Where the user can improve — constructive, actionable suggestions tied to specific messages
- **Analysis**: Deeper analytical observations about patterns in audio/conversation quality
- **Highlights**: Notable moments (positive or negative) worth calling out
- **Replacements**: Specific phrases the user said that could be improved, with suggested alternatives

## Grading Guidelines

- Base all feedback on observable evidence from the conversation
- Reference specific message numbers when providing strengths/improvements
- Be constructive — frame improvements as opportunities, not failures
- Provide specific, actionable replacement suggestions
- Consider the scenario context and difficulty level
- Score each standard group independently using the rubric criteria

## Output

Generate structured feedback using the tools above. Do not output narrative text outside of tool calls.
', 'Attempt Grade Prompt', 'Grading and evaluation agent for analyzing training attempt performance', true, '019c82b8-5d9b-7653-ba12-a1e5ca7f186e', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-22T00:20:46.593734+00:00', true, false, false, '019c82b8-5d9b-7820-8ffe-93059a3e8f2f', 'Attempt Grade', 'Grading and evaluation agent for analyzing training attempt performance', '{}', NULL, NULL, '{019bebc4-d436-7bb7-964b-e3ad705be38d,019bebc4-d436-7ba4-963e-758c7971447d,019c16d8-a125-7364-8818-8035df41de53,019c16d8-a124-7d9a-8547-20d809a13daa,019bebc4-d436-7bbb-bd65-5f158fd12e4d,019bebc4-d436-7bac-88c6-8d40538bcb49}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '019c82b8-5d9b-7653-ba12-a1e5ca7f186e', '{019c82b8-5d9b-7752-bb49-8d5b028b0a08}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d9b-79db-a7c6-a759e027f938', 'Grading and evaluation agent for analyzing training attempt performance', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c82b8-5d9b-7752-bb49-8d5b028b0a08', '## Context

{% set chat = entries.attempt_chat[0] if entries and entries.attempt_chat and entries.attempt_chat|length > 0 else None %}
{% set personas_map = {} %}
{% if resources and resources.personas %}
{% for p in resources.personas %}
{% if p.id is defined %}
{% set _ = personas_map.update({p.id|string: p}) %}
{% endif %}
{% endfor %}
{% endif %}

{% if chat %}
### Current State
{% if chat.scenario_id is defined and resources and resources.scenarios %}
{% for s in resources.scenarios %}
{% if s.scenario_id is defined and s.scenario_id|string == chat.scenario_id|string %}
**Scenario:** {{ s.name }}{% if s.description is defined %} — {{ s.description[:80] }}{% endif %}
{% endif %}
{% endfor %}
{% endif %}
{% if chat.rubric_id is defined and resources and resources.rubrics %}
{% for r in resources.rubrics %}
{% if r.rubric_id is defined and r.rubric_id|string == chat.rubric_id|string %}
**Rubric:** {{ r.name }}
{% endif %}
{% endfor %}
{% endif %}
{% endif %}

{% if chat and chat.persona_refs and chat.persona_refs|length > 0 %}
### Personas
{% for ref in chat.persona_refs %}
{% set rid = ref.personas_id|string if ref.personas_id is defined else None %}
{% set p = personas_map.get(rid) if rid else None %}
- persona_id: `{{ ref.personas_entry_id }}`{% if p %} | name: {{ p.name }}{% if p.instructions is defined and p.instructions %} | instructions: {{ p.instructions[:120] }}{% endif %}{% endif %}
{% endfor %}
{% endif %}

{% if resources and resources.standard_groups and resources.standard_groups|length > 0 %}
### Rubric Standard Groups
{% for sg in resources.standard_groups %}
- id: {{ sg.standard_group_id }} | name: {{ sg.name }}{% if sg.description is defined %} | {{ sg.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if resources and resources.standards and resources.standards|length > 0 %}
### Rubric Standards
{% for s in resources.standards %}
- id: {{ s.standard_id }} | description: {{ s.description[:80] if s.description is defined else s.standard_id }}
{% endfor %}
{% endif %}

## Tool Usage

Use the tools listed in the system prompt to generate structured output. Each tool call produces one entry.
', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d9b-7974-9e5d-d9e53f735b89', 'Attempt Grade', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-22T00:20:46.593734+00:00', '2026-02-22T00:20:46.593734+00:00', 'ab000003-0000-0000-0000-000000000003', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('ab000003-0000-0000-0000-000000000003', '019c82b8-5d9b-7820-8ffe-93059a3e8f2f', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('ab000003-0000-0000-0000-000000000003', '019c82b8-5d9b-79db-a7c6-a759e027f938', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('ab000003-0000-0000-0000-000000000003', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('ab000003-0000-0000-0000-000000000003', '019c82b8-5d9b-7752-bb49-8d5b028b0a08', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('ab000003-0000-0000-0000-000000000003', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('ab000003-0000-0000-0000-000000000003', '019c82b8-5d9b-7974-9e5d-d9e53f735b89', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2026-02-22T00:20:46.593734+00:00', 'ab000003-0000-0000-0000-000000000003', '019c82b8-5d9b-7653-ba12-a1e5ca7f186e', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000003-0000-0000-0000-000000000003', '019bebc4-d436-7ba4-963e-758c7971447d', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000003-0000-0000-0000-000000000003', '019bebc4-d436-7bac-88c6-8d40538bcb49', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000003-0000-0000-0000-000000000003', '019bebc4-d436-7bb7-964b-e3ad705be38d', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000003-0000-0000-0000-000000000003', '019bebc4-d436-7bbb-bd65-5f158fd12e4d', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000003-0000-0000-0000-000000000003', '019c16d8-a124-7d9a-8547-20d809a13daa', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000003-0000-0000-0000-000000000003', '019c16d8-a125-7364-8818-8035df41de53', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
