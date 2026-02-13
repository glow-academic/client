-- Module: Grade Agent
-- Category: agent
-- Description: Grade Agent system agent
-- ============================================================


-- Resource rows
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
INSERT INTO public.models_resource (created_at, value, active, generated, mcp, id, name, description, department_ids, provider_id, temperature_level_ids, reasoning_level_ids, quality_ids, voice_ids, modality_ids) VALUES ('2025-08-16T04:14:20.510000+00:00', 'gpt-4.1', true, false, false, '019bb25e-e5ff-76f6-90d4-830670bb5d82', 'gpt-4.1', 'GPT-4.1 excels at instruction following and tool calling, with broad knowledge across domains. It features a 1M token context window, and low latency without a reasoning step.', '{}', '019bb2af-b2a7-7d85-a61a-0dc4fd93b3c6', '{019c441a-0e9e-7bef-841d-5d33999c9d12,019c441a-0e9f-742a-995a-2c0c8e1cffba,019c441a-0e9f-741c-889d-c67c16f9dc2b,019c441a-0e9f-7413-be9e-8c771dd1ceb2,019c441a-0e9f-73f9-b1ae-e42dda0fd3c5,019c441a-0e9f-73e9-9074-5fc628f2e51c,019c441a-0e9f-73d9-a939-23bb7a0cc094,019c441a-0e9f-73ca-8872-97569ea04c56,019c441a-0e9f-73b7-a591-e6cb67cc219a,019c441a-0e9f-73b3-b4c6-96f71113e8dc,019c441a-0e9f-73a7-8628-636b0586d4fb,019c441a-0e9f-738a-9c75-c3dc21a1aed4,019c441a-0e9f-7370-856d-7b31ced06c90,019c441a-0e9f-735a-81cf-eed6e8196398,019c441a-0e9f-7335-a559-31fe7e8db595,019c441a-0e9f-732f-ac4d-b10174e69e21,019c441a-0e9f-718b-9bf3-c0143fa5d3c1,019c441a-0e9f-7176-a9ff-74d14b50e469,019c441a-0e9f-716f-9341-e1c1d078369b,019c441a-0e9f-7166-a4b2-8eef873a73e7,019c441a-0e9f-715a-8037-ac5450f006cb,019c441a-0e9f-713c-87f4-1ce375f0e09f,019c441a-0e9f-712f-ad29-33e6889ca042,019c441a-0e9f-7120-bc1c-1e290802109a,019c441a-0e9f-7116-ab87-05d7035642c7,019c441a-0e9f-710b-99b2-3db575f01df1,019c441a-0e9f-7101-afd8-b2e50bc968f9,019c441a-0e9f-70f0-a568-30584bfef8fb,019c441a-0e9f-70e8-8235-7196b41406e1,019c441a-0e9f-70d9-8046-2d636f526116,019c441a-0e9f-70ce-849a-af4b11bbfaf6,019c441a-0e9f-70be-928f-7873d52a9642,019c441a-0e9f-70b3-bad8-286a24dc5f49,019c441a-0e9f-70a7-8312-c8913b2bd033,019c441a-0e9f-708c-ace6-6ab6bfb9032b,019c441a-0e9f-7087-a7c2-481e3cf67900,019c441a-0e9f-7076-b0f4-d3db8a59a2bf,019c441a-0e9f-7067-a9d9-66f6b22a620c,019c441a-0e9f-7055-8c67-a6f96ebb872b,019c441a-0e9f-7038-a8fe-a960af92c6cd,019c441a-0e9f-7027-b2b3-40f7679aa440,019c441a-0e9f-7016-9973-59eca073bebe,019c441a-0e9f-700c-a8c5-11434dc2ea95,019c441a-0e9f-7004-9320-7d40cf5cd428,019c441a-0e9e-7ff9-8627-a980b71f8514,019c441a-0e9e-7fee-be99-7292d6d5e130,019c441a-0e9e-7fde-a372-d6c53b939a2d,019c441a-0e9e-7fcd-afc7-37cf75ba25a7,019c441a-0e9e-7fc1-8cef-8914d6b01390,019c441a-0e9e-7fbb-84b9-a7962089afa4,019c441a-0e9e-7fae-bed9-1177ce0bd598,019c441a-0e9e-7fa5-87e8-3e52d48647cd,019c441a-0e9e-7f8f-b0cf-ab7d52866f69,019c441a-0e9e-7f80-a9cb-7b1c947ad4c8,019c441a-0e9e-7f6c-a798-8328630ab038,019c441a-0e9e-7f5f-9e3d-9922fdb0fdff,019c441a-0e9e-7f53-8a08-d51406e55622,019c441a-0e9e-7f44-bb0b-5190a35cc0c0,019c441a-0e9e-7f2e-81d2-2545ba70f21d,019c441a-0e9e-7f26-8ca6-a1b33fb97fbe,019c441a-0e9e-7f0d-9e4b-4b564ec66598,019c441a-0e9e-7ef6-8811-b13973658720,019c441a-0e9e-7ede-ab08-a9ec02a3d29f,019c441a-0e9e-7ed1-9766-04be0f1c6b20,019c441a-0e9e-7ec9-8819-23cf95608dbe,019c441a-0e9e-7ebf-83f0-e822b230d010,019c441a-0e9e-7eb0-ba12-fa36a878cdef,019c441a-0e9e-7ea0-afe1-143d03e99a25,019c441a-0e9e-7e94-9c38-b7f44e86a101,019c441a-0e9e-7e89-8b78-5a89a8ee38df,019c441a-0e9e-7e73-ab7c-6b05701f3683,019c441a-0e9e-7e69-a60a-627a1928dda8,019c441a-0e9e-7e62-b187-072e351576b7,019c441a-0e9e-7e5a-933e-d1c96ab450fe,019c441a-0e9e-7e52-b580-9218337e5382,019c441a-0e9e-7e3d-b9e4-8df4302ca526,019c441a-0e9e-7e37-a9f8-4388d8363acc,019c441a-0e9e-7e2b-91ce-0aadfc9baef7,019c441a-0e9e-7e19-89e1-76a54e0e513b,019c441a-0e9e-7e0e-93ba-b9080f53300b,019c441a-0e9e-7dfb-9078-f1a2807595ff,019c441a-0e9e-7dde-a7b4-fa61b030af17,019c441a-0e9e-7dd6-b25d-1fa87885be16,019c441a-0e9e-7dcd-be35-3ab6d31cfb17,019c441a-0e9e-7db9-b0f3-8d485af3cc59,019c441a-0e9e-7da6-ae62-6e2a16407f9d,019c441a-0e9e-7d9e-b960-c7edff5d9bce,019c441a-0e9e-7d84-b9a5-aa946d36a18d,019c441a-0e9e-7d59-bd04-7501bbcf1b85,019c441a-0e9e-7d34-beaf-cb977faaad88,019c441a-0e9e-7d2d-a122-d5e27a709e64,019c441a-0e9e-7d22-aa42-b094ce03c315,019c441a-0e9e-7d1a-9b3d-4b030af5a5f5,019c441a-0e9e-7cf7-b9c2-b296333b30ee,019c441a-0e9e-7ce6-a3df-5d1581d924f8,019c441a-0e9e-7cdc-b2f0-1daefbf9a0d2,019c441a-0e9e-7cd3-9f45-b7f2ddd50383,019c441a-0e9e-7cc4-83a2-f576e1eac21e,019c441a-0e9e-7ca4-ad96-a64b4ddb14b4,019c441a-0e9e-7c9e-8acc-69725eead5b3,019c441a-0e9e-7c74-928c-7c0739193aff}', '{}', '{}', '{}', '{019bbce5-e606-77f1-abf8-78df7462af03,019bbce5-e609-750d-90c6-cb39f1266e18,019bbce5-e609-7efe-8549-87dd267f086a,019bbce5-e606-77f1-abf8-78df7462af03,019bbce5-e609-7efe-8549-87dd267f086a}') ON CONFLICT (id) DO NOTHING;
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
