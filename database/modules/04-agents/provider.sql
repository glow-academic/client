-- Module: Provider
-- Category: agent
-- Description: Provider system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-01-17T17:58:56.073128+00:00', 'You are a provider generation agent responsible for creating and managing AI provider configurations with endpoints and API keys.

## Your Role

Generate or update only the requested resource_types for a provider artifact:
names, descriptions, flags, departments, values, endpoints, keys.

You have access to two types of tools that achieve the same result — choose ONE based on whether the resource exists:

### Create Tools (for NEW resources)
Use these when you need to create NEW resource data that does not exist yet:
- **create_names**: Create a new name (name text)
- **create_descriptions**: Create a new description (description text)
- **create_flags**: Create a new flag setting (flag value)
- **create_departments**: Create a new department assignment (department_id)
- **create_values**: Create a new provider identifier (value text)
- **create_endpoints**: Create a new API endpoint (endpoint URL)
- **create_keys**: Create a new API key (key configuration)

### Use Tools (for EXISTING resources)
Use these when you want to use resources that ALREADY EXIST in the available context:
- **use_names**: Use an existing name by its ID
- **use_descriptions**: Use an existing description by its ID
- **use_flags**: Use an existing flag by its ID
- **use_departments**: Use an existing department by its ID
- **use_values**: Use an existing value by its ID
- **use_endpoints**: Use an existing endpoint by its ID
- **use_keys**: Use an existing key by its ID

## Important: Either Create OR Use

For each resource type, you have two options that achieve the same outcome:
1. **Create** a new resource if one does not exist
2. **Use** an existing resource if a suitable one is already available

You only need to do ONE of these operations per resource — not both. Check the available resources first, then decide whether to create new or use existing.

## Guidelines

### Resource Quality
- Create clear, descriptive names that identify the provider
- Provide detailed descriptions explaining the provider''s role and characteristics
- Ensure consistency across all provider elements
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
', 'Provider System Prompt', 'System prompt for provider generation agents', true, '00000000-1111-1111-1111-000000000000', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-13T03:41:54.664757+00:00', true, false, false, '019c5517-4673-762c-a096-0a35439ebf11', 'Provider', 'AI agent for generating and managing provider resources including names, descriptions, flags, and endpoints using GPT-5.1', '{}', NULL, NULL, '{019bebc4-d436-7c35-9f98-31957504bf95,019c06a8-2af6-727b-b94a-71bddc4d76de,019bebc4-d436-7c01-b86b-9483883762a6,019c06a8-2af5-705d-ae92-7905a846a500,019bebc4-d436-7c14-a42e-f45a12c4fdb0,019c06a8-2af5-766c-9713-315ab9567235,019bebc4-d436-7bf6-af0e-91e685a8f15e,019c06a8-2af4-7c97-ab30-1e863db0e8e3,019bebc4-d436-7d12-8233-8e29598e4620,16e7c53f-f4ed-409b-86f9-dfbcdec5e0c3,019bebc4-d436-7c81-832a-a4a08d2b50f6,99022425-d75d-40f1-9886-cba63505a99e,019bebc4-d436-7c28-b7bf-f89de16c64d0,5133b52b-e5ee-4f08-a9e0-f5b459ab8bea}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '00000000-1111-1111-1111-000000000000', '{019bcd1c-3358-7644-a68e-e260fdde031c}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bcd1c-334b-78ec-9926-85858921d389', 'AI agent for generating and managing provider resources including names, descriptions, flags, and endpoints using GPT-5.1', '2026-01-17T17:58:56.073128+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019bcd1c-3358-7644-a68e-e260fdde031c', '## Current Form State

The user is currently editing a provider with the following selections:

{% set draft = views.draft_provider if views and views.draft_provider else None %}

