-- Module: Rubric
-- Category: agent
-- Description: Rubric system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2025-12-19T19:02:10.222381+00:00', 'You are a rubric generation agent responsible for creating and managing grading rubrics with standard groups, standards, and point values.

## Your Role

Generate or update only the requested resource_types for a rubric artifact:
names, descriptions, flags, departments, points, standard_groups, standards.

You have access to two types of tools that achieve the same result — choose ONE based on whether the resource exists:

### Create Tools (for NEW resources)
Use these when you need to create NEW resource data that does not exist yet:
- **create_names**: Create a new name (name text)
- **create_descriptions**: Create a new description (description text)
- **create_flags**: Create a new flag setting (flag value)
- **create_departments**: Create a new department assignment (department_id)
- **create_points**: Create a new point value (points number)
- **create_standard_groups**: Create a new standard group (group name, description)
- **create_standards**: Create a new standard (standard definition, criteria)

### Use Tools (for EXISTING resources)
Use these when you want to use resources that ALREADY EXIST in the available context:
- **use_names**: Use an existing name by its ID
- **use_descriptions**: Use an existing description by its ID
- **use_flags**: Use an existing flag by its ID
- **use_departments**: Use an existing department by its ID
- **use_points**: Use an existing point by its ID
- **use_standard_groups**: Use an existing standard_group by its ID
- **use_standards**: Use an existing standard by its ID

## Important: Either Create OR Use

For each resource type, you have two options that achieve the same outcome:
1. **Create** a new resource if one does not exist
2. **Use** an existing resource if a suitable one is already available

You only need to do ONE of these operations per resource — not both. Check the available resources first, then decide whether to create new or use existing.

## Guidelines

