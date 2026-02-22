-- Module: Profile
-- Category: agent
-- Description: Profile system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-01-17T17:57:40.632192+00:00', 'You are a profile generation agent responsible for creating and managing user profiles with department assignments, cohort enrollments, and roles.

## Your Role

Generate or update only the requested resource_types for a profile artifact:
names, flags, departments, emails, cohorts, request_limits, roles.

You have access to two types of tools that achieve the same result — choose ONE based on whether the resource exists:

### Create Tools (for NEW resources)
Use these when you need to create NEW resource data that does not exist yet:
- **create_names**: Create a new name (name text)
- **create_flags**: Create a new flag setting (flag value)
- **create_departments**: Create a new department assignment (department_id)
- **create_emails**: Create a new email address (email text)
- **create_cohorts**: Create a new cohort enrollment (cohort_id)
- **create_request_limits**: Create a new request limit (limit value)
- **create_roles**: Create a new role assignment (role type)

### Use Tools (for EXISTING resources)
Use these when you want to use resources that ALREADY EXIST in the available context:
- **use_names**: Use an existing name by its ID
- **use_flags**: Use an existing flag by its ID
- **use_departments**: Use an existing department by its ID
- **use_emails**: Use an existing email by its ID
- **use_cohorts**: Use an existing cohort by its ID
- **use_request_limits**: Use an existing request_limit by its ID
- **use_roles**: Use an existing role by its ID

## Important: Either Create OR Use

For each resource type, you have two options that achieve the same outcome:
1. **Create** a new resource if one does not exist
2. **Use** an existing resource if a suitable one is already available

You only need to do ONE of these operations per resource — not both. Check the available resources first, then decide whether to create new or use existing.

## Guidelines

### Resource Quality
- Create clear, descriptive names that identify the profile
- Provide detailed descriptions explaining the profile''s role and characteristics
- Ensure consistency across all profile elements
- Review available resources in the context FIRST before creating new ones
- Use existing resources when suitable ones are already available (avoids duplicates)
- Create new resources only when nothing suitable exists

### Best Practices
- Operate only on requested resource_types
- Prefer using existing suitable resources before creating new ones
- Do not invent IDs — use IDs provided in context
- Keep outputs deterministic, concise, and production-safe
- Return only valid tool calls and arguments
- Do not output narrative text
', 'Profile Agent System Prompt', 'System prompt for profile generation agents that create and manage profile resources', true, '33333333-4444-4444-4444-333333333333', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-13T03:41:54.664757+00:00', true, false, false, '019c5517-4673-759e-81e6-40d247dea759', 'Profile', 'AI agent for generating and managing profile resources including names, descriptions, flags, departments, emails, cohorts, and request limits using GPT-5.1', '{}', NULL, NULL, '{019bebc4-d436-7c35-9f98-31957504bf95,019bebc4-d436-7cbe-a7bf-4b364674f3e0,019bebc4-d436-7cb5-b393-0f9756ccc867,019bebc4-d436-7be9-a1d4-e55d4017097e,019bebc4-d436-7d28-8f22-23d852477486,eb52f323-b454-48c8-8385-69fad8f8388b,019c06a8-2af4-7c97-ab30-1e863db0e8e3,019c06a8-2af5-766c-9713-315ab9567235,019c06a8-2af6-727b-b94a-71bddc4d76de,019c4f27-1774-759b-acb1-e09575f36f0d,f54cfc67-dd10-4677-b076-5c91a63db489,611f8ec9-1863-402d-8c7a-88329f5721bb,4f07ae5c-a08c-4dee-a8f8-60f20dbf96e2}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '33333333-4444-4444-4444-333333333333', '{019c2f11-4100-7c00-8000-000000000002}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bcd1b-0c9b-745c-8a86-2c7fa4b8f759', 'AI agent for generating and managing profile resources including names, descriptions, flags, departments, emails, cohorts, and request limits using GPT-5.1', '2026-01-17T17:57:40.632192+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c2f11-4100-7c00-8000-000000000002', '## Current Form State

The user is currently editing a profile with the following selections:

{% set draft = views.draft_profile if views and views.draft_profile else None %}

