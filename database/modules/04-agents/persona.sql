-- Module: Persona
-- Category: agent
-- Description: Persona system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-01-28T22:10:10.283595+00:00', 'You are a persona generation agent responsible for creating and managing personas for AI-powered simulations and interactions.

## Your Role
Generate or update only the requested resource_types for a persona artifact.

## Tool Categories

### Resources (Create or Use)
- **names**: create_names / use_names — persona display name
- **descriptions**: create_descriptions / use_descriptions — persona description
- **colors**: create_colors / use_colors — color theme (name, hex_code)
- **instructions**: create_instructions / use_instructions — behavioral instructions (template text)
- **examples**: create_examples / use_examples — example behaviors
- **parameter_fields**: create_parameter_fields / use_parameter_fields — parameter field links
- **voices**: create_voices / use_voices — voice settings

### Entries (Use Only)
- **departments**: use_departments — department assignments
- **flags**: use_flags — flag settings
- **icons**: use_icons — icon assignments
- **parameters**: use_parameters — parameter bindings

## Rules
- For Resources: check available context first, create only if nothing suitable exists
- For Entries: always use use_* tools with IDs from context
- Operate only on requested resource_types
- Do not invent IDs — use IDs from context
- Return only valid tool calls, no narrative text', 'Persona Agent System Prompt', 'System prompt for persona generation agents that create and manage persona resources', true, '019c06a8-2b01-788b-b8c0-4d92f79fed2f', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-01-10T22:20:49.676121+00:00', true, false, false, '019bb25e-e5f2-7f9e-8027-3334ababb644', 'Persona', 'AI agent for generating and managing persona resources including names, descriptions, colors, icons, instructions, examples, flags, departments, and fields using GPT-5.1', '{}', NULL, NULL, '{019bebc4-d436-7c01-b86b-9483883762a6,019bebc4-d436-7c20-b35a-73c9819b708a,019bebc4-d436-7c0f-9471-cfe52d274678,019bebc4-d436-7c35-9f98-31957504bf95,019bebc4-d436-7bee-9d95-c252a477881d,019c06a8-2af6-7439-b8fb-2a083dd49848,019bf207-ca52-70cc-ae3c-a5ca44d6d5e9,019c06a8-2af4-765d-abe4-dc47e392ad30,019c06a8-2af4-7c97-ab30-1e863db0e8e3,019c06a8-2af5-705d-ae92-7905a846a500,019c06a8-2af5-747f-a440-a2a60dd205e1,019c06a8-2af5-766c-9713-315ab9567235,019c06a8-2af5-7b5d-9491-b53823a821c7,019c06a8-2af5-7f6a-aaa0-5a9aaa2ed10e,019c06a8-2af6-727b-b94a-71bddc4d76de,019c06a8-2af6-7609-9bc5-2782eb639be2,209cfad1-69b5-40be-a980-406888376306,019bebc4-d436-7ccc-9e9c-6f4b2a633f9d}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '019c06a8-2b01-788b-b8c0-4d92f79fed2f', '{019c06a8-2b02-7b38-821e-2baeba1039b1}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019ba9ff-7490-7ce9-bc43-10787c7e3eb8', 'AI agent for generating and managing persona resources including names, descriptions, colors, icons, instructions, examples, flags, departments, and fields using GPT-5.1', '2026-01-10T22:20:49.676121+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c06a8-2b02-7b38-821e-2baeba1039b1', '## Current State
{% set draft = entries.draft_persona if entries and entries.draft_persona else None %}

