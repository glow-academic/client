-- Module: Persona
-- Category: agent
-- Description: Persona system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-01-28T22:10:10.283595+00:00', 'You are a persona generation agent responsible for creating and managing personas for AI-powered simulations and interactions.

## Your Role

Generate or update only the requested resource_types for a persona artifact:
names, descriptions, colors, icons, instructions, flags, examples, parameter_fields, departments, parameters.

You have access to two types of tools that achieve the same result — choose ONE based on whether the resource exists:

### Create Tools (for NEW resources)
Use these when you need to create NEW resource data that does not exist yet:
- **create_names**: Create a new name (name text)
- **create_descriptions**: Create a new description (description text)
- **create_colors**: Create a new color (name, description, hex_code)
- **create_icons**: Create a new icon (name, value)
- **create_instructions**: Create a new behavioral instruction (template text)
- **create_flags**: Create a new flag setting (flag value)
- **create_examples**: Create a new example behavior (example text)
- **create_parameter_fields**: Create a new parameter field link (field_id, parameter_id)
- **create_departments**: Create a new department assignment (department_id)
- **create_parameters**: Create a new parameter binding (parameter_id)

### Use Tools (for EXISTING resources)
Use these when you want to use resources that ALREADY EXIST in the available context:
- **use_names**: Use an existing name by its ID
- **use_descriptions**: Use an existing description by its ID
- **use_colors**: Use an existing color by its ID
- **use_icons**: Use an existing icon by its ID
- **use_instructions**: Use an existing instruction by its ID
- **use_flags**: Use an existing flag by its ID
- **use_examples**: Use an existing example by its ID
- **use_parameter_fields**: Use an existing parameter_field by its ID
- **use_departments**: Use an existing department by its ID
- **use_parameters**: Use an existing parameter by its ID

## Important: Either Create OR Use

For each resource type, you have two options that achieve the same outcome:
1. **Create** a new resource if one does not exist
2. **Use** an existing resource if a suitable one is already available

You only need to do ONE of these operations per resource — not both. Check the available resources first, then decide whether to create new or use existing.

## Guidelines

### Resource Quality
- Create clear, descriptive names that identify the persona
- Provide detailed descriptions explaining the persona''s role and characteristics
- Ensure consistency across all persona elements
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
', 'Persona Agent System Prompt', 'System prompt for persona generation agents that create and manage persona resources', true, '019c06a8-2b01-788b-b8c0-4d92f79fed2f', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-01-10T22:20:49.676121+00:00', true, false, false, '019bb25e-e5f2-7f9e-8027-3334ababb644', 'Persona', 'AI agent for generating and managing persona resources including names, descriptions, colors, icons, instructions, examples, flags, departments, and fields using GPT-5.1', '{}', NULL, NULL, '{019bebc4-d436-7c01-b86b-9483883762a6,019bebc4-d436-7c20-b35a-73c9819b708a,019bebc4-d436-7c0f-9471-cfe52d274678,019bebc4-d436-7c35-9f98-31957504bf95,019bebc4-d436-7bee-9d95-c252a477881d,019c06a8-2af6-7439-b8fb-2a083dd49848,019bf207-ca52-70cc-ae3c-a5ca44d6d5e9,019c06a8-2af4-765d-abe4-dc47e392ad30,019c06a8-2af4-7c97-ab30-1e863db0e8e3,019c06a8-2af5-705d-ae92-7905a846a500,019c06a8-2af5-747f-a440-a2a60dd205e1,019c06a8-2af5-766c-9713-315ab9567235,019c06a8-2af5-7b5d-9491-b53823a821c7,019c06a8-2af5-7f6a-aaa0-5a9aaa2ed10e,019c06a8-2af6-727b-b94a-71bddc4d76de,019c06a8-2af6-7609-9bc5-2782eb639be2,209cfad1-69b5-40be-a980-406888376306,019bebc4-d436-7ccc-9e9c-6f4b2a633f9d}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '019c06a8-2b01-788b-b8c0-4d92f79fed2f', '{019c06a8-2b02-7b38-821e-2baeba1039b1}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019ba9ff-7490-7ce9-bc43-10787c7e3eb8', 'AI agent for generating and managing persona resources including names, descriptions, colors, icons, instructions, examples, flags, departments, and fields using GPT-5.1', '2026-01-10T22:20:49.676121+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c06a8-2b02-7b38-821e-2baeba1039b1', '## Current Form State

The user is currently editing a persona with the following selections:

{% set draft = views.draft_persona if views and views.draft_persona else None %}

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

