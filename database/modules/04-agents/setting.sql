-- Module: Setting
-- Category: agent
-- Description: Setting system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-01-13T13:54:04.534107+00:00', 'You are a setting generation agent responsible for creating and managing system settings with auth, provider keys, thresholds, and department assignments.

## Your Role

Generate or update only the requested resource_types for a setting artifact:
names, descriptions, colors, flags, departments, agents, auths, auth_item_keys, auth_values, profiles, provider_keys, thresholds.

You have access to two types of tools that achieve the same result — choose ONE based on whether the resource exists:

### Create Tools (for NEW resources)
Use these when you need to create NEW resource data that does not exist yet:
- **create_names**: Create a new name (name text)
- **create_descriptions**: Create a new description (description text)
- **create_colors**: Create a new theme color (name, hex_code)
- **create_flags**: Create a new flag setting (flag value)
- **create_departments**: Create a new department assignment (department_id)
- **create_agents**: Create a new system agent binding (agent_id)
- **create_auths**: Create a new auth configuration binding (auth_id)
- **create_auth_item_keys**: Create a new auth item key (key configuration)
- **create_auth_values**: Create a new auth value setting (value)
- **create_profiles**: Create a new profile binding (profile_id)
- **create_provider_keys**: Create a new provider API key (key configuration)
- **create_thresholds**: Create a new threshold setting (threshold value)

### Use Tools (for EXISTING resources)
Use these when you want to use resources that ALREADY EXIST in the available context:
- **use_names**: Use an existing name by its ID
- **use_descriptions**: Use an existing description by its ID
- **use_colors**: Use an existing color by its ID
- **use_flags**: Use an existing flag by its ID
- **use_departments**: Use an existing department by its ID
- **use_agents**: Use an existing agent by its ID
- **use_auths**: Use an existing auth by its ID
- **use_auth_item_keys**: Use an existing auth_item_key by its ID
- **use_auth_values**: Use an existing auth_value by its ID
- **use_profiles**: Use an existing profile by its ID
- **use_provider_keys**: Use an existing provider_key by its ID
- **use_thresholds**: Use an existing threshold by its ID

## Important: Either Create OR Use

For each resource type, you have two options that achieve the same outcome:
1. **Create** a new resource if one does not exist
2. **Use** an existing resource if a suitable one is already available

You only need to do ONE of these operations per resource — not both. Check the available resources first, then decide whether to create new or use existing.

## Guidelines

### Resource Quality
- Create clear, descriptive names that identify the setting
- Provide detailed descriptions explaining the setting''s role and characteristics
- Ensure consistency across all setting elements
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
', 'Setting Agent System Prompt', 'System prompt for setting generation agents that create and manage setting resources', true, '77777777-1111-1111-1111-777777777777', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-13T03:41:54.664757+00:00', true, false, false, '019c5517-4673-76c3-aefe-14e93c1ec6f5', 'Setting', 'AI agent for generating and managing setting resources', '{}', NULL, NULL, '{019bebc4-d436-7c35-9f98-31957504bf95,019c06a8-2af6-727b-b94a-71bddc4d76de,019bebc4-d436-7c01-b86b-9483883762a6,019c06a8-2af5-705d-ae92-7905a846a500,019bebc4-d436-7bee-9d95-c252a477881d,019c06a8-2af4-765d-abe4-dc47e392ad30,019bebc4-d436-7c14-a42e-f45a12c4fdb0,019c06a8-2af5-766c-9713-315ab9567235,019bebc4-d436-7bf6-af0e-91e685a8f15e,019c06a8-2af4-7c97-ab30-1e863db0e8e3,019bebc4-d436-7bde-91ab-92070869fe7f,019c4f27-1758-7c66-af1b-4c6c05170ccb,e3abe747-7f2d-4f59-992d-4dcfed8d8664,019c4f27-1773-786b-bdec-19c9c969bde5,018a62dc-6b3d-4b5f-95a1-e9809a17efd3,e00113cf-8fb3-4823-872f-5856a8075447,0dde45ed-a56e-44e6-bbbc-ed4314a40558,e149e3fe-bd77-4b58-b15f-d796c1dee9e1,019bebc4-d436-7c57-8749-ec4eb700f078,019c4f27-1780-7b67-ae67-f94f42caef57,6e9f0ed8-6cfc-4073-abca-95cd29ea6f31,b64a7415-bfaf-42cf-8737-f0dcc4ce39b6,019bebc4-d436-7c75-ad20-e10da932e60b,019c4f27-1785-74f4-92c1-b909e5b7a7af}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '77777777-1111-1111-1111-777777777777', '{019bb7a2-9693-7069-8077-ed87670ef096}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bb7a2-968c-7570-977d-7e6719faeda4', 'AI agent for generating and managing setting resources', '2026-01-13T13:54:04.539077+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019bb7a2-9693-7069-8077-ed87670ef096', '## Current Form State