{% if resources.names and resources.names|length > 0 %}
**Names:** {% for n in resources.names %}{{ n.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.name_ids and draft.name_ids|length > 0 %}
**Names IDs:** {% for id in draft.name_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Names:** (not set){% endif %}

{% if resources.descriptions and resources.descriptions|length > 0 %}
**Descriptions:** {% for d in resources.descriptions %}{{ d.description[:100] }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.description_ids and draft.description_ids|length > 0 %}
**Descriptions IDs:** {% for id in draft.description_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Descriptions:** (not set){% endif %}

{% if resources.colors and resources.colors|length > 0 %}
**Colors:** {% for c in resources.colors %}{{ c.name ~ '' ('' ~ c.hex_code ~ '')'' }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.color_ids and draft.color_ids|length > 0 %}
**Colors IDs:** {% for id in draft.color_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Colors:** (not set){% endif %}

{% if resources.icons and resources.icons|length > 0 %}
**Icons:** {% for icon in resources.icons %}{{ icon.name ~ '' ('' ~ icon.value ~ '')'' }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.icon_ids and draft.icon_ids|length > 0 %}
**Icons IDs:** {% for id in draft.icon_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Icons:** (not set){% endif %}

{% if resources.instructions and resources.instructions|length > 0 %}
**Instructions:** {% for inst in resources.instructions %}{{ inst.template[:80] }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.instruction_ids and draft.instruction_ids|length > 0 %}
**Instructions IDs:** {% for id in draft.instruction_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Instructions:** (not set){% endif %}

{% if resources.flags and resources.flags|length > 0 %}
**Flags:** {% for item in resources.flags %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.flag_ids and draft.flag_ids|length > 0 %}
**Flags IDs:** {% for id in draft.flag_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Flags:** (not set){% endif %}

{% if resources.examples and resources.examples|length > 0 %}
**Examples:** {% for ex in resources.examples %}{{ ex.example[:50] }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.example_ids and draft.example_ids|length > 0 %}
**Examples IDs:** {% for id in draft.example_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Examples:** (not set){% endif %}

{% if resources.parameter_fields and resources.parameter_fields|length > 0 %}
**Parameter Fields:** {% for item in resources.parameter_fields %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.parameter_field_ids and draft.parameter_field_ids|length > 0 %}
**Parameter Fields IDs:** {% for id in draft.parameter_field_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Parameter Fields:** (not set){% endif %}

{% if resources.departments and resources.departments|length > 0 %}
**Departments:** {% for item in resources.departments %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.department_ids and draft.department_ids|length > 0 %}
**Departments IDs:** {% for id in draft.department_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Departments:** (not set){% endif %}

{% if resources.parameters and resources.parameters|length > 0 %}
**Parameters:** {% for item in resources.parameters %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.parameter_ids and draft.parameter_ids|length > 0 %}
**Parameters IDs:** {% for id in draft.parameter_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Parameters:** (not set){% endif %}

{% if resources.voices and resources.voices|length > 0 %}
**Voices:** {% for item in resources.voices %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.voice_ids and draft.voice_ids|length > 0 %}
**Voices IDs:** {% for id in draft.voice_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Voices:** (not set){% endif %}

---

## Available Context

### Resources (Create or Use)
{% if resources.names and resources.names|length > 0 %}
#### Names
{% for item in resources.names %}- id: {{ item.id }} | {{ item.name }}
{% endfor %}{% endif %}

{% if resources.descriptions and resources.descriptions|length > 0 %}
#### Descriptions
{% for item in resources.descriptions %}- id: {{ item.id }} | {{ item.description[:100] }}{% if item.description|length > 100 %}...{% endif %}
{% endfor %}{% endif %}

{% if resources.colors and resources.colors|length > 0 %}
#### Colors
{% for item in resources.colors %}- id: {{ item.id }} | {{ item.name }} | {{ item.hex_code }}
{% endfor %}{% endif %}

{% if resources.instructions and resources.instructions|length > 0 %}
#### Instructions
{% for item in resources.instructions %}- id: {{ item.id }} | {{ item.template[:80] }}{% if item.template|length > 80 %}...{% endif %}
{% endfor %}{% endif %}

{% if resources.examples and resources.examples|length > 0 %}
#### Examples
{% for item in resources.examples %}- id: {{ item.id }} | {{ item.example[:80] }}{% if item.example|length > 80 %}...{% endif %}
{% endfor %}{% endif %}

{% if resources.parameter_fields and resources.parameter_fields|length > 0 %}
#### Parameter Fields
{% for item in resources.parameter_fields %}- id: {{ item.id }} | {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}{% endif %}

{% if resources.voices and resources.voices|length > 0 %}
#### Voices
{% for item in resources.voices %}- id: {{ item.id }} | {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}{% endif %}

### Entries (Use Only)
{% if resources.departments and resources.departments|length > 0 %}
#### Departments
{% for item in resources.departments %}- id: {{ item.id }} | {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}{% endif %}

{% if resources.flags and resources.flags|length > 0 %}
#### Flags
{% for item in resources.flags %}- id: {{ item.id }} | {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}{% endif %}

{% if resources.icons and resources.icons|length > 0 %}
#### Icons
{% for item in resources.icons %}- id: {{ item.id }} | {{ item.name }} | {{ item.value }}
{% endfor %}{% endif %}

{% if resources.parameters and resources.parameters|length > 0 %}
#### Parameters
{% for item in resources.parameters %}- id: {{ item.id }} | {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}{% endif %}

## Tool Usage
- **Resources**: use_* when suitable exists, create_* when nothing suitable exists
- **Entries**: always use_* with provided IDs', true, '2026-01-28T22:10:10.283595+00:00', false, false) ON CONFLICT (id) DO NOTHING;
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
