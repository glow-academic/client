-- Module: Department
-- Category: agent
-- Description: Department system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-01-17T17:57:40.636093+00:00', 'You are a department generation agent responsible for creating and managing organizational departments with settings.

## Your Role

Generate or update only the requested resource_types for a department artifact:
names, descriptions, flags, settings.

You have access to two types of tools that achieve the same result — choose ONE based on whether the resource exists:

### Create Tools (for NEW resources)
Use these when you need to create NEW resource data that does not exist yet:
- **create_names**: Create a new name (name text)
- **create_descriptions**: Create a new description (description text)
- **create_flags**: Create a new flag setting (flag value)
- **create_settings**: Create a new department setting (setting configuration)

### Use Tools (for EXISTING resources)
Use these when you want to use resources that ALREADY EXIST in the available context:
- **use_names**: Use an existing name by its ID
- **use_descriptions**: Use an existing description by its ID
- **use_flags**: Use an existing flag by its ID
- **use_settings**: Use an existing setting by its ID

## Important: Either Create OR Use

For each resource type, you have two options that achieve the same outcome:
1. **Create** a new resource if one does not exist
2. **Use** an existing resource if a suitable one is already available

You only need to do ONE of these operations per resource — not both. Check the available resources first, then decide whether to create new or use existing.

## Guidelines

