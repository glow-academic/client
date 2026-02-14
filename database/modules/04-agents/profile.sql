-- Module: Profile
-- Category: agent
-- Description: Profile system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-01-17T17:57:40.632192+00:00', 'You are a profile generation agent responsible for creating and managing profile resources for AI-powered training systems.

## Operating Rules
- Use only tools provided in this run.
- Keep outputs consistent with the current draft and selected resources.
- Avoid duplicate creation when a suitable resource already exists.

## Resource Scope
- names
- flags
- request_limits
- departments
- emails
- cohorts

## Quality Bar
- Names should be clear and role-appropriate.
- Department/cohort assignments should be coherent with intended profile scope.
- Email and request-limit configuration should be precise and operationally safe.
- Keep outputs concise, structured, and directly actionable.
', 'Profile Agent System Prompt', 'System prompt for profile generation agents that create and manage profile resources', true, '33333333-4444-4444-4444-333333333333', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-13T03:41:54.664757+00:00', true, false, false, '019c5517-4673-759e-81e6-40d247dea759', 'Profile', 'AI agent for generating and managing profile resources including names, descriptions, flags, departments, emails, cohorts, and request limits using GPT-5.1', '{}', NULL, NULL, '{019bebc4-d436-7be9-a1d4-e55d4017097e,019bebc4-d436-7bf6-af0e-91e685a8f15e,019bebc4-d436-7c14-a42e-f45a12c4fdb0,019bebc4-d436-7c35-9f98-31957504bf95,019bebc4-d436-7cb5-b393-0f9756ccc867,019bebc4-d436-7cbe-a7bf-4b364674f3e0,019bebc4-d436-7d28-8f22-23d852477486}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '33333333-4444-4444-4444-333333333333', '{019c2f11-4100-7c00-8000-000000000002}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bcd1b-0c9b-745c-8a86-2c7fa4b8f759', 'AI agent for generating and managing profile resources including names, descriptions, flags, departments, emails, cohorts, and request limits using GPT-5.1', '2026-01-17T17:57:40.632192+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c2f11-4100-7c00-8000-000000000002', '## Current Form State

The user is currently editing a profile with the following selections:

{% set draft = views.draft_profile if views and views.draft_profile else None %}

{% if names and names|length > 0 %}
**Current Name:** {% for name in names %}{{ name.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.name_ids and draft.name_ids|length > 0 %}
**Current Name IDs:** {% for id in draft.name_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Name:** (not selected)
{% endif %}

{% if flags and flags|length > 0 %}
**Current Flags:** {% for flag in flags %}{{ flag.label or flag.key or flag.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.flag_ids and draft.flag_ids|length > 0 %}
**Current Flag IDs:** {% for id in draft.flag_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Flags:** (none selected)
{% endif %}

{% if departments and departments|length > 0 %}
**Current Departments:** {% for dept in departments %}{{ dept.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.department_ids and draft.department_ids|length > 0 %}
**Current Department IDs:** {% for id in draft.department_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Departments:** (none selected)
{% endif %}

{% if emails and emails|length > 0 %}
**Current Emails:** {% for email in emails %}{{ email.email }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Emails:** (none selected)
{% endif %}

{% if cohorts and cohorts|length > 0 %}
**Current Cohorts:** {% for cohort in cohorts %}{{ cohort.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Cohorts:** (none selected)
{% endif %}

{% if request_limits and request_limits|length > 0 %}
**Current Request Limit:** {% for rl in request_limits %}{{ rl.name or rl.value or rl.id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Request Limit:** (not selected)
{% endif %}

---

## Available Context Resources

Use available resources to avoid unnecessary duplicates. Create only what is missing.

{% if names and names|length > 0 %}
### Available Names
{% for name in names %}
- id: {{ name.id }} | name: {{ name.name }}
{% endfor %}
{% endif %}

{% if flags and flags|length > 0 %}
### Available Flags
{% for flag in flags %}
- id: {{ flag.flag_option_id or flag.id }} | name: {{ flag.label or flag.key or flag.name }}
{% endfor %}
{% endif %}

{% if departments and departments|length > 0 %}
### Available Departments
{% for dept in departments %}
- id: {{ dept.department_id or dept.id }} | name: {{ dept.name }}
{% endfor %}
{% endif %}

{% if emails and emails|length > 0 %}
### Available Emails
{% for email in emails %}
- id: {{ email.id }} | email: {{ email.email }}
{% endfor %}
{% endif %}

{% if cohorts and cohorts|length > 0 %}
### Available Cohorts
{% for cohort in cohorts %}
- id: {{ cohort.cohort_id or cohort.id }} | name: {{ cohort.name }}
{% endfor %}
{% endif %}

{% if request_limits and request_limits|length > 0 %}
### Available Request Limits
{% for rl in request_limits %}
- id: {{ rl.id }} | name: {{ rl.name or rl.value or rl.id }}
{% endfor %}
{% endif %}
', true, '2026-02-10T19:11:19.088528+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bb553-e78d-7ce8-b02f-e1450a346d66', 'Profile', '2026-01-13T03:08:53.512903+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-01-17T17:57:40.632192+00:00', '2026-01-17T17:57:40.632192+00:00', '33333333-3333-3333-3333-333333333333', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('33333333-3333-3333-3333-333333333333', '019c5517-4673-759e-81e6-40d247dea759', true, '2026-02-13T03:41:54.664757+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('33333333-3333-3333-3333-333333333333', '019bcd1b-0c9b-745c-8a86-2c7fa4b8f759', '2026-01-17T17:57:40.632192+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('33333333-3333-3333-3333-333333333333', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-01-17T17:57:40.632192+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('33333333-3333-3333-3333-333333333333', '019c2f11-4100-7c00-8000-000000000002', '2026-02-10T19:11:19.088528+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('33333333-3333-3333-3333-333333333333', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '2026-01-17T17:57:40.632192+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('33333333-3333-3333-3333-333333333333', '019bb553-e78d-7ce8-b02f-e1450a346d66', '2026-01-17T17:57:40.632192+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2026-01-17T17:57:40.632192+00:00', '33333333-3333-3333-3333-333333333333', '33333333-4444-4444-4444-333333333333', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('33333333-3333-3333-3333-333333333333', '019bebc4-d436-7be9-a1d4-e55d4017097e', true, '2026-01-17T17:57:40.632192+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('33333333-3333-3333-3333-333333333333', '019bebc4-d436-7bf6-af0e-91e685a8f15e', true, '2026-01-17T17:57:40.632192+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('33333333-3333-3333-3333-333333333333', '019bebc4-d436-7c14-a42e-f45a12c4fdb0', true, '2026-01-17T17:57:40.632192+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('33333333-3333-3333-3333-333333333333', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-01-17T17:57:40.632192+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('33333333-3333-3333-3333-333333333333', '019bebc4-d436-7cb5-b393-0f9756ccc867', true, '2026-01-17T17:57:40.632192+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('33333333-3333-3333-3333-333333333333', '019bebc4-d436-7cbe-a7bf-4b364674f3e0', true, '2026-01-17T17:57:40.632192+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('33333333-3333-3333-3333-333333333333', '019bebc4-d436-7d28-8f22-23d852477486', true, '2026-01-19T21:43:11.312843+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
