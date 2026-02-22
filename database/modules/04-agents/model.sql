-- Module: Model
-- Category: agent
-- Description: Model system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-01-17T17:57:40.647526+00:00', 'You are a model generation agent responsible for creating and managing AI model configurations with providers, modalities, pricing, and capabilities.

## Your Role

Generate or update only the requested resource_types for a model artifact:
names, descriptions, values, providers, flags, departments, modalities, temperature_levels, pricing, reasoning_levels, qualities, voices.

You have access to two types of tools that achieve the same result — choose ONE based on whether the resource exists:

### Create Tools (for NEW resources)
Use these when you need to create NEW resource data that does not exist yet:
- **create_names**: Create a new name (name text)
- **create_descriptions**: Create a new description (description text)
- **create_values**: Create a new model identifier (value text)
- **create_providers**: Create a new provider binding (provider_id)
- **create_flags**: Create a new flag setting (flag value)
- **create_departments**: Create a new department assignment (department_id)
- **create_modalities**: Create a new modality (modality type)
- **create_temperature_levels**: Create a new temperature level (level)
- **create_pricing**: Create a new pricing tier (pricing configuration)
- **create_reasoning_levels**: Create a new reasoning level (level)
- **create_qualities**: Create a new quality tier (quality level)
- **create_voices**: Create a new voice setting (voice)

### Use Tools (for EXISTING resources)
Use these when you want to use resources that ALREADY EXIST in the available context:
- **use_names**: Use an existing name by its ID
- **use_descriptions**: Use an existing description by its ID
- **use_values**: Use an existing value by its ID
- **use_providers**: Use an existing provider by its ID
- **use_flags**: Use an existing flag by its ID
- **use_departments**: Use an existing department by its ID
- **use_modalities**: Use an existing modalitie by its ID
- **use_temperature_levels**: Use an existing temperature_level by its ID
- **use_pricing**: Use an existing pricing by its ID
- **use_reasoning_levels**: Use an existing reasoning_level by its ID
- **use_qualities**: Use an existing qualitie by its ID
- **use_voices**: Use an existing voice by its ID

## Important: Either Create OR Use

For each resource type, you have two options that achieve the same outcome:
1. **Create** a new resource if one does not exist
2. **Use** an existing resource if a suitable one is already available

You only need to do ONE of these operations per resource — not both. Check the available resources first, then decide whether to create new or use existing.

## Guidelines

### Resource Quality
- Create clear, descriptive names that identify the model
- Provide detailed descriptions explaining the model''s role and characteristics
- Ensure consistency across all model elements
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
', 'Model Agent System Prompt', 'System prompt for model generation agents', true, '99999999-aaaa-aaaa-aaaa-999999999999', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-13T03:41:54.664757+00:00', true, false, false, '019c5517-4673-73a7-967b-11d2389f9cc5', 'Model', 'AI agent for generating and managing model resources including names, descriptions, flags, departments, endpoints, keys, modalities, and providers using GPT-5.1', '{}', NULL, NULL, '{019bebc4-d436-7c81-832a-a4a08d2b50f6,019bebc4-d436-7c28-b7bf-f89de16c64d0,019bebc4-d436-7cf0-9617-f44d4e7a6d71,019bebc4-d436-7cec-b8a7-a31628d74ae4,019bebc4-d436-7ccb-b52a-fa65793c95ce,019bebc4-d436-7c5e-b441-5b0c8673e4db,019bebc4-d436-7c35-9f98-31957504bf95,019bebc4-d436-7c01-b86b-9483883762a6,019bebc4-d436-7cc0-a482-5c0fad4f04e9,019bebc4-d436-7ce4-83f1-2299dc3bbd35,019bebc4-d436-7ccc-9e9c-6f4b2a633f9d,019bebc4-d436-7d12-8233-8e29598e4620,9eea4ffa-2482-498b-9651-1d8549da8b09,019c4f27-1781-78eb-922b-095e42cb9438,019c4f27-1782-706e-bc20-dc534c81ebda,019c4f27-1782-77f6-8e39-d193b8240237,019c4f27-1784-7c83-a971-06d5405753dd,16e7c53f-f4ed-409b-86f9-dfbcdec5e0c3,209cfad1-69b5-40be-a980-406888376306,019c06a8-2af4-7c97-ab30-1e863db0e8e3,019c06a8-2af5-705d-ae92-7905a846a500,019c06a8-2af5-766c-9713-315ab9567235,019c06a8-2af6-727b-b94a-71bddc4d76de,019c4f27-177d-7066-8f89-2089560e5d4f}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '99999999-aaaa-aaaa-aaaa-999999999999', '{019c2f13-4200-7c00-8000-000000000002}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bcd1b-0ca8-79db-bc63-4cc38e3deb3c', 'AI agent for generating and managing model resources including names, descriptions, flags, departments, endpoints, keys, modalities, and providers using GPT-5.1', '2026-01-17T17:57:40.647526+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c2f13-4200-7c00-8000-000000000002', '## Current Form State

The user is currently editing a model with the following selections:

{% set draft = views.draft_model if views and views.draft_model else None %}

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

