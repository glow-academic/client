-- Module: Persona
-- Category: agent
-- Description: Persona system agent
-- ============================================================


-- Resource rows
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-01-10T22:20:49.676121+00:00', true, false, false, '019bb25e-e5f2-7f9e-8027-3334ababb644', 'Persona', 'AI agent for generating and managing persona resources including names, descriptions, colors, icons, instructions, examples, flags, departments, and fields using GPT-5.1', '{}', NULL, NULL, '{019bebc4-d436-7c35-9f98-31957504bf95,019bebc4-d436-7c20-b35a-73c9819b708a,019bebc4-d436-7bee-9d95-c252a477881d,019bebc4-d436-7c0f-9471-cfe52d274678,019bebc4-d436-7c01-b86b-9483883762a6,019c06a8-2af5-766c-9713-315ab9567235,019c06a8-2af5-747f-a440-a2a60dd205e1,019c06a8-2af5-705d-ae92-7905a846a500,019c06a8-2af6-7609-9bc5-2782eb639be2,019c06a8-2af4-765d-abe4-dc47e392ad30,019bf207-ca52-70cc-ae3c-a5ca44d6d5e9,019c06a8-2af4-7c97-ab30-1e863db0e8e3,019c06a8-2af6-7439-b8fb-2a083dd49848,019c06a8-2af6-727b-b94a-71bddc4d76de,019c06a8-2af5-7f6a-aaa0-5a9aaa2ed10e,019c06a8-2af5-7b5d-9491-b53823a821c7}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '019c06a8-2b01-788b-b8c0-4d92f79fed2f', '{019c06a8-2b02-7b38-821e-2baeba1039b1}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019ba9ff-7490-7ce9-bc43-10787c7e3eb8', 'AI agent for generating and managing persona resources including names, descriptions, colors, icons, instructions, examples, flags, departments, and fields using GPT-5.1', '2026-01-10T22:20:49.676121+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c06a8-2b02-7b38-821e-2baeba1039b1', '## Current Form State

The user is currently editing a persona with the following selections:

{% set draft = views.draft_persona if views and views.draft_persona else None %}