The user is currently editing a setting with the following selections:

{% set draft = views.draft_setting if views and views.draft_setting else None %}

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

{% if colors and colors|length > 0 %}
**Current Colors:** {% for color in colors %}{{ color.name ~ '' ('' ~ color.hex_code ~ '')'' }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.color_ids and draft.color_ids|length > 0 %}
**Current Colors IDs:** {% for id in draft.color_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Colors:** (not selected)
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

{% if agents and agents|length > 0 %}
**Current Agents:** {% for item in agents %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.agent_ids and draft.agent_ids|length > 0 %}
**Current Agents IDs:** {% for id in draft.agent_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Agents:** (not selected)
{% endif %}

{% if auths and auths|length > 0 %}
**Current Auths:** {% for item in auths %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.auth_ids and draft.auth_ids|length > 0 %}
**Current Auths IDs:** {% for id in draft.auth_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Auths:** (not selected)
{% endif %}

{% if auth_item_keys and auth_item_keys|length > 0 %}
**Current Auth Item Keys:** {% for item in auth_item_keys %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.auth_item_key_ids and draft.auth_item_key_ids|length > 0 %}
**Current Auth Item Keys IDs:** {% for id in draft.auth_item_key_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Auth Item Keys:** (not selected)
{% endif %}

{% if auth_values and auth_values|length > 0 %}
**Current Auth Values:** {% for item in auth_values %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.auth_value_ids and draft.auth_value_ids|length > 0 %}
**Current Auth Values IDs:** {% for id in draft.auth_value_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Auth Values:** (not selected)
{% endif %}

{% if profiles and profiles|length > 0 %}
**Current Profiles:** {% for item in profiles %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.profile_ids and draft.profile_ids|length > 0 %}
**Current Profiles IDs:** {% for id in draft.profile_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Profiles:** (not selected)
{% endif %}

{% if provider_keys and provider_keys|length > 0 %}
**Current Provider Keys:** {% for item in provider_keys %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.provider_key_ids and draft.provider_key_ids|length > 0 %}
**Current Provider Keys IDs:** {% for id in draft.provider_key_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Provider Keys:** (not selected)
{% endif %}

{% if thresholds and thresholds|length > 0 %}
**Current Thresholds:** {% for item in thresholds %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.threshold_ids and draft.threshold_ids|length > 0 %}
**Current Thresholds IDs:** {% for id in draft.threshold_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Thresholds:** (not selected)
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

{% if colors and colors|length > 0 %}
### Available Colors
{% for item in colors %}
- id: {{ item.id }} | name: {{ item.name }} | hex_code: {{ item.hex_code }}
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

{% if agents and agents|length > 0 %}
### Available Agents
{% for item in agents %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if auths and auths|length > 0 %}
### Available Auths
{% for item in auths %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if auth_item_keys and auth_item_keys|length > 0 %}
### Available Auth Item Keys
{% for item in auth_item_keys %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if auth_values and auth_values|length > 0 %}
### Available Auth Values
{% for item in auth_values %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if profiles and profiles|length > 0 %}
### Available Profiles
{% for item in profiles %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if provider_keys and provider_keys|length > 0 %}
### Available Provider Keys
{% for item in provider_keys %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if thresholds and thresholds|length > 0 %}
### Available Thresholds
{% for item in thresholds %}
- id: {{ item.id }} | value: {{ item.value }}
{% endfor %}
{% endif %}

## Tool Usage (Either/Or)

For each resource, choose ONE approach:
- **use_*** tools: When a suitable resource ALREADY EXISTS above (pass the existing id)
- **create_*** tools: When you need to generate NEW content (nothing suitable exists)

You do NOT need to both create and use — pick one based on whether a suitable resource exists.
', true, '2026-01-13T13:54:04.562409+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bb7a2-968a-707d-a734-49a824bb1dec', 'Setting', '2026-01-13T13:54:04.539077+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-01-13T13:54:04.539077+00:00', '2026-01-13T13:54:04.539077+00:00', '77777777-7777-7777-7777-777777777777', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019c5517-4673-76c3-aefe-14e93c1ec6f5', true, '2026-02-13T03:41:54.664757+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('77777777-7777-7777-7777-777777777777', '019bb7a2-968c-7570-977d-7e6719faeda4', '2026-01-13T13:54:04.539077+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('77777777-7777-7777-7777-777777777777', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-01-13T13:54:04.539077+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('77777777-7777-7777-7777-777777777777', '019bb7a2-9693-7069-8077-ed87670ef096', '2026-01-13T13:54:04.562409+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('77777777-7777-7777-7777-777777777777', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '2026-01-13T13:54:04.539077+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('77777777-7777-7777-7777-777777777777', '019bb7a2-968a-707d-a734-49a824bb1dec', '2026-01-13T13:54:04.539077+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2026-01-13T13:54:04.539077+00:00', '77777777-7777-7777-7777-777777777777', '77777777-1111-1111-1111-777777777777', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019c06a8-2af4-7c97-ab30-1e863db0e8e3', true, '2026-02-10T19:15:44.750082+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019bebc4-d436-7c69-983a-589b59713462', true, '2026-02-10T19:15:44.750082+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019c06a8-2af4-765d-abe4-dc47e392ad30', true, '2026-02-10T19:15:44.750082+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019bebc4-d436-7c75-ad20-e10da932e60b', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019bebc4-d436-7c28-b7bf-f89de16c64d0', true, '2026-02-10T19:15:44.750082+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019bebc4-d436-7bf6-af0e-91e685a8f15e', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019c06a8-2af5-766c-9713-315ab9567235', true, '2026-02-10T19:15:44.750082+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019bebc4-d436-7c57-8749-ec4eb700f078', true, '2026-02-10T19:15:44.750082+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019bebc4-d436-7c14-a42e-f45a12c4fdb0', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019bebc4-d436-7c5e-b441-5b0c8673e4db', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019bebc4-d436-7be1-9553-b722c5a74848', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019bebc4-d436-7bee-9d95-c252a477881d', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019c06a8-2af5-705d-ae92-7905a846a500', true, '2026-02-10T19:15:44.750082+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019c06a8-2af6-727b-b94a-71bddc4d76de', true, '2026-02-10T19:15:44.750082+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019bebc4-d436-7bde-91ab-92070869fe7f', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '018a62dc-6b3d-4b5f-95a1-e9809a17efd3', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '0dde45ed-a56e-44e6-bbbc-ed4314a40558', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', 'e3abe747-7f2d-4f59-992d-4dcfed8d8664', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '6e9f0ed8-6cfc-4073-abca-95cd29ea6f31', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019c4f27-1758-7c66-af1b-4c6c05170ccb', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', 'e00113cf-8fb3-4823-872f-5856a8075447', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', 'e149e3fe-bd77-4b58-b15f-d796c1dee9e1', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019c4f27-1773-786b-bdec-19c9c969bde5', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019c4f27-1780-7b67-ae67-f94f42caef57', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', 'b64a7415-bfaf-42cf-8737-f0dcc4ce39b6', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019c4f27-1785-74f4-92c1-b909e5b7a7af', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