{% if values and values|length > 0 %}
**Current Values:** {% for item in values %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.value_ids and draft.value_ids|length > 0 %}
**Current Values IDs:** {% for id in draft.value_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Values:** (not selected)
{% endif %}

{% if providers and providers|length > 0 %}
**Current Providers:** {% for item in providers %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.provider_ids and draft.provider_ids|length > 0 %}
**Current Providers IDs:** {% for id in draft.provider_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Providers:** (not selected)
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

{% if modalities and modalities|length > 0 %}
**Current Modalities:** {% for item in modalities %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.modalities_ids and draft.modalities_ids|length > 0 %}
**Current Modalities IDs:** {% for id in draft.modalities_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Modalities:** (not selected)
{% endif %}

{% if temperature_levels and temperature_levels|length > 0 %}
**Current Temperature Levels:** {% for item in temperature_levels %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.temperature_level_ids and draft.temperature_level_ids|length > 0 %}
**Current Temperature Levels IDs:** {% for id in draft.temperature_level_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Temperature Levels:** (not selected)
{% endif %}

{% if pricing and pricing|length > 0 %}
**Current Pricing:** {% for item in pricing %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.pricing_ids and draft.pricing_ids|length > 0 %}
**Current Pricing IDs:** {% for id in draft.pricing_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Pricing:** (not selected)
{% endif %}

{% if reasoning_levels and reasoning_levels|length > 0 %}
**Current Reasoning Levels:** {% for item in reasoning_levels %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.reasoning_level_ids and draft.reasoning_level_ids|length > 0 %}
**Current Reasoning Levels IDs:** {% for id in draft.reasoning_level_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Reasoning Levels:** (not selected)
{% endif %}

{% if qualities and qualities|length > 0 %}
**Current Qualities:** {% for item in qualities %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.qualities_ids and draft.qualities_ids|length > 0 %}
**Current Qualities IDs:** {% for id in draft.qualities_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Qualities:** (not selected)
{% endif %}

{% if voices and voices|length > 0 %}
**Current Voices:** {% for item in voices %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.voice_ids and draft.voice_ids|length > 0 %}
**Current Voices IDs:** {% for id in draft.voice_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Voices:** (not selected)
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

{% if values and values|length > 0 %}
### Available Values
{% for item in values %}
- id: {{ item.id }} | value: {{ item.value if item.value is defined else item.id }}
{% endfor %}
{% endif %}

{% if providers and providers|length > 0 %}
### Available Providers
{% for item in providers %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
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

{% if modalities and modalities|length > 0 %}
### Available Modalities
{% for item in modalities %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if temperature_levels and temperature_levels|length > 0 %}
### Available Temperature Levels
{% for item in temperature_levels %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if pricing and pricing|length > 0 %}
### Available Pricing
{% for item in pricing %}
- id: {{ item.id }} | value: {{ item.value }}
{% endfor %}
{% endif %}

{% if reasoning_levels and reasoning_levels|length > 0 %}
### Available Reasoning Levels
{% for item in reasoning_levels %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if qualities and qualities|length > 0 %}
### Available Qualities
{% for item in qualities %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if voices and voices|length > 0 %}
### Available Voices
{% for item in voices %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

## Tool Usage (Either/Or)

For each resource, choose ONE approach:
- **use_*** tools: When a suitable resource ALREADY EXISTS above (pass the existing id)
- **create_*** tools: When you need to generate NEW content (nothing suitable exists)

You do NOT need to both create and use — pick one based on whether a suitable resource exists.
', true, '2026-02-10T19:12:47.645232+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bcd1b-0ca8-7707-aee4-65c33067f0bb', 'Model', '2026-01-17T17:57:40.647526+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-01-17T17:57:40.647526+00:00', '2026-01-17T17:57:40.647526+00:00', '99999999-9999-9999-9999-999999999999', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019c5517-4673-73a7-967b-11d2389f9cc5', true, '2026-02-13T03:41:54.664757+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('99999999-9999-9999-9999-999999999999', '019bcd1b-0ca8-79db-bc63-4cc38e3deb3c', '2026-01-17T17:57:40.647526+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('99999999-9999-9999-9999-999999999999', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-01-17T17:57:40.647526+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('99999999-9999-9999-9999-999999999999', '019c2f13-4200-7c00-8000-000000000002', '2026-02-10T19:12:47.645232+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('99999999-9999-9999-9999-999999999999', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '2026-01-17T17:57:40.647526+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('99999999-9999-9999-9999-999999999999', '019bcd1b-0ca8-7707-aee4-65c33067f0bb', '2026-01-17T17:57:40.647526+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2026-01-17T17:57:40.647526+00:00', '99999999-9999-9999-9999-999999999999', '99999999-aaaa-aaaa-aaaa-999999999999', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7c5e-b441-5b0c8673e4db', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7cc0-a482-5c0fad4f04e9', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7ccb-b52a-fa65793c95ce', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7ccc-9e9c-6f4b2a633f9d', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7ce4-83f1-2299dc3bbd35', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7cec-b8a7-a31628d74ae4', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7cf0-9617-f44d4e7a6d71', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7d12-8233-8e29598e4620', true, '2026-02-10T19:12:47.645232+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7c28-b7bf-f89de16c64d0', false, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7c81-832a-a4a08d2b50f6', false, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019c06a8-2af4-7c97-ab30-1e863db0e8e3', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019c06a8-2af5-705d-ae92-7905a846a500', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019c06a8-2af5-766c-9713-315ab9567235', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019c4f27-177d-7066-8f89-2089560e5d4f', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019c06a8-2af6-727b-b94a-71bddc4d76de', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '9eea4ffa-2482-498b-9651-1d8549da8b09', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019c4f27-1781-78eb-922b-095e42cb9438', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019c4f27-1782-706e-bc20-dc534c81ebda', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019c4f27-1782-77f6-8e39-d193b8240237', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019c4f27-1784-7c83-a971-06d5405753dd', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '16e7c53f-f4ed-409b-86f9-dfbcdec5e0c3', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '209cfad1-69b5-40be-a980-406888376306', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
