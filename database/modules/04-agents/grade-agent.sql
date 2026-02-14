-- Module: Grade Agent
-- Category: agent
-- Description: Grade Agent system agent
-- ============================================================


-- Resource rows
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
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-03T19:33:56.323152+00:00', true, false, false, '019c24ff-49e3-7512-8173-2ea2ac8c3670', 'Grade Agent', 'Agent responsible for providing detailed feedback on student performance in educational simulations', '{}', NULL, NULL, '{019bebc4-d436-7bac-88c6-8d40538bcb49,019bebc4-d436-7bb7-964b-e3ad705be38d,019bebc4-d436-7bbb-bd65-5f158fd12e4d,019c16d8-a124-7d9a-8547-20d809a13daa,019c16d8-a125-7364-8818-8035df41de53,019bebc4-d436-7ba4-963e-758c7971447d}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '019c16d8-a12e-7c64-89a1-74ced40a25f5', '{019bcd1c-3357-7009-a18c-55604e211cac,019c16d8-a12e-7da6-ba14-f0c2cd75a4eb}') ON CONFLICT (id) DO NOTHING;
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
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c16d8-a12e-790e-8950-8d128dcbf18e', 'Grade Agent', '2026-02-01T01:37:01.720364+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-11T20:52:42.499349+00:00', '2026-02-11T20:52:42.499349+00:00', 'ff000001-ffff-ffff-ffff-ffffffffffff', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('ff000001-ffff-ffff-ffff-ffffffffffff', '019c24ff-49e3-7512-8173-2ea2ac8c3670', true, '2026-02-13T03:41:54.664757+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('ff000001-ffff-ffff-ffff-ffffffffffff', '019c16d8-a12e-7b2e-aba7-ad3099029196', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('ff000001-ffff-ffff-ffff-ffffffffffff', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('ff000001-ffff-ffff-ffff-ffffffffffff', '019bcd1c-3357-7009-a18c-55604e211cac', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('ff000001-ffff-ffff-ffff-ffffffffffff', '019c16d8-a12e-7da6-ba14-f0c2cd75a4eb', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('ff000001-ffff-ffff-ffff-ffffffffffff', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('ff000001-ffff-ffff-ffff-ffffffffffff', '019c16d8-a12e-790e-8950-8d128dcbf18e', '2026-02-11T20:52:42.499349+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2026-02-11T20:52:42.499349+00:00', 'ff000001-ffff-ffff-ffff-ffffffffffff', '019c16d8-a12e-7c64-89a1-74ced40a25f5', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ff000001-ffff-ffff-ffff-ffffffffffff', '019bebc4-d436-7ba4-963e-758c7971447d', true, '2026-02-11T20:52:42.499349+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ff000001-ffff-ffff-ffff-ffffffffffff', '019bebc4-d436-7bac-88c6-8d40538bcb49', true, '2026-02-11T20:52:42.499349+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ff000001-ffff-ffff-ffff-ffffffffffff', '019bebc4-d436-7bb7-964b-e3ad705be38d', true, '2026-02-11T20:52:42.499349+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ff000001-ffff-ffff-ffff-ffffffffffff', '019bebc4-d436-7bbb-bd65-5f158fd12e4d', true, '2026-02-11T20:52:42.499349+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ff000001-ffff-ffff-ffff-ffffffffffff', '019c16d8-a124-7d9a-8547-20d809a13daa', true, '2026-02-11T20:52:42.499349+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ff000001-ffff-ffff-ffff-ffffffffffff', '019c16d8-a125-7364-8818-8035df41de53', true, '2026-02-11T20:52:42.499349+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
