-- Module: Field
-- Category: agent
-- Description: Field system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-02-22T00:20:46.593734+00:00', 'You are a field generation agent responsible for creating and managing fields with conditional parameter logic for dynamic forms.

## Your Role

Generate or update only the requested resource_types for a field artifact:
names, descriptions, flags, departments, conditional_parameters.

You have access to two types of tools that achieve the same result — choose ONE based on whether the resource exists:

### Create Tools (for NEW resources)
Use these when you need to create NEW resource data that does not exist yet:
- **create_names**: Create a new name (name text)
- **create_descriptions**: Create a new description (description text)
- **create_flags**: Create a new flag setting (flag value)
- **create_departments**: Create a new department assignment (department_id)
- **create_conditional_parameters**: Create a new conditional parameter rule (parameter_id, condition)

### Use Tools (for EXISTING resources)
Use these when you want to use resources that ALREADY EXIST in the available context:
- **use_names**: Use an existing name by its ID
- **use_descriptions**: Use an existing description by its ID
- **use_flags**: Use an existing flag by its ID
- **use_departments**: Use an existing department by its ID
- **use_conditional_parameters**: Use an existing conditional_parameter by its ID

## Important: Either Create OR Use

For each resource type, you have two options that achieve the same outcome:
1. **Create** a new resource if one does not exist
2. **Use** an existing resource if a suitable one is already available

You only need to do ONE of these operations per resource — not both. Check the available resources first, then decide whether to create new or use existing.

## Guidelines

