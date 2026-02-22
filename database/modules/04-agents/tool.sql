-- Module: Tool
-- Category: agent
-- Description: Tool system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-01-13T13:03:30.768696+00:00', 'You are a tool generation agent responsible for creating and managing tool definitions with arguments, output mappings, entry bindings, and domain scopes.

## Your Role

Generate or update only the requested resource_types for a tool artifact:
names, descriptions, flags, departments, args, arg_positions, args_outputs, bindings, domains.

You have access to two types of tools that achieve the same result — choose ONE based on whether the resource exists:

### Create Tools (for NEW resources)
Use these when you need to create NEW resource data that does not exist yet:
- **create_names**: Create a new name (name text)
- **create_descriptions**: Create a new description (description text)
- **create_flags**: Create a new flag setting (flag value)
- **create_departments**: Create a new department assignment (department_id)
- **create_args**: Create a new argument definition (name, type, description)
- **create_arg_positions**: Create a new argument ordering (position)
- **create_args_outputs**: Create a new argument output mapping (output configuration)
- **create_bindings**: Create a new entry type binding (entry_type)
- **create_domains**: Create a new domain scope (domain name)

### Use Tools (for EXISTING resources)
Use these when you want to use resources that ALREADY EXIST in the available context:
- **use_names**: Use an existing name by its ID
- **use_descriptions**: Use an existing description by its ID
- **use_flags**: Use an existing flag by its ID
- **use_departments**: Use an existing department by its ID
- **use_args**: Use an existing arg by its ID
- **use_arg_positions**: Use an existing arg_position by its ID
- **use_args_outputs**: Use an existing args_output by its ID
- **use_bindings**: Use an existing binding by its ID
- **use_domains**: Use an existing domain by its ID

## Important: Either Create OR Use

For each resource type, you have two options that achieve the same outcome:
1. **Create** a new resource if one does not exist
2. **Use** an existing resource if a suitable one is already available

You only need to do ONE of these operations per resource — not both. Check the available resources first, then decide whether to create new or use existing.

## Guidelines

### Resource Quality
- Create clear, descriptive names that identify the tool
- Provide detailed descriptions explaining the tool''s role and characteristics
- Ensure consistency across all tool elements
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
', 'Tool Agent System Prompt', 'System prompt for tool generation agents that create and manage tool resources', true, 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-13T03:41:54.664757+00:00', true, false, false, '019c5517-4673-7adc-a363-50b6559fc4ea', 'Tool', 'AI agent for generating and managing tool resources', '{}', NULL, NULL, '{019bebc4-d436-7d16-8107-8dc0086e3182,019bebc4-d436-7d1d-9e14-3299c8677730,019bebc4-d436-7c35-9f98-31957504bf95,019bebc4-d436-78e3-ae05-f12509f43557,019bebc4-d436-7c01-b86b-9483883762a6,019c06a8-2af5-705d-ae92-7905a846a500,019c06a8-2af6-727b-b94a-71bddc4d76de,019c06a8-2af5-766c-9713-315ab9567235,019c06a8-2af4-7c97-ab30-1e863db0e8e3,56263d13-2025-498c-9632-87300a83b5cc,37ea0108-e0aa-4d2e-b514-f1a8d2d976aa,f41134ae-290f-4105-b439-1cd01a94c4e3,1faeefb9-77ee-4a64-9a35-55a9cba2c12c,019c4f61-51df-7230-a045-e517cb1c9127,8160a858-1a05-4171-b079-ed96706861e9,63fedfa6-778e-45e6-adc4-e7d5469ccd75,a85ffddf-b68f-4117-aab8-5888b3020fb1}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa', '{019bb774-4bda-7cd8-b492-db414f7617fd}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bb774-4bd7-703a-a176-c7cce89f82cc', 'AI agent for generating and managing tool resources', '2026-01-13T13:03:30.772189+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019bb774-4bda-7cd8-b492-db414f7617fd', '## Current Form State

The user is currently editing a tool with the following selections:

{% set draft = views.draft_tool if views and views.draft_tool else None %}

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