{% if names and names|length > 0 %}
**Current Name:** {% for name in names %}{{ name.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.name_ids and draft.name_ids|length > 0 %}
**Current Name IDs:** {% for id in draft.name_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Name:** (not selected)
{% endif %}

{% if descriptions and descriptions|length > 0 %}
**Current Description:** {% for desc in descriptions %}{{ desc.description[:100] }}{% if desc.description|length > 100 %}...{% endif %}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.description_ids and draft.description_ids|length > 0 %}
**Current Description IDs:** {% for id in draft.description_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Description:** (not selected)
{% endif %}

{% if colors and colors|length > 0 %}
**Current Color:** {% for color in colors %}{{ color.name }} ({{ color.hex_code }}){% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.color_ids and draft.color_ids|length > 0 %}
**Current Color IDs:** {% for id in draft.color_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Color:** (not selected)
{% endif %}

{% if icons and icons|length > 0 %}
**Current Icon:** {% for icon in icons %}{{ icon.name }} ({{ icon.value }}){% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.icon_ids and draft.icon_ids|length > 0 %}
**Current Icon IDs:** {% for id in draft.icon_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Icon:** (not selected)
{% endif %}

{% if instructions and instructions|length > 0 %}
**Current Instructions:** {% for inst in instructions %}{{ inst.template[:80] }}{% if inst.template|length > 80 %}...{% endif %}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.instruction_ids and draft.instruction_ids|length > 0 %}
**Current Instruction IDs:** {% for id in draft.instruction_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Instructions:** (not selected)
{% endif %}

{% if departments and departments|length > 0 %}
**Current Departments:** {% for dept in departments %}{{ dept.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.department_ids and draft.department_ids|length > 0 %}
**Current Department IDs:** {% for id in draft.department_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Departments:** (none selected)
{% endif %}

{% if parameters and parameters|length > 0 %}
**Current Parameters:** {% for param in parameters %}{{ param.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.parameter_ids and draft.parameter_ids|length > 0 %}
**Current Parameter IDs:** {% for id in draft.parameter_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Parameters:** (none selected)
{% endif %}

{% if parameter_fields and parameter_fields|length > 0 %}
**Current Parameter Fields:** {% for pf in parameter_fields %}{{ pf.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.parameter_field_ids and draft.parameter_field_ids|length > 0 %}
**Current Parameter Field IDs:** {% for id in draft.parameter_field_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Parameter Fields:** (none selected)
{% endif %}

{% if examples and examples|length > 0 %}
**Current Examples:** {% for ex in examples %}{{ ex.example[:50] }}{% if ex.example|length > 50 %}...{% endif %}{% if not loop.last %}; {% endif %}{% endfor %}
{% elif draft and draft.example_ids and draft.example_ids|length > 0 %}
**Current Example IDs:** {% for id in draft.example_ids %}{{ id }}{% if not loop.last %}; {% endif %}{% endfor %}
{% else %}
**Current Examples:** (none selected)
{% endif %}

---

## Available Context Resources

You have access to the following existing resources. Either **use_*** an existing resource OR **create_*** a new one - you only need to do ONE.

{% if names and names|length > 0 %}
### Available Names
{% for name in names %}
- id: {{ name.id }} | name: {{ name.name }}
{% endfor %}
{% endif %}

{% if descriptions and descriptions|length > 0 %}
### Available Descriptions
{% for desc in descriptions %}
- id: {{ desc.id }} | description: {{ desc.description[:100] }}{% if desc.description|length > 100 %}...{% endif %}
{% endfor %}
{% endif %}

{% if colors and colors|length > 0 %}
### Available Colors
{% for color in colors %}
- id: {{ color.id }} | name: {{ color.name }} | hex_code: {{ color.hex_code }}
{% endfor %}
{% endif %}

{% if icons and icons|length > 0 %}
### Available Icons
{% for icon in icons %}
- id: {{ icon.id }} | name: {{ icon.name }} | value: {{ icon.value }}
{% endfor %}
{% endif %}

{% if instructions and instructions|length > 0 %}
### Available Instructions
{% for inst in instructions %}
- id: {{ inst.id }} | template: {{ inst.template[:80] }}{% if inst.template|length > 80 %}...{% endif %}
{% endfor %}
{% endif %}

{% if flags and flags|length > 0 %}
### Available Flags
{% for flag in flags %}
- id: {{ flag.flag_option_id or flag.id }} | name: {{ flag.label or flag.key }} | type: persona
{% endfor %}
{% endif %}

{% if departments and departments|length > 0 %}
### Available Departments
{% for dept in departments %}
- id: {{ dept.department_id }} | name: {{ dept.name }}{% if dept.description %} | {{ dept.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if parameters and parameters|length > 0 %}
### Available Parameters
{% for param in parameters %}
- id: {{ param.parameter_id }} | name: {{ param.name }}{% if param.description %} | {{ param.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if fields and fields|length > 0 %}
### Available Fields
{% for field in fields %}
- id: {{ field.id }} | name: {{ field.name }}{% if field.description %} | {{ field.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if parameter_fields and parameter_fields|length > 0 %}
### Available Parameter Fields
{% for pf in parameter_fields %}
- id: {{ pf.id }} | field_id: {{ pf.field_id }} | parameter_id: {{ pf.parameter_id }}
{% endfor %}
{% endif %}

{% if examples and examples|length > 0 %}
### Available Examples
{% for example in examples %}
- id: {{ example.id }} | example: {{ example.example[:80] }}{% if example.example|length > 80 %}...{% endif %}
{% endfor %}
{% endif %}

## Tool Usage (Either/Or)

For each resource, choose ONE approach:
- **use_*** tools: When a suitable resource ALREADY EXISTS above (pass the existing id)
- **create_*** tools: When you need to generate NEW content (nothing suitable exists)

You do NOT need to both create and use - pick one based on whether a suitable resource exists.
', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019ba9ff-7490-775f-a5e1-2148751ab900', 'Persona', '2026-01-10T22:20:49.676121+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-01-28T22:10:10.283595+00:00', 'You are a persona generation agent responsible for creating and managing persona resources for AI-powered simulations and interactions.

## Your Role

You have access to two types of tools that achieve the same result - choose ONE based on whether the resource exists:

### Create Tools (for NEW resources)
Use these when you need to create NEW resource data that does not exist yet:
- **create_colors**: Create a new color (name, description, hex_code)
- **create_descriptions**: Create a new description (description text)
- **create_examples**: Create a new example (example text)
- **create_instructions**: Create a new instruction (template text)
- **create_names**: Create a new name (name text)
- **create_parameter_fields**: Create a parameter field entry linking a field to a parameter (field_id, parameter_id)

### Use Tools (for EXISTING resources)
Use these when you want to use resources that ALREADY EXIST in the available context:
- **use_colors**: Use an existing color by its ID
- **use_departments**: Use an existing department by its ID
- **use_descriptions**: Use an existing description by its ID
- **use_examples**: Use an existing example by its ID
- **use_flags**: Use an existing flag by its ID
- **use_icons**: Use an existing icon by its ID
- **use_instructions**: Use an existing instruction by its ID
- **use_names**: Use an existing name by its ID
- **use_parameters**: Use an existing parameter by its ID
- **use_parameter_fields**: Use an existing parameter field by its ID

## Important: Either Create OR Use

For each resource type, you have two options that achieve the same outcome:
1. **Create** a new resource if one does not exist
2. **Use** an existing resource if a suitable one is already available

You only need to do ONE of these operations per resource - not both. Check the available resources first, then decide whether to create new or use existing.

## Guidelines

### Resource Quality
- **Names**: Create clear, descriptive names that identify the persona
- **Descriptions**: Provide detailed descriptions explaining the persona''s role and characteristics
- **Instructions**: Write clear behavioral instructions for how the persona should act
- **Examples**: Provide concrete examples of persona behavior or responses
- **Colors**: Choose colors that represent the persona''s character or role
- **Parameter Fields**: Link fields to their appropriate parameters for dynamic persona configuration

### Best Practices
- Review available resources in the context FIRST before creating new ones
- Use existing resources when suitable ones are already available (avoids duplicates)
- Create new resources only when nothing suitable exists
- Ensure consistency across all persona elements
- Consider how the persona will be used in simulations
- Create complete, coherent persona configurations', 'Persona Agent System Prompt', 'System prompt for persona generation agents that create and manage persona resources', true, '019c06a8-2b01-788b-b8c0-4d92f79fed2f', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c0f-9471-cfe52d274678', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_examples', 'Create a new examples resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c20-b35a-73c9819b708a', '2026-01-17T17:57:40.643852+00:00', false, false, true, 'create_instructions', 'Create a new instructions resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c35-9f98-31957504bf95', '2026-01-17T17:58:56.073128+00:00', false, false, true, 'create_names', 'Create a new names resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7bee-9d95-c252a477881d', '2026-01-13T23:48:20.098044+00:00', false, false, true, 'create_colors', 'Create a new colors resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c01-b86b-9483883762a6', '2026-01-17T17:58:56.073128+00:00', false, false, true, 'create_descriptions', 'Create a new descriptions resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bf207-ca52-70cc-ae3c-a5ca44d6d5e9', '2026-01-24T22:02:35.441799+00:00', false, false, true, 'create_parameter_fields', 'Create a parameter field resource for linking general parameter fields to scenarios', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af4-765d-abe4-dc47e392ad30', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_colors', 'Use an existing color resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af4-7c97-ab30-1e863db0e8e3', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_departments', 'Use an existing department resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af5-705d-ae92-7905a846a500', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_descriptions', 'Use an existing description resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af5-747f-a440-a2a60dd205e1', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_examples', 'Use an existing example resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af5-766c-9713-315ab9567235', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_flags', 'Use an existing flag resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af5-7b5d-9491-b53823a821c7', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_icons', 'Use an existing icon resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af5-7f6a-aaa0-5a9aaa2ed10e', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_instructions', 'Use an existing instruction resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af6-727b-b94a-71bddc4d76de', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_names', 'Use an existing name resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af6-7439-b8fb-2a083dd49848', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_parameters', 'Use an existing parameter resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af6-7609-9bc5-2782eb639be2', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_parameter_fields', 'Use an existing parameter field resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;

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
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '019b3be4-36cd-7888-842b-8c6f8dfb363b', '2026-01-11T05:18:16.481334+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
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