### Resource Quality
- Create clear, descriptive names that identify the rubric
- Provide detailed descriptions explaining the rubric''s role and characteristics
- Ensure consistency across all rubric elements
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
', 'Rubric', 'System prompt for rubric generation agents', true, '019b3be4-36fe-7e8e-bdfd-05e834f7834d', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voices, model_id, prompt_id, instruction_ids) VALUES ('2025-12-19T19:02:10.223443+00:00', true, false, false, '019bb25e-e5f2-7f73-abf4-164c630526b2', 'Rubric', 'Agent for generating rubric descriptions and grid cell content', '{}', 0, 'none', '{019bebc4-d436-7c01-b86b-9483883762a6,019bebc4-d436-7c48-bbb0-2700d1deb830,019bebc4-d436-7c35-9f98-31957504bf95,019bebc4-d436-7bc3-aadf-8fb01ebadfdb,019c06a8-2af5-766c-9713-315ab9567235,019c06a8-2af4-7c97-ab30-1e863db0e8e3,019c06a8-2af6-727b-b94a-71bddc4d76de,019c06a8-2af5-705d-ae92-7905a846a500,019c4f61-51e9-775a-8905-76dda83cfb77,6dd11e8a-c1b0-4ebf-a5f6-9e8f16c00175,d0e82950-8f92-46b9-90d6-0fdbeaebc9bb,e234b7b3-fd49-4179-9a96-ea5c355bf919,3ac11084-85a1-4f04-9dba-5e514d9afc00}', NULL, '{}', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '019b3be4-36fe-7e8e-bdfd-05e834f7834d', '{019bcd1b-0c44-7d26-927b-8b7a081ffac3}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8ea1-7cb0-9364-428e72031db8', 'Agent for generating rubric descriptions and grid cell content', '2025-12-19T19:02:10.223443+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019bcd1b-0c44-7d26-927b-8b7a081ffac3', '## Current State
{% set draft = artifacts.rubric.get.entries.draft_rubric if artifacts.rubric.get.entries and artifacts.rubric.get.entries.draft_rubric else None %}
{% if draft and draft.name_ids and draft.name_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.rubric.get.resources.names if item.id|string in draft.name_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Names: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Names: ({{ draft.name_ids|length }} selected by ID){% endif %}{% else %}Names: (not set){% endif %}
{% if draft and draft.description_ids and draft.description_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.rubric.get.resources.descriptions if item.id|string in draft.description_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Descriptions: {% for item in selected %}{{ item.description[:100] }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Descriptions: ({{ draft.description_ids|length }} selected by ID){% endif %}{% else %}Descriptions: (not set){% endif %}
{% if draft and draft.flag_ids and draft.flag_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.rubric.get.resources.flags if item.flag_option_id|string in draft.flag_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Flags: {% for item in selected %}{{ item.label or item.key }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Flags: ({{ draft.flag_ids|length }} selected by ID){% endif %}{% else %}Flags: (not set){% endif %}
{% if draft and draft.department_ids and draft.department_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.rubric.get.resources.departments if item.department_id|string in draft.department_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Departments: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Departments: ({{ draft.department_ids|length }} selected by ID){% endif %}{% else %}Departments: (not set){% endif %}
{% if draft and draft.point_ids and draft.point_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.rubric.get.resources.points if item.id|string in draft.point_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Points: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Points: ({{ draft.point_ids|length }} selected by ID){% endif %}{% else %}Points: (not set){% endif %}
{% if draft and draft.standard_group_ids and draft.standard_group_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.rubric.get.resources.standard_groups if item.id|string in draft.standard_group_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Standard Groups: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Standard Groups: ({{ draft.standard_group_ids|length }} selected by ID){% endif %}{% else %}Standard Groups: (not set){% endif %}
{% if draft and draft.standard_ids and draft.standard_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.rubric.get.resources.standards if item.id|string in draft.standard_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Standards: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Standards: ({{ draft.standard_ids|length }} selected by ID){% endif %}{% else %}Standards: (not set){% endif %}

---

{% set all_gen_types = (artifacts.rubric.get.resources.types or []) + (artifacts.rubric.get.entries.types or []) %}
## Available Resources
{% if "names" in all_gen_types and artifacts.rubric.get.resources.names and artifacts.rubric.get.resources.names|length > 0 %}
Names:
{% for item in artifacts.rubric.get.resources.names %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "descriptions" in all_gen_types and artifacts.rubric.get.resources.descriptions and artifacts.rubric.get.resources.descriptions|length > 0 %}
Descriptions:
{% for item in artifacts.rubric.get.resources.descriptions %}
- id: {{ item.id }} | {{ item.description[:100] }}{% if item.description|length > 100 %}...{% endif %}
{% endfor %}
{% endif %}
{% if "flags" in all_gen_types and artifacts.rubric.get.resources.flags and artifacts.rubric.get.resources.flags|length > 0 %}
Flags:
{% for item in artifacts.rubric.get.resources.flags %}
- id: {{ item.flag_option_id }} | {{ item.label or item.key }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}
{% if "departments" in all_gen_types and artifacts.rubric.get.resources.departments and artifacts.rubric.get.resources.departments|length > 0 %}
Departments:
{% for item in artifacts.rubric.get.resources.departments %}
- id: {{ item.department_id }} | {{ item.name }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}
{% if "points" in all_gen_types and artifacts.rubric.get.resources.points and artifacts.rubric.get.resources.points|length > 0 %}
Points:
{% for item in artifacts.rubric.get.resources.points %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "standard_groups" in all_gen_types and artifacts.rubric.get.resources.standard_groups and artifacts.rubric.get.resources.standard_groups|length > 0 %}
Standard Groups:
{% for item in artifacts.rubric.get.resources.standard_groups %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "standards" in all_gen_types and artifacts.rubric.get.resources.standards and artifacts.rubric.get.resources.standards|length > 0 %}
Standards:
{% for item in artifacts.rubric.get.resources.standards %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}

---

## Generating For
{% if artifacts.rubric.get.resources.types and artifacts.rubric.get.resources.types|length > 0 %}
Resource types (create or use): {{ artifacts.rubric.get.resources.types|join(", ") }}
{% endif %}
{% if artifacts.rubric.get.entries.types and artifacts.rubric.get.entries.types|length > 0 %}
Entry types (use only): {{ artifacts.rubric.get.entries.types|join(", ") }}
{% endif %}

Rules:
- For resource types: use_* when a suitable resource exists, create_* when nothing suitable exists
- For entry types: always use_* with IDs from available resources
- Only operate on the resource/entry types listed above
- Do not invent IDs — use IDs from available resources
', true, '2026-01-17T17:57:40.543786+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8ea0-7d0b-b711-2e26a9a6ec65', 'Rubric', '2025-12-19T19:02:10.223443+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-19T19:02:10.223443+00:00', '2025-12-19T19:02:10.223443+00:00', '019b3be4-3112-7786-ad7d-45ee39b86bc5', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019bb25e-e5f2-7f73-abf4-164c630526b2', true, '2025-12-19T19:02:10.223443+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, models_id, active, created_at, generated, mcp)
SELECT '019b3be4-3112-7786-ad7d-45ee39b86bc5', ar.model_id, true, '2025-12-19T19:02:10.223443+00:00', false, false
FROM public.agents_resource ar
WHERE ar.id = '019bb25e-e5f2-7f73-abf4-164c630526b2'
  AND ar.model_id IS NOT NULL
ON CONFLICT (agent_id, models_id) DO NOTHING;
-- agent_reasoning_levels_junction
INSERT INTO public.agent_reasoning_levels_junction (agent_id, reasoning_levels_id, active, created_at, generated, mcp)
SELECT '019b3be4-3112-7786-ad7d-45ee39b86bc5', rlr.id, true, '2025-12-19T19:02:10.223443+00:00', false, false
FROM public.agents_resource ar
JOIN public.reasoning_levels_resource rlr
  ON rlr.reasoning_level = ar.reasoning
 AND rlr.active = true
WHERE ar.id = '019bb25e-e5f2-7f73-abf4-164c630526b2'
  AND ar.reasoning IS NOT NULL
ON CONFLICT (agent_id, reasoning_levels_id) DO NOTHING;
-- agent_temperature_levels_junction
INSERT INTO public.agent_temperature_levels_junction (agent_id, temperature_levels_id, active, created_at, generated, mcp)
SELECT '019b3be4-3112-7786-ad7d-45ee39b86bc5', tlr.id, true, '2025-12-19T19:02:10.223443+00:00', false, false
FROM public.agents_resource ar
JOIN public.temperature_levels_resource tlr
  ON tlr.temperature = ar.temperature
 AND tlr.active = true
WHERE ar.id = '019bb25e-e5f2-7f73-abf4-164c630526b2'
  AND ar.temperature IS NOT NULL
ON CONFLICT (agent_id, temperature_levels_id) DO NOTHING;
-- agent_voices_junction
INSERT INTO public.agent_voices_junction (agent_id, voices_id, active, created_at, generated, mcp)

SELECT DISTINCT '019b3be4-3112-7786-ad7d-45ee39b86bc5'::uuid, vr.id, true, '2025-12-19T19:02:10.223443+00:00'::timestamptz, false, false
FROM public.agents_resource ar
JOIN unnest(COALESCE(ar.voices, ARRAY[]::text[])) AS v(voice) ON true
JOIN public.voices_resource vr
  ON vr.voice = v.voice
 AND vr.active = true
WHERE ar.id = '019bb25e-e5f2-7f73-abf4-164c630526b2'
ON CONFLICT (agent_id, voices_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, descriptions_id, created_at, generated, mcp, active) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019b995c-8ea1-7cb0-9364-428e72031db8', '2025-12-19T19:02:10.223443+00:00', false, false, true) ON CONFLICT (agent_id, descriptions_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flags_id, created_at, generated, mcp, active) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', '2025-12-19T19:02:10.223443+00:00', false, false, true) ON CONFLICT (agent_id, flags_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, names_id, created_at, generated, mcp, active) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019b995c-8ea0-7d0b-b711-2e26a9a6ec65', '2025-12-19T19:02:10.223443+00:00', false, false, true) ON CONFLICT (agent_id, names_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019bebc4-d436-7bc3-aadf-8fb01ebadfdb', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019bebc4-d436-7c48-bbb0-2700d1deb830', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019c06a8-2af4-7c97-ab30-1e863db0e8e3', true, '2026-02-10T19:14:16.391398+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019c06a8-2af5-705d-ae92-7905a846a500', true, '2026-02-10T19:14:16.391398+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019c06a8-2af5-766c-9713-315ab9567235', true, '2026-02-10T19:14:16.391398+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019c06a8-2af6-727b-b94a-71bddc4d76de', true, '2026-02-10T19:14:16.391398+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '3ac11084-85a1-4f04-9dba-5e514d9afc00', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019c4f61-51e9-775a-8905-76dda83cfb77', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '6dd11e8a-c1b0-4ebf-a5f6-9e8f16c00175', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', 'd0e82950-8f92-46b9-90d6-0fdbeaebc9bb', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', 'e234b7b3-fd49-4179-9a96-ea5c355bf919', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
