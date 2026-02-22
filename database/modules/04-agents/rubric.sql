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
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2025-12-19T19:02:10.223443+00:00', true, false, false, '019bb25e-e5f2-7f73-abf4-164c630526b2', 'Rubric', 'Agent for generating rubric descriptions and grid cell content', '{}', NULL, NULL, '{019bebc4-d436-7c01-b86b-9483883762a6,019bebc4-d436-7c48-bbb0-2700d1deb830,019bebc4-d436-7c35-9f98-31957504bf95,019bebc4-d436-7bc3-aadf-8fb01ebadfdb,019c06a8-2af5-766c-9713-315ab9567235,019c06a8-2af4-7c97-ab30-1e863db0e8e3,019c06a8-2af6-727b-b94a-71bddc4d76de,019c06a8-2af5-705d-ae92-7905a846a500,019c4f61-51e9-775a-8905-76dda83cfb77,6dd11e8a-c1b0-4ebf-a5f6-9e8f16c00175,d0e82950-8f92-46b9-90d6-0fdbeaebc9bb,e234b7b3-fd49-4179-9a96-ea5c355bf919,3ac11084-85a1-4f04-9dba-5e514d9afc00}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '019b3be4-36fe-7e8e-bdfd-05e834f7834d', '{019bcd1b-0c44-7d26-927b-8b7a081ffac3}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8ea1-7cb0-9364-428e72031db8', 'Agent for generating rubric descriptions and grid cell content', '2025-12-19T19:02:10.223443+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019bcd1b-0c44-7d26-927b-8b7a081ffac3', '## Current Form State

The user is currently editing a rubric with the following selections:

{% set draft = views.draft_rubric if views and views.draft_rubric else None %}

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

{% if points and points|length > 0 %}
**Current Points:** {% for item in points %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.point_ids and draft.point_ids|length > 0 %}
**Current Points IDs:** {% for id in draft.point_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Points:** (not selected)
{% endif %}

{% if standard_groups and standard_groups|length > 0 %}
**Current Standard Groups:** {% for item in standard_groups %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.standard_group_ids and draft.standard_group_ids|length > 0 %}
**Current Standard Groups IDs:** {% for id in draft.standard_group_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Standard Groups:** (not selected)
{% endif %}

{% if standards and standards|length > 0 %}
**Current Standards:** {% for item in standards %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.standard_ids and draft.standard_ids|length > 0 %}
**Current Standards IDs:** {% for id in draft.standard_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Standards:** (not selected)
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

{% if points and points|length > 0 %}
### Available Points
{% for item in points %}
- id: {{ item.id }} | value: {{ item.value }}
{% endfor %}
{% endif %}

{% if standard_groups and standard_groups|length > 0 %}
### Available Standard Groups
{% for item in standard_groups %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if standards and standards|length > 0 %}
### Available Standards
{% for item in standards %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

## Tool Usage (Either/Or)

For each resource, choose ONE approach:
- **use_*** tools: When a suitable resource ALREADY EXISTS above (pass the existing id)
- **create_*** tools: When you need to generate NEW content (nothing suitable exists)

You do NOT need to both create and use — pick one based on whether a suitable resource exists.
', true, '2026-01-17T17:57:40.543786+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8ea0-7d0b-b711-2e26a9a6ec65', 'Rubric', '2025-12-19T19:02:10.223443+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-19T19:02:10.223443+00:00', '2025-12-19T19:02:10.223443+00:00', '019b3be4-3112-7786-ad7d-45ee39b86bc5', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019bb25e-e5f2-7f73-abf4-164c630526b2', true, '2025-12-19T19:02:10.223443+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019b995c-8ea1-7cb0-9364-428e72031db8', '2025-12-19T19:02:10.223443+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2025-12-19T19:02:10.223443+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019bcd1b-0c44-7d26-927b-8b7a081ffac3', '2026-01-17T17:57:40.543786+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '2025-12-19T19:02:10.223443+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019b995c-8ea0-7d0b-b711-2e26a9a6ec65', '2025-12-19T19:02:10.223443+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2025-12-19T19:02:10.223443+00:00', '019b3be4-3112-7786-ad7d-45ee39b86bc5', '019b3be4-36fe-7e8e-bdfd-05e834f7834d', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019bebc4-d436-7bc3-aadf-8fb01ebadfdb', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019bebc4-d436-7c48-bbb0-2700d1deb830', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019c06a8-2af4-7c97-ab30-1e863db0e8e3', true, '2026-02-10T19:14:16.391398+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019c06a8-2af5-705d-ae92-7905a846a500', true, '2026-02-10T19:14:16.391398+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019c06a8-2af5-766c-9713-315ab9567235', true, '2026-02-10T19:14:16.391398+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019c06a8-2af6-727b-b94a-71bddc4d76de', true, '2026-02-10T19:14:16.391398+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '3ac11084-85a1-4f04-9dba-5e514d9afc00', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019c4f61-51e9-775a-8905-76dda83cfb77', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '6dd11e8a-c1b0-4ebf-a5f6-9e8f16c00175', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', 'd0e82950-8f92-46b9-90d6-0fdbeaebc9bb', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', 'e234b7b3-fd49-4179-9a96-ea5c355bf919', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
