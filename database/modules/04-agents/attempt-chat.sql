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
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-22T00:20:46.593734+00:00', true, false, false, '019c82b8-5d9a-78e6-9e8d-03b45dba7d6b', 'Attempt Chat', 'Conversational AI agent for conducting training dialogues as personas', '{}', NULL, NULL, '{019bebc4-d436-7b60-9f57-f7c03f636fac,019bebc4-d436-7b79-9a9b-f4ca94396178,019bebc4-d436-7ba3-9c29-c24f308f6e56,019522a0-0020-7000-8000-00000000000c}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '019c82b8-5d9a-77db-96a2-1296d995fd35', '{019c82b8-5d9a-783f-b383-19b5d186a49d}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d9a-7acc-8e17-f49379856a8e', 'Conversational AI agent for conducting training dialogues as personas', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c82b8-5d9a-783f-b383-19b5d186a49d', '## Context

{% set chat = artifacts.attempt.get.entries.attempt_chat[0] if artifacts.attempt.get.entries and artifacts.attempt.get.entries.attempt_chat and artifacts.attempt.get.entries.attempt_chat|length > 0 else None %}
{% set personas_map = {} %}
{% if artifacts.attempt.get.resources and artifacts.attempt.get.resources.personas %}
{% for p in artifacts.attempt.get.resources.personas %}
{% if p.id is defined %}
{% set _ = personas_map.update({p.id|string: p}) %}
{% endif %}
{% endfor %}
{% endif %}

{% if chat %}
### Current State
{% if chat.scenario_id is defined and artifacts.attempt.get.resources and artifacts.attempt.get.resources.scenarios %}
{% for s in artifacts.attempt.get.resources.scenarios %}
{% if s.scenario_id is defined and s.scenario_id|string == chat.scenario_id|string %}
**Scenario:** {{ s.name }}{% if s.description is defined %} — {{ s.description[:80] }}{% endif %}
{% endif %}
{% endfor %}
{% endif %}
{% endif %}

{% if artifacts.attempt.get.resources and artifacts.attempt.get.resources.problem_statements and artifacts.attempt.get.resources.problem_statements|length > 0 %}
### Problem Statement
{% for ps in artifacts.attempt.get.resources.problem_statements %}
{{ ps.problem_statement }}
{% endfor %}
{% endif %}

{% if artifacts.attempt.get.resources and artifacts.attempt.get.resources.objectives and artifacts.attempt.get.resources.objectives|length > 0 %}
### Objectives
{% for obj in artifacts.attempt.get.resources.objectives %}
- {{ obj.objective }}
{% endfor %}
{% endif %}

{% if chat and chat.persona_refs and chat.persona_refs|length > 0 %}
### Personas

Use the `persona_id` (personas_entry_id) when calling `create_content`.

{% for ref in chat.persona_refs %}
{% set rid = ref.personas_id|string if ref.personas_id is defined else None %}
{% set p = personas_map.get(rid) if rid else None %}
- **persona_id:** `{{ ref.personas_entry_id }}`{% if p %} | name: {{ p.name }}{% if p.instructions is defined and p.instructions %} | instructions: {{ p.instructions[:120] }}{% endif %}{% endif %}
{% endfor %}
{% endif %}

### Current Assistant Message
{% set ns = namespace(current_message=None) %}
{% if artifacts.attempt.get.entries and artifacts.attempt.get.entries.attempt_message %}
{% for m in artifacts.attempt.get.entries.attempt_message|reverse %}
{% if m.type == ''response'' and not ns.current_message %}
{% set ns.current_message = m %}
{% endif %}
{% endfor %}
{% endif %}
{% if ns.current_message %}
**message_id:** `{{ ns.current_message.id }}`
{% endif %}

## Tool Usage

Use the tools listed in the system prompt to generate structured output. Each tool call produces one entry.
When calling `create_content`, you MUST pass the `message_id` from the Current Assistant Message section above, one of the `persona_id` values from the Personas section, and the content text.
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
-- config_resource (from agent_models_junction)
INSERT INTO public.config_resource (id, model_id, prompt_id, instruction_ids, created_at, generated, mcp, active) VALUES ('81161d5d-aabb-508b-b781-8a97ca27f9df', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '019c82b8-5d9a-77db-96a2-1296d995fd35', ARRAY['019c82b8-5d9a-783f-b383-19b5d186a49d'::uuid], '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (id) DO NOTHING;
-- agent_configs_junction
INSERT INTO public.agent_configs_junction (agent_id, config_id, created_at, generated, mcp, active) VALUES ('ab000002-0000-0000-0000-000000000002', '81161d5d-aabb-508b-b781-8a97ca27f9df', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, config_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('ab000002-0000-0000-0000-000000000002', '019c82b8-5d9a-7a50-93bb-02be93b4bd8e', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000002-0000-0000-0000-000000000002', '019bebc4-d436-7b60-9f57-f7c03f636fac', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000002-0000-0000-0000-000000000002', '019bebc4-d436-7ba3-9c29-c24f308f6e56', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000002-0000-0000-0000-000000000002', '019bebc4-d436-7b79-9a9b-f4ca94396178', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000002-0000-0000-0000-000000000002', '019522a0-0020-7000-8000-00000000000c', true, '2026-02-24T11:27:01.778199+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