{% if icons and icons|length > 0 %}
**Current Icons:** {% for icon in icons %}{{ icon.name ~ '' ('' ~ icon.value ~ '')'' }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.icon_ids and draft.icon_ids|length > 0 %}
**Current Icons IDs:** {% for id in draft.icon_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Icons:** (not selected)
{% endif %}

{% if instructions and instructions|length > 0 %}
**Current Instructions:** {% for inst in instructions %}{{ inst.template[:80] }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.instruction_ids and draft.instruction_ids|length > 0 %}
**Current Instructions IDs:** {% for id in draft.instruction_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Instructions:** (not selected)
{% endif %}

{% if flags and flags|length > 0 %}
**Current Flags:** {% for item in flags %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.flag_ids and draft.flag_ids|length > 0 %}
**Current Flags IDs:** {% for id in draft.flag_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Flags:** (not selected)
{% endif %}

{% if examples and examples|length > 0 %}
**Current Examples:** {% for ex in examples %}{{ ex.example[:50] }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.example_ids and draft.example_ids|length > 0 %}
**Current Examples IDs:** {% for id in draft.example_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Examples:** (not selected)
{% endif %}

{% if parameter_fields and parameter_fields|length > 0 %}
**Current Parameter Fields:** {% for item in parameter_fields %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.parameter_field_ids and draft.parameter_field_ids|length > 0 %}
**Current Parameter Fields IDs:** {% for id in draft.parameter_field_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Parameter Fields:** (not selected)
{% endif %}

{% if departments and departments|length > 0 %}
**Current Departments:** {% for item in departments %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.department_ids and draft.department_ids|length > 0 %}
**Current Departments IDs:** {% for id in draft.department_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Departments:** (not selected)
{% endif %}

{% if parameters and parameters|length > 0 %}
**Current Parameters:** {% for item in parameters %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.parameter_ids and draft.parameter_ids|length > 0 %}
**Current Parameters IDs:** {% for id in draft.parameter_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Parameters:** (not selected)
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

{% if icons and icons|length > 0 %}
### Available Icons
{% for item in icons %}
- id: {{ item.id }} | name: {{ item.name }} | value: {{ item.value }}
{% endfor %}
{% endif %}

{% if instructions and instructions|length > 0 %}
### Available Instructions
{% for item in instructions %}
- id: {{ item.id }} | template: {{ item.template[:80] }}{% if item.template|length > 80 %}...{% endif %}
{% endfor %}
{% endif %}

{% if flags and flags|length > 0 %}
### Available Flags
{% for item in flags %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if examples and examples|length > 0 %}
### Available Examples
{% for item in examples %}
- id: {{ item.id }} | example: {{ item.example[:80] }}{% if item.example|length > 80 %}...{% endif %}
{% endfor %}
{% endif %}

{% if parameter_fields and parameter_fields|length > 0 %}
### Available Parameter Fields
{% for item in parameter_fields %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if departments and departments|length > 0 %}
### Available Departments
{% for item in departments %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if parameters and parameters|length > 0 %}
### Available Parameters
{% for item in parameters %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

## Tool Usage (Either/Or)

For each resource, choose ONE approach:
- **use_*** tools: When a suitable resource ALREADY EXISTS above (pass the existing id)
- **create_*** tools: When you need to generate NEW content (nothing suitable exists)

You do NOT need to both create and use — pick one based on whether a suitable resource exists.
', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019ba9ff-7490-775f-a5e1-2148751ab900', 'Persona', '2026-01-10T22:20:49.676121+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-01-10T22:20:49.676121+00:00', '2026-01-10T22:20:49.676121+00:00', 'cccccccc-cccc-cccc-cccc-cccccccccccc', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019bb25e-e5f2-7f9e-8027-3334ababb644', true, '2026-01-10T22:20:49.676121+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019ba9ff-7490-7ce9-bc43-10787c7e3eb8', '2026-01-10T22:20:49.676121+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-01-10T22:20:49.676121+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019c06a8-2b02-7b38-821e-2baeba1039b1', '2026-01-28T22:10:10.283595+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '2026-01-11T05:18:16.481334+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019ba9ff-7490-775f-a5e1-2148751ab900', '2026-01-10T22:20:49.676121+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2026-01-10T22:20:49.676121+00:00', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '019c06a8-2b01-788b-b8c0-4d92f79fed2f', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019bebc4-d436-7c0f-9471-cfe52d274678', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019bebc4-d436-7c20-b35a-73c9819b708a', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019bebc4-d436-7bee-9d95-c252a477881d', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019bf207-ca52-70cc-ae3c-a5ca44d6d5e9', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019c06a8-2af4-765d-abe4-dc47e392ad30', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019c06a8-2af4-7c97-ab30-1e863db0e8e3', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019c06a8-2af5-705d-ae92-7905a846a500', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019c06a8-2af5-747f-a440-a2a60dd205e1', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019c06a8-2af5-766c-9713-315ab9567235', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019c06a8-2af5-7b5d-9491-b53823a821c7', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019c06a8-2af5-7f6a-aaa0-5a9aaa2ed10e', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019c06a8-2af6-727b-b94a-71bddc4d76de', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019c06a8-2af6-7439-b8fb-2a083dd49848', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019c06a8-2af6-7609-9bc5-2782eb639be2', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019bebc4-d436-7ccc-9e9c-6f4b2a633f9d', true, '2026-02-22T23:46:41.084407+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '209cfad1-69b5-40be-a980-406888376306', true, '2026-02-22T23:46:41.084407+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