### Resource Quality
- Create clear, descriptive names that identify the field
- Provide detailed descriptions explaining the field''s role and characteristics
- Ensure consistency across all field elements
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
', 'Field Prompt', 'AI agent for creating and managing fields with conditional parameter logic for dynamic forms', true, '019c82b8-5d96-7890-a4cc-597534f2cf5b', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-22T00:20:46.593734+00:00', true, false, false, '019c82b8-5d96-7acb-8649-4d4227ae7815', 'Field', 'AI agent for generating and managing field resources including names, descriptions, flags, departments, and conditional parameters using GPT-5.1', '{}', NULL, NULL, '{019c06a8-2af6-727b-b94a-71bddc4d76de,019bebc4-d436-7c01-b86b-9483883762a6,019c06a8-2af5-705d-ae92-7905a846a500,019c06a8-2af5-766c-9713-315ab9567235,019c06a8-2af4-7c97-ab30-1e863db0e8e3,f3aeb0a8-1ca0-4dc7-9f8d-61b4f8537d43,a52e42b8-ecdc-4836-861a-e82007220ec5,019bebc4-d436-7c35-9f98-31957504bf95}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '019c82b8-5d96-7890-a4cc-597534f2cf5b', '{019c82b8-5d96-79a4-9631-96e8d23d6761}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bcd1c-3348-728b-aa5b-4687e69e40e9', 'AI agent for generating and managing field resources including names, descriptions, flags, departments, and conditional parameters using GPT-5.1', '2026-01-17T17:58:56.069266+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c82b8-5d96-79a4-9631-96e8d23d6761', '## Current State
{% set draft = entries.draft_field if entries and entries.draft_field else None %}
{% if draft and draft.name_ids and draft.name_ids|length > 0 %}{% set selected = [] %}{% for item in resources.names if item.id|string in draft.name_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Names: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Names: ({{ draft.name_ids|length }} selected by ID){% endif %}{% else %}Names: (not set){% endif %}
{% if draft and draft.description_ids and draft.description_ids|length > 0 %}{% set selected = [] %}{% for item in resources.descriptions if item.id|string in draft.description_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Descriptions: {% for item in selected %}{{ item.description[:100] }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Descriptions: ({{ draft.description_ids|length }} selected by ID){% endif %}{% else %}Descriptions: (not set){% endif %}
{% if draft and draft.flag_ids and draft.flag_ids|length > 0 %}{% set selected = [] %}{% for item in resources.flags if item.flag_option_id|string in draft.flag_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Flags: {% for item in selected %}{{ item.label or item.key }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Flags: ({{ draft.flag_ids|length }} selected by ID){% endif %}{% else %}Flags: (not set){% endif %}
{% if draft and draft.department_ids and draft.department_ids|length > 0 %}{% set selected = [] %}{% for item in resources.departments if item.department_id|string in draft.department_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Departments: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Departments: ({{ draft.department_ids|length }} selected by ID){% endif %}{% else %}Departments: (not set){% endif %}
{% if draft and draft.conditional_parameter_ids and draft.conditional_parameter_ids|length > 0 %}{% set selected = [] %}{% for item in resources.conditional_parameters if item.id|string in draft.conditional_parameter_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Conditional Parameters: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Conditional Parameters: ({{ draft.conditional_parameter_ids|length }} selected by ID){% endif %}{% else %}Conditional Parameters: (not set){% endif %}

---

{% set all_gen_types = (resources.types or []) + (entries.types or []) %}
## Available Resources
{% if "names" in all_gen_types and resources.names and resources.names|length > 0 %}
Names:
{% for item in resources.names %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "descriptions" in all_gen_types and resources.descriptions and resources.descriptions|length > 0 %}
Descriptions:
{% for item in resources.descriptions %}
- id: {{ item.id }} | {{ item.description[:100] }}{% if item.description|length > 100 %}...{% endif %}
{% endfor %}
{% endif %}
{% if "flags" in all_gen_types and resources.flags and resources.flags|length > 0 %}
Flags:
{% for item in resources.flags %}
- id: {{ item.flag_option_id }} | {{ item.label or item.key }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}
{% if "departments" in all_gen_types and resources.departments and resources.departments|length > 0 %}
Departments:
{% for item in resources.departments %}
- id: {{ item.department_id }} | {{ item.name }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}
{% if "conditional_parameters" in all_gen_types and resources.conditional_parameters and resources.conditional_parameters|length > 0 %}
Conditional Parameters:
{% for item in resources.conditional_parameters %}
- id: {{ item.id }} | {{ item.name }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

---

## Generating For
{% if resources.types and resources.types|length > 0 %}
Resource types (create or use): {{ resources.types|join(", ") }}
{% endif %}
{% if entries.types and entries.types|length > 0 %}
Entry types (use only): {{ entries.types|join(", ") }}
{% endif %}

Rules:
- For resource types: use_* when a suitable resource exists, create_* when nothing suitable exists
- For entry types: always use_* with IDs from available resources
- Only operate on the resource/entry types listed above
- Do not invent IDs — use IDs from available resources
', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bcd1c-3348-701e-b254-b80e6423ffab', 'Field', '2026-01-17T17:58:56.069266+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-01-17T17:58:56.069266+00:00', '2026-01-17T17:58:56.069266+00:00', 'ffffffff-ffff-ffff-ffff-ffffffffffff', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019c82b8-5d96-7acb-8649-4d4227ae7815', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019bcd1c-3348-728b-aa5b-4687e69e40e9', '2026-01-17T17:58:56.069266+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-01-17T17:58:56.069266+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019c82b8-5d96-79a4-9631-96e8d23d6761', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '2026-01-17T17:58:56.069266+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019bcd1c-3348-701e-b254-b80e6423ffab', '2026-01-17T17:58:56.069266+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2026-02-22T00:20:46.593734+00:00', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '019c82b8-5d96-7890-a4cc-597534f2cf5b', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019c06a8-2af6-727b-b94a-71bddc4d76de', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019c06a8-2af5-705d-ae92-7905a846a500', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019c06a8-2af5-766c-9713-315ab9567235', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', '019c06a8-2af4-7c97-ab30-1e863db0e8e3', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'f3aeb0a8-1ca0-4dc7-9f8d-61b4f8537d43', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'a52e42b8-ecdc-4836-861a-e82007220ec5', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