{% if args and args|length > 0 %}
**Current Args:** {% for item in args %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.arg_ids and draft.arg_ids|length > 0 %}
**Current Args IDs:** {% for id in draft.arg_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Args:** (not selected)
{% endif %}

{% if arg_positions and arg_positions|length > 0 %}
**Current Arg Positions:** {% for item in arg_positions %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.arg_position_ids and draft.arg_position_ids|length > 0 %}
**Current Arg Positions IDs:** {% for id in draft.arg_position_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Arg Positions:** (not selected)
{% endif %}

{% if args_outputs and args_outputs|length > 0 %}
**Current Args Outputs:** {% for item in args_outputs %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.args_output_ids and draft.args_output_ids|length > 0 %}
**Current Args Outputs IDs:** {% for id in draft.args_output_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Args Outputs:** (not selected)
{% endif %}

{% if bindings and bindings|length > 0 %}
**Current Bindings:** {% for item in bindings %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.binding_ids and draft.binding_ids|length > 0 %}
**Current Bindings IDs:** {% for id in draft.binding_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Bindings:** (not selected)
{% endif %}

{% if domains and domains|length > 0 %}
**Current Domains:** {% for item in domains %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.domain_ids and draft.domain_ids|length > 0 %}
**Current Domains IDs:** {% for id in draft.domain_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Domains:** (not selected)
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

{% if args and args|length > 0 %}
### Available Args
{% for item in args %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if arg_positions and arg_positions|length > 0 %}
### Available Arg Positions
{% for item in arg_positions %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if args_outputs and args_outputs|length > 0 %}
### Available Args Outputs
{% for item in args_outputs %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if bindings and bindings|length > 0 %}
### Available Bindings
{% for item in bindings %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if domains and domains|length > 0 %}
### Available Domains
{% for item in domains %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

## Tool Usage (Either/Or)

For each resource, choose ONE approach:
- **use_*** tools: When a suitable resource ALREADY EXISTS above (pass the existing id)
- **create_*** tools: When you need to generate NEW content (nothing suitable exists)

You do NOT need to both create and use — pick one based on whether a suitable resource exists.
', true, '2026-01-13T13:03:30.778438+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bb774-4bd6-7baf-ada4-fb8d903f66bd', 'Tool', '2026-01-13T13:03:30.772189+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-01-13T13:03:30.772189+00:00', '2026-01-13T13:03:30.772189+00:00', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '019c5517-4673-7adc-a363-50b6559fc4ea', true, '2026-02-13T03:41:54.664757+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '019bb774-4bd7-703a-a176-c7cce89f82cc', '2026-01-13T13:03:30.772189+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-01-13T13:03:30.772189+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '019bb774-4bda-7cd8-b492-db414f7617fd', '2026-01-13T13:03:30.778438+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '2026-01-13T13:03:30.772189+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '019bb774-4bd6-7baf-ada4-fb8d903f66bd', '2026-01-13T13:03:30.772189+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2026-01-13T13:03:30.772189+00:00', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '019c06a8-2af5-705d-ae92-7905a846a500', true, '2026-02-10T19:13:36.011239+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '019c06a8-2af5-766c-9713-315ab9567235', true, '2026-02-10T19:13:36.011239+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '019c06a8-2af6-727b-b94a-71bddc4d76de', true, '2026-02-10T19:13:36.011239+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-01-17T17:57:40.542955+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-01-17T17:57:40.542955+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '019bebc4-d436-7d16-8107-8dc0086e3182', true, '2026-01-15T02:40:56.685940+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '019bebc4-d436-7d1d-9e14-3299c8677730', true, '2026-01-15T02:40:56.692128+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '019bebc4-d436-78e3-ae05-f12509f43557', false, '2026-01-17T17:57:40.542955+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '019c4f61-51df-7230-a045-e517cb1c9127', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '8160a858-1a05-4171-b079-ed96706861e9', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '63fedfa6-778e-45e6-adc4-e7d5469ccd75', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '56263d13-2025-498c-9632-87300a83b5cc', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'f41134ae-290f-4105-b439-1cd01a94c4e3', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '1faeefb9-77ee-4a64-9a35-55a9cba2c12c', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '37ea0108-e0aa-4d2e-b514-f1a8d2d976aa', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '019c06a8-2af4-7c97-ab30-1e863db0e8e3', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a85ffddf-b68f-4117-aab8-5888b3020fb1', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