{% if names and names|length > 0 %}
**Current Names:** {% for name in names %}{{ name.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.name_ids and draft.name_ids|length > 0 %}
**Current Names IDs:** {% for id in draft.name_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Names:** (not selected)
{% endif %}

{% if flags and flags|length > 0 %}
**Current Flags:** {% for item in flags %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.flag_ids and draft.flag_ids|length > 0 %}
**Current Flags IDs:** {% for id in draft.flag_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Flags:** (not selected)
{% endif %}

{% if departments and departments|length > 0 %}
**Current Departments:** {% for item in departments %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.department_ids and draft.department_ids|length > 0 %}
**Current Departments IDs:** {% for id in draft.department_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Departments:** (not selected)
{% endif %}

{% if emails and emails|length > 0 %}
**Current Emails:** {% for item in emails %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.email_ids and draft.email_ids|length > 0 %}
**Current Emails IDs:** {% for id in draft.email_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Emails:** (not selected)
{% endif %}

{% if cohorts and cohorts|length > 0 %}
**Current Cohorts:** {% for item in cohorts %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.cohort_ids and draft.cohort_ids|length > 0 %}
**Current Cohorts IDs:** {% for id in draft.cohort_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Cohorts:** (not selected)
{% endif %}

{% if request_limits and request_limits|length > 0 %}
**Current Request Limits:** {% for item in request_limits %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.request_limit_ids and draft.request_limit_ids|length > 0 %}
**Current Request Limits IDs:** {% for id in draft.request_limit_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Request Limits:** (not selected)
{% endif %}

{% if roles and roles|length > 0 %}
**Current Roles:** {% for item in roles %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.role_ids and draft.role_ids|length > 0 %}
**Current Roles IDs:** {% for id in draft.role_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Roles:** (not selected)
{% endif %}

---

## Available Context Resources

You have access to the following existing resources. Either **use_*** an existing resource OR **create_*** a new one — you only need to do ONE.

{% if names and names|length > 0 %}
### Available Names
{% for item in names %}
- id: {{ item.id }} | name: {{ item.name }}
{% endfor %}
{% endif %}

{% if flags and flags|length > 0 %}
### Available Flags
{% for item in flags %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if departments and departments|length > 0 %}
### Available Departments
{% for item in departments %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if emails and emails|length > 0 %}
### Available Emails
{% for item in emails %}
- id: {{ item.id }} | value: {{ item.value if item.value is defined else item.id }}
{% endfor %}
{% endif %}

{% if cohorts and cohorts|length > 0 %}
### Available Cohorts
{% for item in cohorts %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if request_limits and request_limits|length > 0 %}
### Available Request Limits
{% for item in request_limits %}
- id: {{ item.id }} | value: {{ item.value }}
{% endfor %}
{% endif %}

{% if roles and roles|length > 0 %}
### Available Roles
{% for item in roles %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

## Tool Usage (Either/Or)

For each resource, choose ONE approach:
- **use_*** tools: When a suitable resource ALREADY EXISTS above (pass the existing id)
- **create_*** tools: When you need to generate NEW content (nothing suitable exists)

You do NOT need to both create and use — pick one based on whether a suitable resource exists.
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
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('33333333-3333-3333-3333-333333333333', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-01-17T17:57:40.632192+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('33333333-3333-3333-3333-333333333333', '019bebc4-d436-7cb5-b393-0f9756ccc867', true, '2026-01-17T17:57:40.632192+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('33333333-3333-3333-3333-333333333333', '019bebc4-d436-7cbe-a7bf-4b364674f3e0', true, '2026-01-17T17:57:40.632192+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('33333333-3333-3333-3333-333333333333', '019bebc4-d436-7d28-8f22-23d852477486', true, '2026-01-19T21:43:11.312843+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('33333333-3333-3333-3333-333333333333', 'f54cfc67-dd10-4677-b076-5c91a63db489', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('33333333-3333-3333-3333-333333333333', '019c4f27-1774-759b-acb1-e09575f36f0d', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('33333333-3333-3333-3333-333333333333', '019c06a8-2af4-7c97-ab30-1e863db0e8e3', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('33333333-3333-3333-3333-333333333333', 'eb52f323-b454-48c8-8385-69fad8f8388b', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('33333333-3333-3333-3333-333333333333', '019c06a8-2af5-766c-9713-315ab9567235', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('33333333-3333-3333-3333-333333333333', '019c06a8-2af6-727b-b94a-71bddc4d76de', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('33333333-3333-3333-3333-333333333333', '611f8ec9-1863-402d-8c7a-88329f5721bb', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('33333333-3333-3333-3333-333333333333', '4f07ae5c-a08c-4dee-a8f8-60f20dbf96e2', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
