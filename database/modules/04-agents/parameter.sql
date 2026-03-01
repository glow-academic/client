-- Module: Parameter
-- Category: agent
-- Description: Parameter system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-01-17T17:57:40.566652+00:00', 'You are a parameter generation agent responsible for creating and managing parameters with associated fields for dynamic configuration.

## Your Role

Generate or update only the requested resource_types for a parameter artifact:
names, descriptions, flags, departments, fields.

You have access to two types of tools that achieve the same result — choose ONE based on whether the resource exists:

### Create Tools (for NEW resources)
Use these when you need to create NEW resource data that does not exist yet:
- **create_names**: Create a new name (name text)
- **create_descriptions**: Create a new description (description text)
- **create_flags**: Create a new flag setting (flag value)
- **create_departments**: Create a new department assignment (department_id)
- **create_fields**: Create a new field binding (field_id)

### Use Tools (for EXISTING resources)
Use these when you want to use resources that ALREADY EXIST in the available context:
- **use_names**: Use an existing name by its ID
- **use_descriptions**: Use an existing description by its ID
- **use_flags**: Use an existing flag by its ID
- **use_departments**: Use an existing department by its ID
- **use_fields**: Use an existing field by its ID

## Important: Either Create OR Use

For each resource type, you have two options that achieve the same outcome:
1. **Create** a new resource if one does not exist
2. **Use** an existing resource if a suitable one is already available

You only need to do ONE of these operations per resource — not both. Check the available resources first, then decide whether to create new or use existing.

## Guidelines

