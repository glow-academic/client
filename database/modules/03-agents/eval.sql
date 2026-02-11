-- Module: Eval
-- Category: agent
-- Description: Eval system agent
-- ============================================================


-- Resource rows
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-03T19:33:56.322550+00:00', true, false, false, '019c24ff-49e2-7dee-b670-1478eab95447', 'Chat Agent', 'Agent responsible for augmenting messages with content blocks and hints during simulations', '{}', NULL, NULL, '{019bebc4-d436-7ba3-9c29-c24f308f6e56,019bebc4-d436-7b60-9f57-f7c03f636fac}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '019c16d8-a12c-70db-82d7-454f71f50c08', '{019c16d8-a12c-788f-8361-7201fed4f3e6}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bcd1c-333f-7a05-a8ba-10219e4394dc', 'AI agent for generating and managing eval resources including names, descriptions, flags, departments, scenarios, rubrics, and various eval-specific resources using GPT-5.1', '2026-01-17T17:58:56.053417+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c16d8-a12b-7bdf-84dc-6255f22e87a5', 'Agent responsible for augmenting messages with content blocks and hints during simulations', '2026-02-01T01:37:01.720364+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c16d8-a12c-788f-8361-7201fed4f3e6', '## Scenario Context
{% set current_chat = (views.simulation_chats | sort(attribute=''created_at'') | last) if views and views.simulation_chats else None %}
{% if current_chat and resources and resources.scenarios and current_chat.scenario_id %}
### Scenario
- Name: {{ resources.scenarios[current_chat.scenario_id|string].name }}{% if resources.scenarios[current_chat.scenario_id|string].description %} — {{ resources.scenarios[current_chat.scenario_id|string].description }}{% endif %}
{% endif %}

{% if current_chat and resources and resources.problem_statements and current_chat.problem_statement_id %}
### Problem Statement
- {{ resources.problem_statements[current_chat.problem_statement_id|string].problem_statement or resources.problem_statements[current_chat.problem_statement_id|string].description or resources.problem_statements[current_chat.problem_statement_id|string].text }}
{% endif %}

{% if current_chat and resources and resources.objectives and current_chat.objective_ids and current_chat.objective_ids|length > 0 %}
### Learning Objectives
{% for oid in current_chat.objective_ids %}
- {{ resources.objectives[oid|string].name }}{% if resources.objectives[oid|string].description %}: {{ resources.objectives[oid|string].description }}{% endif %}
{% endfor %}
{% endif %}

{% if current_chat and resources and resources.rubrics and current_chat.rubric_id %}
### Rubric
- {{ resources.rubrics[current_chat.rubric_id|string].name }}{% if resources.rubrics[current_chat.rubric_id|string].description %}: {{ resources.rubrics[current_chat.rubric_id|string].description }}{% endif %}
{% endif %}

{% if current_chat and resources and resources.personas and current_chat.persona_ids and current_chat.persona_ids|length > 0 %}
### Personas
{% for pid in current_chat.persona_ids %}
- {{ resources.personas[pid|string].name }} (ID: {{ pid }}){% if resources.personas[pid|string].description %}: {{ resources.personas[pid|string].description }}{% endif %}
{% if resources.personas[pid|string].instructions %}
  Instructions: {{ resources.personas[pid|string].instructions }}
{% endif %}
{% if resources.personas[pid|string].examples and resources.personas[pid|string].examples|length > 0 %}
  Examples:
  {% for ex in resources.personas[pid|string].examples %}- {{ ex }}{% endfor %}
{% endif %}
{% endfor %}
{% endif %}

{% if current_chat and resources and resources.documents and current_chat.document_ids and current_chat.document_ids|length > 0 %}
### Documents
{% for did in current_chat.document_ids %}
- {{ resources.documents[did|string].title or resources.documents[did|string].name or resources.documents[did|string].filename or did }}
{% endfor %}
{% endif %}

{% if current_chat and resources and resources.templates and current_chat.template_ids and current_chat.template_ids|length > 0 %}
### Templates
{% for tid in current_chat.template_ids %}
- {{ resources.templates[tid|string].name }}{% if resources.templates[tid|string].description %}: {{ resources.templates[tid|string].description }}{% endif %}
{% endfor %}
{% endif %}

{% if current_chat and resources and resources.questions and current_chat.question_ids and current_chat.question_ids|length > 0 %}
### Questions
{% for qid in current_chat.question_ids %}
- {{ resources.questions[qid|string].question or resources.questions[qid|string].text or resources.questions[qid|string].name }}
{% endfor %}
{% endif %}

{% if current_chat and resources and resources.options and current_chat.option_ids and current_chat.option_ids|length > 0 %}
### Options
{% for oid in current_chat.option_ids %}
- {{ resources.options[oid|string].option or resources.options[oid|string].text or resources.options[oid|string].name }}
{% endfor %}
{% endif %}

---