### Resource Quality
- Create clear, descriptive names that identify the department
- Provide detailed descriptions explaining the department''s role and characteristics
- Ensure consistency across all department elements
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
', 'Department Agent System Prompt', 'System prompt for department generation agents', true, '44444444-5555-5555-5555-444444444444', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voices, model_id, prompt_id, instruction_ids) VALUES ('2026-02-13T03:41:54.664757+00:00', true, false, false, '019c5517-4673-71f7-a48c-9f4c24d00185', 'Department', 'AI agent for generating and managing department resources including names, descriptions, flags, and settings using GPT-5.1', '{}', 0, 'none', '{019bebc4-d436-7c01-b86b-9483883762a6,019bebc4-d436-7c35-9f98-31957504bf95,019bebc4-d436-7c69-983a-589b59713462,019c06a8-2af5-766c-9713-315ab9567235,019c06a8-2af6-727b-b94a-71bddc4d76de,019c06a8-2af5-705d-ae92-7905a846a500,019c4f27-1784-7127-9b62-b1b57aac5b54}', NULL, '{}', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '44444444-5555-5555-5555-444444444444', '{019c2f13-4400-7c00-8000-000000000001}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bcd1b-0c9e-77c7-9408-98c9d2b8e010', 'AI agent for generating and managing department resources including names, descriptions, flags, and settings using GPT-5.1', '2026-01-17T17:57:40.636093+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c2f13-4400-7c00-8000-000000000001', '## Current State
{% set draft = artifacts.department.get.entries.draft_department if artifacts.department.get.entries and artifacts.department.get.entries.draft_department else None %}
{% if draft and draft.name_ids and draft.name_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.department.get.resources.names if item.id|string in draft.name_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Names: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Names: ({{ draft.name_ids|length }} selected by ID){% endif %}{% else %}Names: (not set){% endif %}
{% if draft and draft.description_ids and draft.description_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.department.get.resources.descriptions if item.id|string in draft.description_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Descriptions: {% for item in selected %}{{ item.description[:100] }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Descriptions: ({{ draft.description_ids|length }} selected by ID){% endif %}{% else %}Descriptions: (not set){% endif %}
{% if draft and draft.flag_ids and draft.flag_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.department.get.resources.flags if item.flag_option_id|string in draft.flag_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Flags: {% for item in selected %}{{ item.label or item.key }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Flags: ({{ draft.flag_ids|length }} selected by ID){% endif %}{% else %}Flags: (not set){% endif %}
{% if draft and draft.setting_ids and draft.setting_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.department.get.resources.settings if item.id|string in draft.setting_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Settings: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Settings: ({{ draft.setting_ids|length }} selected by ID){% endif %}{% else %}Settings: (not set){% endif %}

---

{% set all_gen_types = (artifacts.department.get.resources.types or []) + (artifacts.department.get.entries.types or []) %}
## Available Resources
{% if "names" in all_gen_types and artifacts.department.get.resources.names and artifacts.department.get.resources.names|length > 0 %}
Names:
{% for item in artifacts.department.get.resources.names %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "descriptions" in all_gen_types and artifacts.department.get.resources.descriptions and artifacts.department.get.resources.descriptions|length > 0 %}
Descriptions:
{% for item in artifacts.department.get.resources.descriptions %}
- id: {{ item.id }} | {{ item.description[:100] }}{% if item.description|length > 100 %}...{% endif %}
{% endfor %}
{% endif %}
{% if "flags" in all_gen_types and artifacts.department.get.resources.flags and artifacts.department.get.resources.flags|length > 0 %}
Flags:
{% for item in artifacts.department.get.resources.flags %}
- id: {{ item.flag_option_id }} | {{ item.label or item.key }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}
{% if "settings" in all_gen_types and artifacts.department.get.resources.settings and artifacts.department.get.resources.settings|length > 0 %}
Settings:
{% for item in artifacts.department.get.resources.settings %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}

---

## Generating For
{% if artifacts.department.get.resources.types and artifacts.department.get.resources.types|length > 0 %}
Resource types (create or use): {{ artifacts.department.get.resources.types|join(", ") }}
{% endif %}
{% if artifacts.department.get.entries.types and artifacts.department.get.entries.types|length > 0 %}
Entry types (use only): {{ artifacts.department.get.entries.types|join(", ") }}
{% endif %}

Rules:
- For resource types: use_* when a suitable resource exists, create_* when nothing suitable exists
- For entry types: always use_* with IDs from available resources
- Only operate on the resource/entry types listed above
- Do not invent IDs — use IDs from available resources
', true, '2026-02-10T19:14:16.391398+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bcd1b-0c9d-77e7-a11e-ff4b66344eb8', 'Department', '2026-01-17T17:57:40.636093+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-01-17T17:57:40.636093+00:00', '2026-01-17T17:57:40.636093+00:00', '44444444-4444-4444-4444-444444444444', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('44444444-4444-4444-4444-444444444444', '019c5517-4673-71f7-a48c-9f4c24d00185', true, '2026-02-13T03:41:54.664757+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, active, created_at, generated, mcp)
SELECT '44444444-4444-4444-4444-444444444444', ar.model_id, true, '2026-02-13T03:41:54.664757+00:00', false, false
FROM public.agents_resource ar
WHERE ar.id = '019c5517-4673-71f7-a48c-9f4c24d00185'
  AND ar.model_id IS NOT NULL
ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_reasoning_levels_junction
INSERT INTO public.agent_reasoning_levels_junction (agent_id, reasoning_level_id, active, created_at, generated, mcp)
SELECT '44444444-4444-4444-4444-444444444444', rlr.id, true, '2026-02-13T03:41:54.664757+00:00', false, false
FROM public.agents_resource ar
JOIN public.reasoning_levels_resource rlr
  ON rlr.reasoning_level = ar.reasoning
 AND rlr.active = true
WHERE ar.id = '019c5517-4673-71f7-a48c-9f4c24d00185'
  AND ar.reasoning IS NOT NULL
ON CONFLICT (agent_id, reasoning_level_id) DO NOTHING;
-- agent_temperature_levels_junction
INSERT INTO public.agent_temperature_levels_junction (agent_id, temperature_level_id, active, created_at, generated, mcp)
SELECT '44444444-4444-4444-4444-444444444444', tlr.id, true, '2026-02-13T03:41:54.664757+00:00', false, false
FROM public.agents_resource ar
JOIN public.temperature_levels_resource tlr
  ON tlr.temperature = ar.temperature
 AND tlr.active = true
WHERE ar.id = '019c5517-4673-71f7-a48c-9f4c24d00185'
  AND ar.temperature IS NOT NULL
ON CONFLICT (agent_id, temperature_level_id) DO NOTHING;
-- agent_voices_junction
INSERT INTO public.agent_voices_junction (agent_id, voice_id, active, created_at, generated, mcp)

SELECT DISTINCT '44444444-4444-4444-4444-444444444444'::uuid, vr.id, true, '2026-02-13T03:41:54.664757+00:00'::timestamptz, false, false
FROM public.agents_resource ar
JOIN unnest(COALESCE(ar.voices, ARRAY[]::text[])) AS v(voice) ON true
JOIN public.voices_resource vr
  ON vr.voice = v.voice
 AND vr.active = true
WHERE ar.id = '019c5517-4673-71f7-a48c-9f4c24d00185'
ON CONFLICT (agent_id, voice_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('44444444-4444-4444-4444-444444444444', '019bcd1b-0c9e-77c7-9408-98c9d2b8e010', '2026-01-17T17:57:40.636093+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, created_at, generated, mcp, active) VALUES ('44444444-4444-4444-4444-444444444444', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', '2026-01-17T17:57:40.636093+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('44444444-4444-4444-4444-444444444444', '019bcd1b-0c9d-77e7-a11e-ff4b66344eb8', '2026-01-17T17:57:40.636093+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('44444444-4444-4444-4444-444444444444', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-01-17T17:57:40.636093+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('44444444-4444-4444-4444-444444444444', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-01-17T17:57:40.636093+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('44444444-4444-4444-4444-444444444444', '019bebc4-d436-7c69-983a-589b59713462', true, '2026-01-17T17:57:40.636093+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('44444444-4444-4444-4444-444444444444', '019c06a8-2af5-705d-ae92-7905a846a500', true, '2026-02-10T19:14:16.391398+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('44444444-4444-4444-4444-444444444444', '019c06a8-2af5-766c-9713-315ab9567235', true, '2026-02-10T19:14:16.391398+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('44444444-4444-4444-4444-444444444444', '019c06a8-2af6-727b-b94a-71bddc4d76de', true, '2026-02-10T19:14:16.391398+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('44444444-4444-4444-4444-444444444444', '019c4f27-1784-7127-9b62-b1b57aac5b54', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
