-- Module: Attempt Chat
-- Category: agent
-- Description: Attempt Chat system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-02-22T00:20:46.593734+00:00', 'You are the conversational AI for the conversational portion of a training attempt — the AI acts as the persona conducting the training dialogue.

## Your Role

You are conducting the training dialogue as the assigned persona. You must:
- Embody the persona''s character, tone, and behavioral patterns
- Follow the scenario context and objectives
- Engage naturally in conversation
- Create a realistic training experience

## Conversation Behavior

- Stay in character at all times
- Respond to user messages naturally and contextually
- Guide the conversation toward learning objectives without being obvious
- Provide hints when the user is struggling (if configured)
- Generate content blocks that enrich the conversation when appropriate

## Tools

- **create_content**: Make a persona speak — generate the in-character response as a content block
- **create_hint**: Create a strategic hint for the user when they are struggling

## Output

Generate responses as the persona using the tools above. Do not output narrative text outside of tool calls.
', 'Attempt Chat Prompt', 'Conversational AI agent for conducting training dialogues as personas', true, '019c82b8-5d9a-77db-96a2-1296d995fd35', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-22T00:20:46.593734+00:00', true, false, false, '019c82b8-5d9a-78e6-9e8d-03b45dba7d6b', NULL, NULL, '{}', NULL, NULL, '{019bebc4-d436-7b60-9f57-f7c03f636fac,019bebc4-d436-7ba3-9c29-c24f308f6e56,019bebc4-d436-7b79-9a9b-f4ca94396178}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '019c82b8-5d9a-77db-96a2-1296d995fd35', '{019c82b8-5d9a-783f-b383-19b5d186a49d}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d9a-7acc-8e17-f49379856a8e', 'Conversational AI agent for conducting training dialogues as personas', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c82b8-5d9a-783f-b383-19b5d186a49d', '## Context

{% set draft = views.draft_attempt_chat if views and views.draft_attempt_chat else None %}

{% if draft %}
### Current State
{% if draft.scenario_name is defined %}
**Scenario:** {{ draft.scenario_name }}
{% endif %}
{% if draft.persona_name is defined %}
**Persona:** {{ draft.persona_name }}
{% endif %}
{% if draft.rubric_name is defined %}
**Rubric:** {{ draft.rubric_name }}
{% endif %}
{% if draft.department_ids is defined and draft.department_ids and draft.department_ids|length > 0 %}
**Departments:** {% for id in draft.department_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% endif %}
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

Use the tools listed in the system prompt to generate structured output. Each tool call produces one entry.
', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d9a-7a50-93bb-02be93b4bd8e', 'Attempt Chat', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-22T00:20:46.593734+00:00', '2026-02-22T00:20:46.593734+00:00', 'ab000002-0000-0000-0000-000000000002', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('ab000002-0000-0000-0000-000000000002', '019c82b8-5d9a-78e6-9e8d-03b45dba7d6b', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('ab000002-0000-0000-0000-000000000002', '019c82b8-5d9a-7acc-8e17-f49379856a8e', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('ab000002-0000-0000-0000-000000000002', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('ab000002-0000-0000-0000-000000000002', '019c82b8-5d9a-783f-b383-19b5d186a49d', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('ab000002-0000-0000-0000-000000000002', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('ab000002-0000-0000-0000-000000000002', '019c82b8-5d9a-7a50-93bb-02be93b4bd8e', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2026-02-22T00:20:46.593734+00:00', 'ab000002-0000-0000-0000-000000000002', '019c82b8-5d9a-77db-96a2-1296d995fd35', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000002-0000-0000-0000-000000000002', '019bebc4-d436-7b60-9f57-f7c03f636fac', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000002-0000-0000-0000-000000000002', '019bebc4-d436-7ba3-9c29-c24f308f6e56', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000002-0000-0000-0000-000000000002', '019bebc4-d436-7b79-9a9b-f4ca94396178', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
