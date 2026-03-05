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
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voices, model_id, prompt_id, instruction_ids) VALUES ('2026-02-13T03:41:54.664757+00:00', true, false, false, '019c5517-4673-73a7-967b-11d2389f9cc5', 'Model', 'AI agent for generating and managing model resources including names, descriptions, flags, departments, endpoints, keys, modalities, and providers using GPT-5.1', '{}', 0, 'none', '{019bebc4-d436-7c35-9f98-31957504bf95,019bebc4-d436-7c28-b7bf-f89de16c64d0,019bebc4-d436-7cf0-9617-f44d4e7a6d71,019bebc4-d436-7cec-b8a7-a31628d74ae4,019bebc4-d436-7ce4-83f1-2299dc3bbd35,019bebc4-d436-7ccc-9e9c-6f4b2a633f9d,019bebc4-d436-7ccb-b52a-fa65793c95ce,019bebc4-d436-7cc0-a482-5c0fad4f04e9,019bebc4-d436-7c5e-b441-5b0c8673e4db,019bebc4-d436-7c01-b86b-9483883762a6,019bebc4-d436-7c81-832a-a4a08d2b50f6,019bebc4-d436-7d12-8233-8e29598e4620,019c06a8-2af4-7c97-ab30-1e863db0e8e3,019c06a8-2af5-705d-ae92-7905a846a500,019c06a8-2af5-766c-9713-315ab9567235,019c4f27-177d-7066-8f89-2089560e5d4f,019c06a8-2af6-727b-b94a-71bddc4d76de,9eea4ffa-2482-498b-9651-1d8549da8b09,019c4f27-1781-78eb-922b-095e42cb9438,019c4f27-1782-706e-bc20-dc534c81ebda,019c4f27-1782-77f6-8e39-d193b8240237,019c4f27-1784-7c83-a971-06d5405753dd,209cfad1-69b5-40be-a980-406888376306,16e7c53f-f4ed-409b-86f9-dfbcdec5e0c3}', NULL, '{}', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '99999999-aaaa-aaaa-aaaa-999999999999', '{019c2f13-4200-7c00-8000-000000000002}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bcd1b-0ca8-79db-bc63-4cc38e3deb3c', 'AI agent for generating and managing model resources including names, descriptions, flags, departments, endpoints, keys, modalities, and providers using GPT-5.1', '2026-01-17T17:57:40.647526+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c2f13-4200-7c00-8000-000000000002', '## Current State
{% set draft = artifacts.model.get.entries.draft_model if artifacts.model.get.entries and artifacts.model.get.entries.draft_model else None %}
{% if draft and draft.name_ids and draft.name_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.model.get.resources.names if item.id|string in draft.name_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Names: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Names: ({{ draft.name_ids|length }} selected by ID){% endif %}{% else %}Names: (not set){% endif %}
{% if draft and draft.description_ids and draft.description_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.model.get.resources.descriptions if item.id|string in draft.description_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Descriptions: {% for item in selected %}{{ item.description[:100] }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Descriptions: ({{ draft.description_ids|length }} selected by ID){% endif %}{% else %}Descriptions: (not set){% endif %}
{% if draft and draft.value_ids and draft.value_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.model.get.resources.values if item.id|string in draft.value_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Values: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Values: ({{ draft.value_ids|length }} selected by ID){% endif %}{% else %}Values: (not set){% endif %}
{% if draft and draft.provider_ids and draft.provider_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.model.get.resources.providers if item.id|string in draft.provider_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Providers: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Providers: ({{ draft.provider_ids|length }} selected by ID){% endif %}{% else %}Providers: (not set){% endif %}
{% if draft and draft.flag_ids and draft.flag_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.model.get.resources.flags if item.flag_option_id|string in draft.flag_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Flags: {% for item in selected %}{{ item.label or item.key }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Flags: ({{ draft.flag_ids|length }} selected by ID){% endif %}{% else %}Flags: (not set){% endif %}
{% if draft and draft.department_ids and draft.department_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.model.get.resources.departments if item.department_id|string in draft.department_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Departments: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Departments: ({{ draft.department_ids|length }} selected by ID){% endif %}{% else %}Departments: (not set){% endif %}
{% if draft and draft.modalities_ids and draft.modalities_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.model.get.resources.modalities if item.id|string in draft.modalities_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Modalities: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Modalities: ({{ draft.modalities_ids|length }} selected by ID){% endif %}{% else %}Modalities: (not set){% endif %}
{% if draft and draft.temperature_level_ids and draft.temperature_level_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.model.get.resources.temperature_levels if item.id|string in draft.temperature_level_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Temperature Levels: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Temperature Levels: ({{ draft.temperature_level_ids|length }} selected by ID){% endif %}{% else %}Temperature Levels: (not set){% endif %}
{% if draft and draft.pricing_ids and draft.pricing_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.model.get.resources.pricing if item.id|string in draft.pricing_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Pricing: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Pricing: ({{ draft.pricing_ids|length }} selected by ID){% endif %}{% else %}Pricing: (not set){% endif %}
{% if draft and draft.reasoning_level_ids and draft.reasoning_level_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.model.get.resources.reasoning_levels if item.id|string in draft.reasoning_level_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Reasoning Levels: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Reasoning Levels: ({{ draft.reasoning_level_ids|length }} selected by ID){% endif %}{% else %}Reasoning Levels: (not set){% endif %}
{% if draft and draft.qualities_ids and draft.qualities_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.model.get.resources.qualities if item.id|string in draft.qualities_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Qualities: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Qualities: ({{ draft.qualities_ids|length }} selected by ID){% endif %}{% else %}Qualities: (not set){% endif %}
{% if draft and draft.voice_ids and draft.voice_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.model.get.resources.voices if item.id|string in draft.voice_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Voices: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Voices: ({{ draft.voice_ids|length }} selected by ID){% endif %}{% else %}Voices: (not set){% endif %}

---

{% set all_gen_types = (artifacts.model.get.resources.types or []) + (artifacts.model.get.entries.types or []) %}
## Available Resources
{% if "names" in all_gen_types and artifacts.model.get.resources.names and artifacts.model.get.resources.names|length > 0 %}
Names:
{% for item in artifacts.model.get.resources.names %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "descriptions" in all_gen_types and artifacts.model.get.resources.descriptions and artifacts.model.get.resources.descriptions|length > 0 %}
Descriptions:
{% for item in artifacts.model.get.resources.descriptions %}
- id: {{ item.id }} | {{ item.description[:100] }}{% if item.description|length > 100 %}...{% endif %}
{% endfor %}
{% endif %}
{% if "values" in all_gen_types and artifacts.model.get.resources.values and artifacts.model.get.resources.values|length > 0 %}
Values:
{% for item in artifacts.model.get.resources.values %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "providers" in all_gen_types and artifacts.model.get.resources.providers and artifacts.model.get.resources.providers|length > 0 %}
Providers:
{% for item in artifacts.model.get.resources.providers %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "flags" in all_gen_types and artifacts.model.get.resources.flags and artifacts.model.get.resources.flags|length > 0 %}
Flags:
{% for item in artifacts.model.get.resources.flags %}
- id: {{ item.flag_option_id }} | {{ item.label or item.key }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}
{% if "departments" in all_gen_types and artifacts.model.get.resources.departments and artifacts.model.get.resources.departments|length > 0 %}
Departments:
{% for item in artifacts.model.get.resources.departments %}
- id: {{ item.department_id }} | {{ item.name }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}
{% if "modalities" in all_gen_types and artifacts.model.get.resources.modalities and artifacts.model.get.resources.modalities|length > 0 %}
Modalities:
{% for item in artifacts.model.get.resources.modalities %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "temperature_levels" in all_gen_types and artifacts.model.get.resources.temperature_levels and artifacts.model.get.resources.temperature_levels|length > 0 %}
Temperature Levels:
{% for item in artifacts.model.get.resources.temperature_levels %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "pricing" in all_gen_types and artifacts.model.get.resources.pricing and artifacts.model.get.resources.pricing|length > 0 %}
Pricing:
{% for item in artifacts.model.get.resources.pricing %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "reasoning_levels" in all_gen_types and artifacts.model.get.resources.reasoning_levels and artifacts.model.get.resources.reasoning_levels|length > 0 %}
Reasoning Levels:
{% for item in artifacts.model.get.resources.reasoning_levels %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "qualities" in all_gen_types and artifacts.model.get.resources.qualities and artifacts.model.get.resources.qualities|length > 0 %}
Qualities:
{% for item in artifacts.model.get.resources.qualities %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "voices" in all_gen_types and artifacts.model.get.resources.voices and artifacts.model.get.resources.voices|length > 0 %}
Voices:
{% for item in artifacts.model.get.resources.voices %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}

---

## Generating For
{% if artifacts.model.get.resources.types and artifacts.model.get.resources.types|length > 0 %}
Resource types (create or use): {{ artifacts.model.get.resources.types|join(", ") }}
{% endif %}
{% if artifacts.model.get.entries.types and artifacts.model.get.entries.types|length > 0 %}
Entry types (use only): {{ artifacts.model.get.entries.types|join(", ") }}
{% endif %}

Rules:
- For resource types: use_* when a suitable resource exists, create_* when nothing suitable exists
- For entry types: always use_* with IDs from available resources
- Only operate on the resource/entry types listed above
- Do not invent IDs — use IDs from available resources
', true, '2026-02-10T19:12:47.645232+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bcd1b-0ca8-7707-aee4-65c33067f0bb', 'Model', '2026-01-17T17:57:40.647526+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-01-17T17:57:40.647526+00:00', '2026-01-17T17:57:40.647526+00:00', '99999999-9999-9999-9999-999999999999', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019c5517-4673-73a7-967b-11d2389f9cc5', true, '2026-02-13T03:41:54.664757+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, models_id, active, created_at, generated, mcp)
SELECT '99999999-9999-9999-9999-999999999999', ar.model_id, true, '2026-02-13T03:41:54.664757+00:00', false, false
FROM public.agents_resource ar
WHERE ar.id = '019c5517-4673-73a7-967b-11d2389f9cc5'
  AND ar.model_id IS NOT NULL
ON CONFLICT (agent_id, models_id) DO NOTHING;
-- agent_reasoning_levels_junction
INSERT INTO public.agent_reasoning_levels_junction (agent_id, reasoning_levels_id, active, created_at, generated, mcp)
SELECT '99999999-9999-9999-9999-999999999999', rlr.id, true, '2026-02-13T03:41:54.664757+00:00', false, false
FROM public.agents_resource ar
JOIN public.reasoning_levels_resource rlr
  ON rlr.reasoning_level = ar.reasoning
 AND rlr.active = true
WHERE ar.id = '019c5517-4673-73a7-967b-11d2389f9cc5'
  AND ar.reasoning IS NOT NULL
ON CONFLICT (agent_id, reasoning_levels_id) DO NOTHING;
-- agent_temperature_levels_junction
INSERT INTO public.agent_temperature_levels_junction (agent_id, temperature_levels_id, active, created_at, generated, mcp)
SELECT '99999999-9999-9999-9999-999999999999', tlr.id, true, '2026-02-13T03:41:54.664757+00:00', false, false
FROM public.agents_resource ar
JOIN public.temperature_levels_resource tlr
  ON tlr.temperature = ar.temperature
 AND tlr.active = true
WHERE ar.id = '019c5517-4673-73a7-967b-11d2389f9cc5'
  AND ar.temperature IS NOT NULL
ON CONFLICT (agent_id, temperature_levels_id) DO NOTHING;
-- agent_voices_junction
INSERT INTO public.agent_voices_junction (agent_id, voices_id, active, created_at, generated, mcp)

SELECT DISTINCT '99999999-9999-9999-9999-999999999999'::uuid, vr.id, true, '2026-02-13T03:41:54.664757+00:00'::timestamptz, false, false
FROM public.agents_resource ar
JOIN unnest(COALESCE(ar.voices, ARRAY[]::text[])) AS v(voice) ON true
JOIN public.voices_resource vr
  ON vr.voice = v.voice
 AND vr.active = true
WHERE ar.id = '019c5517-4673-73a7-967b-11d2389f9cc5'
ON CONFLICT (agent_id, voices_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, descriptions_id, created_at, generated, mcp, active) VALUES ('99999999-9999-9999-9999-999999999999', '019bcd1b-0ca8-79db-bc63-4cc38e3deb3c', '2026-01-17T17:57:40.647526+00:00', false, false, true) ON CONFLICT (agent_id, descriptions_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flags_id, created_at, generated, mcp, active) VALUES ('99999999-9999-9999-9999-999999999999', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', '2026-01-17T17:57:40.647526+00:00', false, false, true) ON CONFLICT (agent_id, flags_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, names_id, created_at, generated, mcp, active) VALUES ('99999999-9999-9999-9999-999999999999', '019bcd1b-0ca8-7707-aee4-65c33067f0bb', '2026-01-17T17:57:40.647526+00:00', false, false, true) ON CONFLICT (agent_id, names_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7c5e-b441-5b0c8673e4db', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7cc0-a482-5c0fad4f04e9', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7ccb-b52a-fa65793c95ce', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7ccc-9e9c-6f4b2a633f9d', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7ce4-83f1-2299dc3bbd35', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7cec-b8a7-a31628d74ae4', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7cf0-9617-f44d4e7a6d71', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7d12-8233-8e29598e4620', true, '2026-02-10T19:12:47.645232+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7c28-b7bf-f89de16c64d0', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7c81-832a-a4a08d2b50f6', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019c06a8-2af4-7c97-ab30-1e863db0e8e3', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019c06a8-2af5-705d-ae92-7905a846a500', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019c06a8-2af5-766c-9713-315ab9567235', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019c4f27-177d-7066-8f89-2089560e5d4f', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019c06a8-2af6-727b-b94a-71bddc4d76de', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '9eea4ffa-2482-498b-9651-1d8549da8b09', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019c4f27-1781-78eb-922b-095e42cb9438', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019c4f27-1782-706e-bc20-dc534c81ebda', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019c4f27-1782-77f6-8e39-d193b8240237', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019c4f27-1784-7c83-a971-06d5405753dd', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '16e7c53f-f4ed-409b-86f9-dfbcdec5e0c3', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '209cfad1-69b5-40be-a980-406888376306', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
