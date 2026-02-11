-- Module: Field
-- Category: agent
-- Description: Field system agent
-- ============================================================


-- Resource rows
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-03T19:33:56.323152+00:00', true, false, false, '019c24ff-49e3-7512-8173-2ea2ac8c3670', 'Grade Agent', 'Agent responsible for providing detailed feedback on student performance in educational simulations', '{}', NULL, NULL, '{019bebc4-d436-7bac-88c6-8d40538bcb49,019bebc4-d436-7bb7-964b-e3ad705be38d,019bebc4-d436-7bbb-bd65-5f158fd12e4d,019c16d8-a124-7d9a-8547-20d809a13daa,019c16d8-a125-7364-8818-8035df41de53,019bebc4-d436-7ba4-963e-758c7971447d}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '019c16d8-a12e-7c64-89a1-74ced40a25f5', '{019bcd1c-3357-7009-a18c-55604e211cac,019c16d8-a12e-7da6-ba14-f0c2cd75a4eb}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bcd1c-3348-728b-aa5b-4687e69e40e9', 'AI agent for generating and managing field resources including names, descriptions, flags, departments, and conditional parameters using GPT-5.1', '2026-01-17T17:58:56.069266+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c16d8-a12e-7b2e-aba7-ad3099029196', 'Agent responsible for providing detailed feedback on student performance in educational simulations', '2026-02-01T01:37:01.720364+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019bcd1c-3357-7009-a18c-55604e211cac', '## Current Form State

The user is currently editing a field with the following selections:

{% set draft = views.draft_field if views and views.draft_field else None %}