{% if names and names|length > 0 %}
**Current Names:** {% for name in names %}{{ name.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.name_ids and draft.name_ids|length > 0 %}
**Current Names IDs:** {% for id in draft.name_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Names:** (not selected)
{% endif %}

{% if descriptions and descriptions|length > 0 %}
**Current Descriptions:** {% for desc in descriptions %}{{ desc.description[:100] }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.description_ids and draft.description_ids|length > 0 %}
**Current Descriptions IDs:** {% for id in draft.description_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Descriptions:** (not selected)
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

{% if values and values|length > 0 %}
**Current Values:** {% for item in values %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.value_ids and draft.value_ids|length > 0 %}
**Current Values IDs:** {% for id in draft.value_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Values:** (not selected)
{% endif %}

{% if endpoints and endpoints|length > 0 %}
**Current Endpoints:** {% for item in endpoints %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.endpoint_ids and draft.endpoint_ids|length > 0 %}
**Current Endpoints IDs:** {% for id in draft.endpoint_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Endpoints:** (not selected)
{% endif %}

{% if keys and keys|length > 0 %}
**Current Keys:** {% for item in keys %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.key_ids and draft.key_ids|length > 0 %}
**Current Keys IDs:** {% for id in draft.key_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Keys:** (not selected)
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

{% if descriptions and descriptions|length > 0 %}
### Available Descriptions
{% for item in descriptions %}
- id: {{ item.id }} | description: {{ item.description[:100] }}{% if item.description|length > 100 %}...{% endif %}
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

{% if values and values|length > 0 %}
### Available Values
{% for item in values %}
- id: {{ item.id }} | value: {{ item.value if item.value is defined else item.id }}
{% endfor %}
{% endif %}

{% if endpoints and endpoints|length > 0 %}
### Available Endpoints
{% for item in endpoints %}
- id: {{ item.id }} | value: {{ item.value if item.value is defined else item.id }}
{% endfor %}
{% endif %}

{% if keys and keys|length > 0 %}
### Available Keys
{% for item in keys %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

## Tool Usage (Either/Or)

For each resource, choose ONE approach:
- **use_*** tools: When a suitable resource ALREADY EXISTS above (pass the existing id)
- **create_*** tools: When you need to generate NEW content (nothing suitable exists)

You do NOT need to both create and use — pick one based on whether a suitable resource exists.
', true, '2026-01-17T17:58:56.088129+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bcd1c-334b-73fb-a52d-c4516e98ae69', 'Provider', '2026-01-17T17:58:56.073128+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-01-17T17:58:56.073128+00:00', '2026-01-17T17:58:56.073128+00:00', '00000000-0000-0000-0000-000000000000', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '019c5517-4673-762c-a096-0a35439ebf11', true, '2026-02-13T03:41:54.664757+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('00000000-0000-0000-0000-000000000000', '019bcd1c-334b-78ec-9926-85858921d389', '2026-01-17T17:58:56.073128+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('00000000-0000-0000-0000-000000000000', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-01-17T17:58:56.073128+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('00000000-0000-0000-0000-000000000000', '019bcd1c-3358-7644-a68e-e260fdde031c', '2026-01-17T17:58:56.088129+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('00000000-0000-0000-0000-000000000000', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '2026-01-17T17:58:56.073128+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('00000000-0000-0000-0000-000000000000', '019bcd1c-334b-73fb-a52d-c4516e98ae69', '2026-01-17T17:58:56.073128+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2026-01-17T17:58:56.073128+00:00', '00000000-0000-0000-0000-000000000000', '00000000-1111-1111-1111-000000000000', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '019c06a8-2af4-7c97-ab30-1e863db0e8e3', true, '2026-02-10T19:13:36.011239+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '019c06a8-2af5-705d-ae92-7905a846a500', true, '2026-02-10T19:13:36.011239+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '019c06a8-2af5-766c-9713-315ab9567235', true, '2026-02-10T19:13:36.011239+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '019c06a8-2af6-727b-b94a-71bddc4d76de', true, '2026-02-10T19:13:36.011239+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '019bebc4-d436-7bf6-af0e-91e685a8f15e', true, '2026-02-10T19:13:36.011239+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-01-17T17:58:56.073128+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '019bebc4-d436-7c14-a42e-f45a12c4fdb0', true, '2026-01-17T17:58:56.073128+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-01-17T17:58:56.073128+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '019bebc4-d436-7c81-832a-a4a08d2b50f6', true, '2026-02-10T19:13:36.011239+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '019bebc4-d436-7d12-8233-8e29598e4620', true, '2026-01-17T17:58:56.073128+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '019bebc4-d436-7c28-b7bf-f89de16c64d0', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '99022425-d75d-40f1-9886-cba63505a99e', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '5133b52b-e5ee-4f08-a9e0-f5b459ab8bea', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '16e7c53f-f4ed-409b-86f9-dfbcdec5e0c3', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