## Current Conversation
{% if current_chat %}
Chat ID: {{ current_chat.id }}{% if current_chat.title %} | Title: {{ current_chat.title }}{% endif %}
{% endif %}

{% set chat_messages = (views.simulation_messages | selectattr(''chat_id'', ''equalto'', current_chat.id) | list) if views and current_chat and views.simulation_messages else [] %}
{% set assistant_messages = (chat_messages | selectattr(''type'', ''equalto'', ''response'') | list) %}
{% set current_message = (assistant_messages | sort(attribute=''created_at'') | last) if assistant_messages and assistant_messages|length > 0 else (chat_messages | sort(attribute=''created_at'') | last) %}
{% if current_message %}
### Current Assistant Message
- Message ID: {{ current_message.id }}
- ({{ current_message.type }}) {{ current_message.contents[0].content if current_message.contents and current_message.contents|length > 0 else '''' }}
{% if current_message.hints and current_message.hints|length > 0 %}
  Hints:
  {% for h in current_message.hints %}- {{ h.hint }}{% endfor %}
{% endif %}
{% endif %}

## IMPORTANT: Tool Usage Rules

You MUST use `create_content` to provide your response. Do NOT respond with plain text — always call the tool.

### create_content (REQUIRED for every response)
Call `create_content` with:
- `message_id`: Use the **Message ID** shown in "Current Assistant Message" above (e.g. `{{ current_message.id if current_message else ''MESSAGE_ID'' }}`)
- `content`: Your full response text to the student
- `persona_id`: The ID of the persona you are responding as (see Personas section above{% if current_chat and resources and resources.personas and current_chat.persona_ids and current_chat.persona_ids|length > 0 %}, e.g. `{{ current_chat.persona_ids[0] }}`{% endif %})

{% if current_chat and current_chat.hints_enabled %}
### create_hint (optional, after create_content)
After creating content, you may also call `create_hint` to provide a hint:
- `message_id`: Same Message ID as above
- `hint`: A helpful hint for the student
{% endif %}

## Available Context Resources
Use the scenario, resources, and conversation above to generate content and hints that stay consistent with the learning objectives and context.
', true, '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019bb798-89d6-774a-a3b2-f6d57050833d', '## Current Draft Context
{% set draft = views.draft_eval if views and views.draft_eval else None %}
- draft_id: {{ draft.draft_id if draft else ''none'' }}
- regeneration_descriptions: {{ draft.regeneration_descriptions if draft else [] }}

## Current Selected Resources
- names: {{ names or [] }}
- descriptions: {{ descriptions or [] }}
- flags: {{ flags or [] }}
- departments: {{ departments or [] }}
- eval_agents: {{ eval_agents or [] }}
- rubrics: {{ rubrics or [] }}
- run_positions: {{ run_positions or [] }}
- group_positions: {{ group_positions or [] }}
- run_rubrics: {{ run_rubrics or [] }}
- group_rubrics: {{ group_rubrics or [] }}

## Rules
- Process only requested resource_types.
- Reuse suitable existing resources where possible.
- Create resources only for missing or weak selections.
- Keep run/group position and rubric mappings coherent.', true, '2026-01-13T13:43:05.942140+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bcd1c-333e-73c9-a949-c31c83edf84d', 'Eval', '2026-01-17T17:58:56.053417+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c16d8-a12b-75f3-9acf-257d83b4a81c', 'Chat Agent', '2026-02-01T01:37:01.720364+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-02-01T01:37:01.720364+00:00', 'You are a chat simulation agent responsible for augmenting messages in educational simulations with structured content and helpful hints.

## Your Tools
- **create_content**: Add structured content blocks to a message
- **create_hint**: Provide contextual hints to help students

## Guidelines
- Content should be educational and clearly structured
- Hints should be helpful without giving away answers
- Use the provided persona and scenario context
- Reference the current message when adding content/hints', 'Chat Agent System Prompt', 'System prompt for chat message augmentation agents', true, '019c16d8-a12c-70db-82d7-454f71f50c08', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-01-13T03:08:53.528135+00:00', 'You are the Eval Artifact Generation Agent for v4.

Generate or update only the requested eval resource_types:
names, descriptions, flags, departments, agents, run_positions, group_positions, run_rubrics, group_rubrics.

Rules:
- Operate only on requested resource_types.
- Prefer existing suitable resources when available.
- Create only what is needed for missing or weak selections.
- Keep run/group position and rubric mappings coherent.
- Do not invent IDs; use IDs from context when linking.

Output:
- Return only valid tool calls and arguments.
- Do not output narrative text.', 'Eval Agent System Prompt', 'System prompt for eval generation agents that create and manage eval resources', true, 'ffffffff-1111-1111-1111-ffffffffffff', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7b60-9f57-f7c03f636fac', '2026-01-17T17:57:40.541181+00:00', false, false, true, 'create_content', 'Make a persona speak by calling this tool with the persona name and message. The persona name must match one of the available personas (case-insensitive matching is supported).', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7ba3-9c29-c24f308f6e56', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_hint', 'Create a strategic hint for the GTA. This is one of multiple hints that should be distinct and focused on different aspects of helping the student (e.g., content explanation, emotional support, pedagogical approach). Call this tool multiple times to create multiple hints.', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c01-b86b-9483883762a6', '2026-01-17T17:58:56.073128+00:00', false, false, true, 'create_descriptions', 'Create a new descriptions resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7bf6-af0e-91e685a8f15e', '2026-01-17T17:58:56.069266+00:00', false, false, true, 'create_departments', 'Create a new departments resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af5-766c-9713-315ab9567235', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_flags', 'Use an existing flag resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7cd5-9cfb-f52df7b3d47d', '2026-01-17T17:58:56.053417+00:00', false, false, true, 'create_group_positions', 'Create a new group_positions resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c14-a42e-f45a12c4fdb0', '2026-01-17T17:58:56.073128+00:00', false, false, true, 'create_flags', 'Create a new flags resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af6-727b-b94a-71bddc4d76de', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_names', 'Use an existing name resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7ce3-babd-f4ea7d97e54c', '2026-01-17T17:58:56.053417+00:00', false, false, true, 'create_groups_rubric_grade_agents', 'Create a new groups_rubric_grade_agents resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af5-705d-ae92-7905a846a500', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_descriptions', 'Use an existing description resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c35-9f98-31957504bf95', '2026-01-17T17:58:56.073128+00:00', false, false, true, 'create_names', 'Create a new names resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7bde-91ab-92070869fe7f', '2026-01-17T17:58:56.053417+00:00', false, false, true, 'create_agents', 'Create a new agents resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af4-7c97-ab30-1e863db0e8e3', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_departments', 'Use an existing department resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7d07-9685-efb55bdcac10', '2026-01-17T17:58:56.053417+00:00', false, false, true, 'create_runs_rubric_grade_agents', 'Create a new runs_rubric_grade_agents resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7cfa-abc2-0b12c8166a91', '2026-01-17T17:58:56.053417+00:00', false, false, true, 'create_run_positions', 'Create a new run_positions resource', '{}', false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-01-17T17:58:56.053417+00:00', '2026-01-17T17:58:56.053417+00:00', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019c24ff-49e2-7dee-b670-1478eab95447', true, '2026-02-03T19:33:56.323557+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bcd1c-333f-7a05-a8ba-10219e4394dc', '2026-01-17T17:58:56.053417+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019c16d8-a12b-7bdf-84dc-6255f22e87a5', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-01-17T17:58:56.053417+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019c16d8-a12c-788f-8361-7201fed4f3e6', '2026-02-01T01:37:01.720364+00:00', false, false, false) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bb798-89d6-774a-a3b2-f6d57050833d', '2026-02-10T19:15:00.738862+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019b3be4-36cd-7888-842b-8c6f8dfb363b', '2026-01-17T17:58:56.053417+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bcd1c-333e-73c9-a949-c31c83edf84d', '2026-01-17T17:58:56.053417+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019c16d8-a12b-75f3-9acf-257d83b4a81c', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (false, '2026-02-01T01:37:01.720364+00:00', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019c16d8-a12c-70db-82d7-454f71f50c08', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2026-02-10T19:15:00.738862+00:00', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'ffffffff-1111-1111-1111-ffffffffffff', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bebc4-d436-7b60-9f57-f7c03f636fac', true, '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bebc4-d436-7ba3-9c29-c24f308f6e56', true, '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-02-10T19:15:00.738862+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bebc4-d436-7bf6-af0e-91e685a8f15e', true, '2026-02-10T19:15:00.738862+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019c06a8-2af5-766c-9713-315ab9567235', true, '2026-02-10T19:15:00.738862+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bebc4-d436-7cd5-9cfb-f52df7b3d47d', true, '2026-02-10T19:15:00.738862+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bebc4-d436-7c14-a42e-f45a12c4fdb0', true, '2026-02-10T19:15:00.738862+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019c06a8-2af6-727b-b94a-71bddc4d76de', true, '2026-02-10T19:15:00.738862+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bebc4-d436-7ce3-babd-f4ea7d97e54c', true, '2026-02-10T19:15:00.738862+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019c06a8-2af5-705d-ae92-7905a846a500', true, '2026-02-10T19:15:00.738862+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-02-10T19:15:00.738862+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bebc4-d436-7bde-91ab-92070869fe7f', true, '2026-02-10T19:15:00.738862+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019c06a8-2af4-7c97-ab30-1e863db0e8e3', true, '2026-02-10T19:15:00.738862+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bebc4-d436-7d07-9685-efb55bdcac10', true, '2026-02-10T19:15:00.738862+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bebc4-d436-7cfa-abc2-0b12c8166a91', true, '2026-02-10T19:15:00.738862+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