### Resource Quality
- Create clear, descriptive names that identify the parameter
- Provide detailed descriptions explaining the parameter''s role and characteristics
- Ensure consistency across all parameter elements
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
', 'Parameter Agent System Prompt', 'System prompt for parameter generation agents that create and manage parameter resources', true, '11111111-2222-2222-2222-111111111111', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-13T03:41:54.664757+00:00', true, false, false, '019c5517-4673-74b4-991e-153c7b8a9174', 'Parameter', 'AI agent for generating and managing parameter resources including names, descriptions, flags, departments, and fields using GPT-5.1', '{}', NULL, NULL, '{019bebc4-d436-7c35-9f98-31957504bf95,019bebc4-d436-7b73-a506-0b196bce4ada,019bebc4-d436-7c01-b86b-9483883762a6,019c4f27-1778-7a54-b3bb-1574ff2c0357,019c06a8-2af5-766c-9713-315ab9567235,98194c0a-97af-4bf8-8c30-12a87bfbacb2,019c06a8-2af6-727b-b94a-71bddc4d76de,019c06a8-2af4-7c97-ab30-1e863db0e8e3,019c06a8-2af5-705d-ae92-7905a846a500}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '11111111-2222-2222-2222-111111111111', '{019c2f13-4100-7c00-8000-000000000001}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bcd1b-0c8b-789b-8866-7761d9eb1159', 'AI agent for generating and managing parameter resources including names, descriptions, flags, departments, and fields using GPT-5.1', '2026-01-17T17:57:40.566652+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c2f13-4100-7c00-8000-000000000001', '## Current State
{% set draft = artifacts.parameter.get.entries.draft_parameter if artifacts.parameter.get.entries and artifacts.parameter.get.entries.draft_parameter else None %}
{% if draft and draft.name_ids and draft.name_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.parameter.get.resources.names if item.id|string in draft.name_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Names: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Names: ({{ draft.name_ids|length }} selected by ID){% endif %}{% else %}Names: (not set){% endif %}
{% if draft and draft.description_ids and draft.description_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.parameter.get.resources.descriptions if item.id|string in draft.description_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Descriptions: {% for item in selected %}{{ item.description[:100] }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Descriptions: ({{ draft.description_ids|length }} selected by ID){% endif %}{% else %}Descriptions: (not set){% endif %}
{% if draft and draft.flag_ids and draft.flag_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.parameter.get.resources.flags if item.flag_option_id|string in draft.flag_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Flags: {% for item in selected %}{{ item.label or item.key }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Flags: ({{ draft.flag_ids|length }} selected by ID){% endif %}{% else %}Flags: (not set){% endif %}
{% if draft and draft.department_ids and draft.department_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.parameter.get.resources.departments if item.department_id|string in draft.department_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Departments: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Departments: ({{ draft.department_ids|length }} selected by ID){% endif %}{% else %}Departments: (not set){% endif %}
{% if draft and draft.field_ids and draft.field_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.parameter.get.resources.fields if item.field_id|string in draft.field_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Fields: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Fields: ({{ draft.field_ids|length }} selected by ID){% endif %}{% else %}Fields: (not set){% endif %}

---

{% set all_gen_types = (artifacts.parameter.get.resources.types or []) + (artifacts.parameter.get.entries.types or []) %}
## Available Resources
{% if "names" in all_gen_types and artifacts.parameter.get.resources.names and artifacts.parameter.get.resources.names|length > 0 %}
Names:
{% for item in artifacts.parameter.get.resources.names %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "descriptions" in all_gen_types and artifacts.parameter.get.resources.descriptions and artifacts.parameter.get.resources.descriptions|length > 0 %}
Descriptions:
{% for item in artifacts.parameter.get.resources.descriptions %}
- id: {{ item.id }} | {{ item.description[:100] }}{% if item.description|length > 100 %}...{% endif %}
{% endfor %}
{% endif %}
{% if "flags" in all_gen_types and artifacts.parameter.get.resources.flags and artifacts.parameter.get.resources.flags|length > 0 %}
Flags:
{% for item in artifacts.parameter.get.resources.flags %}
- id: {{ item.flag_option_id }} | {{ item.label or item.key }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}
{% if "departments" in all_gen_types and artifacts.parameter.get.resources.departments and artifacts.parameter.get.resources.departments|length > 0 %}
Departments:
{% for item in artifacts.parameter.get.resources.departments %}
- id: {{ item.department_id }} | {{ item.name }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}
{% if "fields" in all_gen_types and artifacts.parameter.get.resources.fields and artifacts.parameter.get.resources.fields|length > 0 %}
Fields:
{% for item in artifacts.parameter.get.resources.fields %}
- id: {{ item.field_id }} | {{ item.name }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

---

## Generating For
{% if artifacts.parameter.get.resources.types and artifacts.parameter.get.resources.types|length > 0 %}
Resource types (create or use): {{ artifacts.parameter.get.resources.types|join(", ") }}
{% endif %}
{% if artifacts.parameter.get.entries.types and artifacts.parameter.get.entries.types|length > 0 %}
Entry types (use only): {{ artifacts.parameter.get.entries.types|join(", ") }}
{% endif %}

Rules:
- For resource types: use_* when a suitable resource exists, create_* when nothing suitable exists
- For entry types: always use_* with IDs from available resources
- Only operate on the resource/entry types listed above
- Do not invent IDs — use IDs from available resources
', true, '2026-02-10T19:12:00.055832+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bb563-1b25-7c30-952d-188a1018298d', 'Parameter', '2026-01-13T03:25:29.760160+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-01-17T17:57:40.566652+00:00', '2026-01-17T17:57:40.566652+00:00', '11111111-1111-1111-1111-111111111111', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('11111111-1111-1111-1111-111111111111', '019c5517-4673-74b4-991e-153c7b8a9174', true, '2026-02-13T03:41:54.664757+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('11111111-1111-1111-1111-111111111111', '019bcd1b-0c8b-789b-8866-7761d9eb1159', '2026-01-17T17:57:40.566652+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('11111111-1111-1111-1111-111111111111', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-01-17T17:57:40.566652+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- config_resource (from agent_models_junction)
INSERT INTO public.config_resource (id, model_id, prompt_id, instruction_ids, created_at, generated, mcp, active) VALUES ('cbb52bd5-cdc1-520c-9850-dc908677b1e0', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '11111111-2222-2222-2222-111111111111', ARRAY['019c2f13-4100-7c00-8000-000000000001'::uuid], '2026-01-17T17:57:40.566652+00:00', false, false, true) ON CONFLICT (id) DO NOTHING;
-- agent_configs_junction
INSERT INTO public.agent_configs_junction (agent_id, config_id, created_at, generated, mcp, active) VALUES ('11111111-1111-1111-1111-111111111111', 'cbb52bd5-cdc1-520c-9850-dc908677b1e0', '2026-01-17T17:57:40.566652+00:00', false, false, true) ON CONFLICT (agent_id, config_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('11111111-1111-1111-1111-111111111111', '019bb563-1b25-7c30-952d-188a1018298d', '2026-01-17T17:57:40.566652+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('11111111-1111-1111-1111-111111111111', '019bebc4-d436-7b73-a506-0b196bce4ada', true, '2026-01-17T17:57:40.566652+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('11111111-1111-1111-1111-111111111111', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-01-17T17:57:40.566652+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('11111111-1111-1111-1111-111111111111', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-01-17T17:57:40.566652+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('11111111-1111-1111-1111-111111111111', '98194c0a-97af-4bf8-8c30-12a87bfbacb2', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('11111111-1111-1111-1111-111111111111', '019c06a8-2af4-7c97-ab30-1e863db0e8e3', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('11111111-1111-1111-1111-111111111111', '019c06a8-2af5-705d-ae92-7905a846a500', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('11111111-1111-1111-1111-111111111111', '019c4f27-1778-7a54-b3bb-1574ff2c0357', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('11111111-1111-1111-1111-111111111111', '019c06a8-2af5-766c-9713-315ab9567235', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('11111111-1111-1111-1111-111111111111', '019c06a8-2af6-727b-b94a-71bddc4d76de', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