{% if names and names|length > 0 %}
**Current Name:** {% for name in names %}{{ name.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.name_ids and draft.name_ids|length > 0 %}
**Current Name IDs:** {% for id in draft.name_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Name:** (not selected)
{% endif %}

{% if descriptions and descriptions|length > 0 %}
**Current Description:** {% for desc in descriptions %}{{ desc.description[:100] }}{% if desc.description|length > 100 %}...{% endif %}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.description_ids and draft.description_ids|length > 0 %}
**Current Description IDs:** {% for id in draft.description_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Description:** (not selected)
{% endif %}

{% if departments and departments|length > 0 %}
**Current Departments:** {% for dept in departments %}{{ dept.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.department_ids and draft.department_ids|length > 0 %}
**Current Department IDs:** {% for id in draft.department_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Departments:** (none selected)
{% endif %}

{% if flags and flags|length > 0 %}
**Current Flags:** {% for flag in flags %}{{ flag.label or flag.key or flag.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.flag_ids and draft.flag_ids|length > 0 %}
**Current Flag IDs:** {% for id in draft.flag_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Flags:** (none selected)
{% endif %}

{% if conditional_parameters and conditional_parameters|length > 0 %}
**Current Conditional Parameters:** {% for p in conditional_parameters %}{{ p.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.parameter_ids and draft.parameter_ids|length > 0 %}
**Current Conditional Parameter IDs:** {% for id in draft.parameter_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Conditional Parameters:** (none selected)
{% endif %}

---

## Available Context Resources

Choose one action per resource type:
- `use_*` when suitable resources already exist.
- `create_*` only when no suitable resources exist.

{% if names and names|length > 0 %}
### Available Names
{% for name in names %}
- id: {{ name.id }} | name: {{ name.name }}
{% endfor %}
{% endif %}

{% if descriptions and descriptions|length > 0 %}
### Available Descriptions
{% for desc in descriptions %}
- id: {{ desc.id }} | description: {{ desc.description[:100] }}{% if desc.description|length > 100 %}...{% endif %}
{% endfor %}
{% endif %}

{% if departments and departments|length > 0 %}
### Available Departments
{% for dept in departments %}
- id: {{ dept.department_id or dept.id }} | name: {{ dept.name }}
{% endfor %}
{% endif %}

{% if flags and flags|length > 0 %}
### Available Flags
{% for flag in flags %}
- id: {{ flag.flag_option_id or flag.id }} | name: {{ flag.label or flag.key or flag.name }}
{% endfor %}
{% endif %}

{% if conditional_parameters and conditional_parameters|length > 0 %}
### Available Conditional Parameters
{% for p in conditional_parameters %}
- id: {{ p.parameter_id or p.id }} | name: {{ p.name }}
{% endfor %}
{% endif %}
', true, '2026-01-17T17:58:56.086727+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c16d8-a12e-7da6-ba14-f0c2cd75a4eb', '## Simulation Context

{% if scenario %}
### Scenario
- Problem: {{ scenario.problem_statement }}
{% if scenario.objectives %}
- Objectives: {% for obj in scenario.objectives %}{{ obj.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% endif %}
{% endif %}

{% if rubric and rubric.criteria %}
### Rubric Criteria
{% for criterion in rubric.criteria %}
- **{{ criterion.name }}** ({{ criterion.points }} pts): {{ criterion.description }}
{% endfor %}
{% endif %}

---

## Conversation to Grade

{% if chat %}
Chat ID: {{ chat.id }} | Title: {{ chat.title }}
{% endif %}

{% if messages and messages|length > 0 %}
{% for msg in messages %}
[{{ msg.id }}] **{{ msg.role }}**: {{ msg.content }}
{% endfor %}
{% endif %}

---

## Current Grade
{% if grade %}
- id: {{ grade.id }}
- score: {{ grade.score }}
- passed: {{ grade.passed }}
- description: {{ grade.description }}
{% endif %}

## Already Created

{% if feedbacks and feedbacks|length > 0 %}
### Feedback
{% for fb in feedbacks %}
- {{ fb.feedback }} (total: {{ fb.total }})
{% endfor %}
{% endif %}

{% if strengths and strengths|length > 0 %}
### Strengths
{% for s in strengths %}
- **{{ s.name }}**: {{ s.description }}
{% endfor %}
{% endif %}

{% if improvements and improvements|length > 0 %}
### Improvements
{% for i in improvements %}
- **{{ i.name }}**: {{ i.description }}
{% endfor %}
{% endif %}', true, '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bcd1c-3348-701e-b254-b80e6423ffab', 'Field', '2026-01-17T17:58:56.069266+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c16d8-a12e-790e-8950-8d128dcbf18e', 'Grade Agent', '2026-02-01T01:37:01.720364+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-02-01T01:37:01.720364+00:00', 'You are a grading agent responsible for providing detailed feedback on student performance in educational simulations.

## Your Tools
- **create_feedback**: Provide overall feedback summary for a grade
- **create_analysis**: Write detailed analysis of performance
- **create_strength**: Highlight specific things the student did well
- **create_improvement**: Suggest specific areas for improvement
- **create_highlight**: Mark notable text sections in messages (linked to strengths)
- **create_replacement**: Suggest text replacements for improvements

## Guidelines
- Provide constructive, actionable feedback
- Be specific - reference actual messages and content
- Balance strengths with improvements
- Highlights and replacements should reference specific text', 'Grade Agent System Prompt', 'System prompt for grading feedback agents', true, '019c16d8-a12e-7c64-89a1-74ced40a25f5', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7ba4-963e-758c7971447d', '2026-01-17T17:58:56.053417+00:00', false, false, true, 'create_feedback', 'Create a grade for the conversation on a specific standard group. Score should be an integer from 1-5 based on the rubric criteria. Provide brief feedback explaining the score with specific examples.', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7bac-88c6-8d40538bcb49', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_strength', 'Create strength feedback for a specific message. Highlight what was strong about this message in the conversation. You can optionally highlight specific sections.', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7bb7-964b-e3ad705be38d', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_improvement', 'Create improvement feedback for a specific message. Suggest improvements for this message in the conversation. You can optionally provide strikethrough/replace suggestions.', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7bbb-bd65-5f158fd12e4d', '2026-01-17T17:58:56.053417+00:00', false, false, true, 'create_analysis', 'Create an analysis of audio messages from the conversation. Specify which messages (by their numbers in the conversation history) you want to analyze and what aspects you want to evaluate.', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c16d8-a124-7d9a-8547-20d809a13daa', '2026-02-01T01:37:01.720364+00:00', false, false, true, 'create_highlight', 'Create a highlight for a strength in the simulation', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c16d8-a125-7364-8818-8035df41de53', '2026-02-01T01:37:01.720364+00:00', false, false, true, 'create_replacement', 'Create a replacement suggestion for an improvement in the simulation', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af4-7c97-ab30-1e863db0e8e3', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_departments', 'Use an existing department resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af5-705d-ae92-7905a846a500', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_descriptions', 'Use an existing description resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af5-766c-9713-315ab9567235', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_flags', 'Use an existing flag resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af6-727b-b94a-71bddc4d76de', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_names', 'Use an existing name resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af6-7439-b8fb-2a083dd49848', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_parameters', 'Use an existing parameter resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7bf6-af0e-91e685a8f15e', '2026-01-17T17:58:56.069266+00:00', false, false, true, 'create_departments', 'Create a new departments resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c01-b86b-9483883762a6', '2026-01-17T17:58:56.073128+00:00', false, false, true, 'create_descriptions', 'Create a new descriptions resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c14-a42e-f45a12c4fdb0', '2026-01-17T17:58:56.073128+00:00', false, false, true, 'create_flags', 'Create a new flags resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c35-9f98-31957504bf95', '2026-01-17T17:58:56.073128+00:00', false, false, true, 'create_names', 'Create a new names resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c3e-b71d-a48e787dafc1', '2026-01-17T17:58:56.069266+00:00', false, false, true, 'create_parameters', 'Create a new parameters resource', '{}', false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-01-17T17:58:56.069266+00:00', '2026-01-17T17:58:56.069266+00:00', 'ffffffff-ffff-ffff-ffff-ffffffffffff', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019c24ff-49e3-7512-8173-2ea2ac8c3670', true, '2026-02-03T19:33:56.324006+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019bcd1c-3348-728b-aa5b-4687e69e40e9', '2026-01-17T17:58:56.069266+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019c16d8-a12e-7b2e-aba7-ad3099029196', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-01-17T17:58:56.069266+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019bcd1c-3357-7009-a18c-55604e211cac', '2026-01-17T17:58:56.086727+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019c16d8-a12e-7da6-ba14-f0c2cd75a4eb', '2026-02-01T01:37:01.720364+00:00', false, false, false) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019b3be4-36cd-7888-842b-8c6f8dfb363b', '2026-01-17T17:58:56.069266+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019bcd1c-3348-701e-b254-b80e6423ffab', '2026-01-17T17:58:56.069266+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019c16d8-a12e-790e-8950-8d128dcbf18e', '2026-02-01T01:37:01.720364+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2026-02-01T01:37:01.720364+00:00', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '019c16d8-a12e-7c64-89a1-74ced40a25f5', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019bebc4-d436-7ba4-963e-758c7971447d', false, '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019bebc4-d436-7bac-88c6-8d40538bcb49', false, '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019bebc4-d436-7bb7-964b-e3ad705be38d', false, '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019bebc4-d436-7bbb-bd65-5f158fd12e4d', false, '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019c16d8-a124-7d9a-8547-20d809a13daa', false, '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019c16d8-a125-7364-8818-8035df41de53', false, '2026-02-01T01:37:01.720364+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019c06a8-2af4-7c97-ab30-1e863db0e8e3', true, '2026-02-10T19:12:00.055832+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019c06a8-2af5-705d-ae92-7905a846a500', true, '2026-02-10T19:12:00.055832+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019c06a8-2af5-766c-9713-315ab9567235', true, '2026-02-10T19:12:00.055832+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019c06a8-2af6-727b-b94a-71bddc4d76de', true, '2026-02-10T19:12:00.055832+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019c06a8-2af6-7439-b8fb-2a083dd49848', true, '2026-02-10T19:12:00.055832+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019bebc4-d436-7bf6-af0e-91e685a8f15e', true, '2026-02-10T19:12:00.055832+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-02-10T19:12:00.055832+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019bebc4-d436-7c14-a42e-f45a12c4fdb0', true, '2026-02-10T19:12:00.055832+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-02-10T19:12:00.055832+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019bebc4-d436-7c3e-b71d-a48e787dafc1', true, '2026-02-10T19:12:00.055832+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
