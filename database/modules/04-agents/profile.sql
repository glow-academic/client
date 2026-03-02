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
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-13T03:41:54.664757+00:00', true, false, false, '019c5517-4673-759e-81e6-40d247dea759', 'Profile', 'AI agent for generating and managing profile resources including names, descriptions, flags, departments, emails, cohorts, and request limits using GPT-5.1', '{}', NULL, NULL, '{019bebc4-d436-7be9-a1d4-e55d4017097e,019bebc4-d436-7c35-9f98-31957504bf95,019bebc4-d436-7cb5-b393-0f9756ccc867,019bebc4-d436-7cbe-a7bf-4b364674f3e0,019bebc4-d436-7d28-8f22-23d852477486,019c06a8-2af4-7c97-ab30-1e863db0e8e3,f54cfc67-dd10-4677-b076-5c91a63db489,4f07ae5c-a08c-4dee-a8f8-60f20dbf96e2,611f8ec9-1863-402d-8c7a-88329f5721bb,019c4f27-1774-759b-acb1-e09575f36f0d,019c06a8-2af6-727b-b94a-71bddc4d76de,eb52f323-b454-48c8-8385-69fad8f8388b,019c06a8-2af5-766c-9713-315ab9567235}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '33333333-4444-4444-4444-333333333333', '{019c2f11-4100-7c00-8000-000000000002}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bcd1b-0c9b-745c-8a86-2c7fa4b8f759', 'AI agent for generating and managing profile resources including names, descriptions, flags, departments, emails, cohorts, and request limits using GPT-5.1', '2026-01-17T17:57:40.632192+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c2f11-4100-7c00-8000-000000000002', '## Current State
{% set draft = artifacts.profile.get.entries.draft_profile if artifacts.profile.get.entries and artifacts.profile.get.entries.draft_profile else None %}
{% if draft and draft.name_ids and draft.name_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.profile.get.resources.names if item.id|string in draft.name_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Names: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Names: ({{ draft.name_ids|length }} selected by ID){% endif %}{% else %}Names: (not set){% endif %}
{% if draft and draft.flag_ids and draft.flag_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.profile.get.resources.flags if item.flag_option_id|string in draft.flag_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Flags: {% for item in selected %}{{ item.label or item.key }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Flags: ({{ draft.flag_ids|length }} selected by ID){% endif %}{% else %}Flags: (not set){% endif %}
{% if draft and draft.department_ids and draft.department_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.profile.get.resources.departments if item.department_id|string in draft.department_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Departments: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Departments: ({{ draft.department_ids|length }} selected by ID){% endif %}{% else %}Departments: (not set){% endif %}
{% if draft and draft.email_ids and draft.email_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.profile.get.resources.emails if item.id|string in draft.email_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Emails: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Emails: ({{ draft.email_ids|length }} selected by ID){% endif %}{% else %}Emails: (not set){% endif %}
{% if draft and draft.cohort_ids and draft.cohort_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.profile.get.resources.cohorts if item.id|string in draft.cohort_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Cohorts: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Cohorts: ({{ draft.cohort_ids|length }} selected by ID){% endif %}{% else %}Cohorts: (not set){% endif %}
{% if draft and draft.request_limit_ids and draft.request_limit_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.profile.get.resources.request_limits if item.id|string in draft.request_limit_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Request Limits: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Request Limits: ({{ draft.request_limit_ids|length }} selected by ID){% endif %}{% else %}Request Limits: (not set){% endif %}
{% if draft and draft.role_ids and draft.role_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.profile.get.resources.roles if item.id|string in draft.role_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Roles: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Roles: ({{ draft.role_ids|length }} selected by ID){% endif %}{% else %}Roles: (not set){% endif %}

---

{% set all_gen_types = (artifacts.profile.get.resources.types or []) + (artifacts.profile.get.entries.types or []) %}
## Available Resources
{% if "names" in all_gen_types and artifacts.profile.get.resources.names and artifacts.profile.get.resources.names|length > 0 %}
Names:
{% for item in artifacts.profile.get.resources.names %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "flags" in all_gen_types and artifacts.profile.get.resources.flags and artifacts.profile.get.resources.flags|length > 0 %}
Flags:
{% for item in artifacts.profile.get.resources.flags %}
- id: {{ item.flag_option_id }} | {{ item.label or item.key }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}
{% if "departments" in all_gen_types and artifacts.profile.get.resources.departments and artifacts.profile.get.resources.departments|length > 0 %}
Departments:
{% for item in artifacts.profile.get.resources.departments %}
- id: {{ item.department_id }} | {{ item.name }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}
{% if "emails" in all_gen_types and artifacts.profile.get.resources.emails and artifacts.profile.get.resources.emails|length > 0 %}
Emails:
{% for item in artifacts.profile.get.resources.emails %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "cohorts" in all_gen_types and artifacts.profile.get.resources.cohorts and artifacts.profile.get.resources.cohorts|length > 0 %}
Cohorts:
{% for item in artifacts.profile.get.resources.cohorts %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "request_limits" in all_gen_types and artifacts.profile.get.resources.request_limits and artifacts.profile.get.resources.request_limits|length > 0 %}
Request Limits:
{% for item in artifacts.profile.get.resources.request_limits %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "roles" in all_gen_types and artifacts.profile.get.resources.roles and artifacts.profile.get.resources.roles|length > 0 %}
Roles:
{% for item in artifacts.profile.get.resources.roles %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}

---

## Generating For
{% if artifacts.profile.get.resources.types and artifacts.profile.get.resources.types|length > 0 %}
Resource types (create or use): {{ artifacts.profile.get.resources.types|join(", ") }}
{% endif %}
{% if artifacts.profile.get.entries.types and artifacts.profile.get.entries.types|length > 0 %}
Entry types (use only): {{ artifacts.profile.get.entries.types|join(", ") }}
{% endif %}

Rules:
- For resource types: use_* when a suitable resource exists, create_* when nothing suitable exists
- For entry types: always use_* with IDs from available resources
- Only operate on the resource/entry types listed above
- Do not invent IDs — use IDs from available resources
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
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('33333333-3333-3333-3333-333333333333', '019bb553-e78d-7ce8-b02f-e1450a346d66', '2026-01-17T17:57:40.632192+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
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
