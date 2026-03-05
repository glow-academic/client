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
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voices, model_id, prompt_id, instruction_ids) VALUES ('2026-02-13T03:41:54.664757+00:00', true, false, false, '019c5517-4673-762c-a096-0a35439ebf11', 'Provider', 'AI agent for generating and managing provider resources including names, descriptions, flags, and endpoints using GPT-5.1', '{}', 0, 'none', '{019bebc4-d436-7c01-b86b-9483883762a6,019bebc4-d436-7d12-8233-8e29598e4620,019bebc4-d436-7c35-9f98-31957504bf95,019bebc4-d436-7c81-832a-a4a08d2b50f6,019c06a8-2af6-727b-b94a-71bddc4d76de,019c06a8-2af5-766c-9713-315ab9567235,019c06a8-2af5-705d-ae92-7905a846a500,019c06a8-2af4-7c97-ab30-1e863db0e8e3,99022425-d75d-40f1-9886-cba63505a99e,019bebc4-d436-7c28-b7bf-f89de16c64d0,16e7c53f-f4ed-409b-86f9-dfbcdec5e0c3,5133b52b-e5ee-4f08-a9e0-f5b459ab8bea}', NULL, '{}', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '00000000-1111-1111-1111-000000000000', '{019bcd1c-3358-7644-a68e-e260fdde031c}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bcd1c-334b-78ec-9926-85858921d389', 'AI agent for generating and managing provider resources including names, descriptions, flags, and endpoints using GPT-5.1', '2026-01-17T17:58:56.073128+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019bcd1c-3358-7644-a68e-e260fdde031c', '## Current State
{% set draft = artifacts.provider.get.entries.draft_provider if artifacts.provider.get.entries and artifacts.provider.get.entries.draft_provider else None %}
{% if draft and draft.name_ids and draft.name_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.provider.get.resources.names if item.id|string in draft.name_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Names: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Names: ({{ draft.name_ids|length }} selected by ID){% endif %}{% else %}Names: (not set){% endif %}
{% if draft and draft.description_ids and draft.description_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.provider.get.resources.descriptions if item.id|string in draft.description_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Descriptions: {% for item in selected %}{{ item.description[:100] }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Descriptions: ({{ draft.description_ids|length }} selected by ID){% endif %}{% else %}Descriptions: (not set){% endif %}
{% if draft and draft.flag_ids and draft.flag_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.provider.get.resources.flags if item.flag_option_id|string in draft.flag_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Flags: {% for item in selected %}{{ item.label or item.key }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Flags: ({{ draft.flag_ids|length }} selected by ID){% endif %}{% else %}Flags: (not set){% endif %}
{% if draft and draft.department_ids and draft.department_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.provider.get.resources.departments if item.department_id|string in draft.department_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Departments: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Departments: ({{ draft.department_ids|length }} selected by ID){% endif %}{% else %}Departments: (not set){% endif %}
{% if draft and draft.value_ids and draft.value_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.provider.get.resources.values if item.id|string in draft.value_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Values: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Values: ({{ draft.value_ids|length }} selected by ID){% endif %}{% else %}Values: (not set){% endif %}
{% if draft and draft.endpoint_ids and draft.endpoint_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.provider.get.resources.endpoints if item.id|string in draft.endpoint_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Endpoints: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Endpoints: ({{ draft.endpoint_ids|length }} selected by ID){% endif %}{% else %}Endpoints: (not set){% endif %}
{% if draft and draft.key_ids and draft.key_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.provider.get.resources.keys if item.id|string in draft.key_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Keys: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Keys: ({{ draft.key_ids|length }} selected by ID){% endif %}{% else %}Keys: (not set){% endif %}

---

{% set all_gen_types = (artifacts.provider.get.resources.types or []) + (artifacts.provider.get.entries.types or []) %}
## Available Resources
{% if "names" in all_gen_types and artifacts.provider.get.resources.names and artifacts.provider.get.resources.names|length > 0 %}
Names:
{% for item in artifacts.provider.get.resources.names %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "descriptions" in all_gen_types and artifacts.provider.get.resources.descriptions and artifacts.provider.get.resources.descriptions|length > 0 %}
Descriptions:
{% for item in artifacts.provider.get.resources.descriptions %}
- id: {{ item.id }} | {{ item.description[:100] }}{% if item.description|length > 100 %}...{% endif %}
{% endfor %}
{% endif %}
{% if "flags" in all_gen_types and artifacts.provider.get.resources.flags and artifacts.provider.get.resources.flags|length > 0 %}
Flags:
{% for item in artifacts.provider.get.resources.flags %}
- id: {{ item.flag_option_id }} | {{ item.label or item.key }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}
{% if "departments" in all_gen_types and artifacts.provider.get.resources.departments and artifacts.provider.get.resources.departments|length > 0 %}
Departments:
{% for item in artifacts.provider.get.resources.departments %}
- id: {{ item.department_id }} | {{ item.name }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}
{% if "values" in all_gen_types and artifacts.provider.get.resources.values and artifacts.provider.get.resources.values|length > 0 %}
Values:
{% for item in artifacts.provider.get.resources.values %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "endpoints" in all_gen_types and artifacts.provider.get.resources.endpoints and artifacts.provider.get.resources.endpoints|length > 0 %}
Endpoints:
{% for item in artifacts.provider.get.resources.endpoints %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "keys" in all_gen_types and artifacts.provider.get.resources.keys and artifacts.provider.get.resources.keys|length > 0 %}
Keys:
{% for item in artifacts.provider.get.resources.keys %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}

---

## Generating For
{% if artifacts.provider.get.resources.types and artifacts.provider.get.resources.types|length > 0 %}
Resource types (create or use): {{ artifacts.provider.get.resources.types|join(", ") }}
{% endif %}
{% if artifacts.provider.get.entries.types and artifacts.provider.get.entries.types|length > 0 %}
Entry types (use only): {{ artifacts.provider.get.entries.types|join(", ") }}
{% endif %}

Rules:
- For resource types: use_* when a suitable resource exists, create_* when nothing suitable exists
- For entry types: always use_* with IDs from available resources
- Only operate on the resource/entry types listed above
- Do not invent IDs — use IDs from available resources
', true, '2026-01-17T17:58:56.088129+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bcd1c-334b-73fb-a52d-c4516e98ae69', 'Provider', '2026-01-17T17:58:56.073128+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-01-17T17:58:56.073128+00:00', '2026-01-17T17:58:56.073128+00:00', '00000000-0000-0000-0000-000000000000', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '019c5517-4673-762c-a096-0a35439ebf11', true, '2026-02-13T03:41:54.664757+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, models_id, active, created_at, generated, mcp)
SELECT '00000000-0000-0000-0000-000000000000', ar.model_id, true, '2026-02-13T03:41:54.664757+00:00', false, false
FROM public.agents_resource ar
WHERE ar.id = '019c5517-4673-762c-a096-0a35439ebf11'
  AND ar.model_id IS NOT NULL
ON CONFLICT (agent_id, models_id) DO NOTHING;
-- agent_reasoning_levels_junction
INSERT INTO public.agent_reasoning_levels_junction (agent_id, reasoning_levels_id, active, created_at, generated, mcp)
SELECT '00000000-0000-0000-0000-000000000000', rlr.id, true, '2026-02-13T03:41:54.664757+00:00', false, false
FROM public.agents_resource ar
JOIN public.reasoning_levels_resource rlr
  ON rlr.reasoning_level = ar.reasoning
 AND rlr.active = true
WHERE ar.id = '019c5517-4673-762c-a096-0a35439ebf11'
  AND ar.reasoning IS NOT NULL
ON CONFLICT (agent_id, reasoning_levels_id) DO NOTHING;
-- agent_temperature_levels_junction
INSERT INTO public.agent_temperature_levels_junction (agent_id, temperature_levels_id, active, created_at, generated, mcp)
SELECT '00000000-0000-0000-0000-000000000000', tlr.id, true, '2026-02-13T03:41:54.664757+00:00', false, false
FROM public.agents_resource ar
JOIN public.temperature_levels_resource tlr
  ON tlr.temperature = ar.temperature
 AND tlr.active = true
WHERE ar.id = '019c5517-4673-762c-a096-0a35439ebf11'
  AND ar.temperature IS NOT NULL
ON CONFLICT (agent_id, temperature_levels_id) DO NOTHING;
-- agent_voices_junction
INSERT INTO public.agent_voices_junction (agent_id, voices_id, active, created_at, generated, mcp)

SELECT DISTINCT '00000000-0000-0000-0000-000000000000'::uuid, vr.id, true, '2026-02-13T03:41:54.664757+00:00'::timestamptz, false, false
FROM public.agents_resource ar
JOIN unnest(COALESCE(ar.voices, ARRAY[]::text[])) AS v(voice) ON true
JOIN public.voices_resource vr
  ON vr.voice = v.voice
 AND vr.active = true
WHERE ar.id = '019c5517-4673-762c-a096-0a35439ebf11'
ON CONFLICT (agent_id, voices_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, descriptions_id, created_at, generated, mcp, active) VALUES ('00000000-0000-0000-0000-000000000000', '019bcd1c-334b-78ec-9926-85858921d389', '2026-01-17T17:58:56.073128+00:00', false, false, true) ON CONFLICT (agent_id, descriptions_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flags_id, created_at, generated, mcp, active) VALUES ('00000000-0000-0000-0000-000000000000', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', '2026-01-17T17:58:56.073128+00:00', false, false, true) ON CONFLICT (agent_id, flags_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, names_id, created_at, generated, mcp, active) VALUES ('00000000-0000-0000-0000-000000000000', '019bcd1c-334b-73fb-a52d-c4516e98ae69', '2026-01-17T17:58:56.073128+00:00', false, false, true) ON CONFLICT (agent_id, names_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '019c06a8-2af4-7c97-ab30-1e863db0e8e3', true, '2026-02-10T19:13:36.011239+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '019c06a8-2af5-705d-ae92-7905a846a500', true, '2026-02-10T19:13:36.011239+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '019c06a8-2af5-766c-9713-315ab9567235', true, '2026-02-10T19:13:36.011239+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '019c06a8-2af6-727b-b94a-71bddc4d76de', true, '2026-02-10T19:13:36.011239+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-01-17T17:58:56.073128+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-01-17T17:58:56.073128+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '019bebc4-d436-7c81-832a-a4a08d2b50f6', true, '2026-02-10T19:13:36.011239+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '019bebc4-d436-7d12-8233-8e29598e4620', true, '2026-01-17T17:58:56.073128+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '019bebc4-d436-7c28-b7bf-f89de16c64d0', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '99022425-d75d-40f1-9886-cba63505a99e', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '5133b52b-e5ee-4f08-a9e0-f5b459ab8bea', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '16e7c53f-f4ed-409b-86f9-dfbcdec5e0c3', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
