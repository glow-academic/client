-- Module: Cohort
-- Category: agent
-- Description: Cohort system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-01-17T17:57:40.639882+00:00', 'You are a cohort generation agent responsible for creating and managing cohorts that group simulations for training programs.

## Your Role
Generate or update only the requested resource_types for a cohort artifact.

## Tool Categories

### Resources (Create or Use)
- **names**: create_names / use_names — cohort display name
- **descriptions**: create_descriptions / use_descriptions — cohort description
- **simulation_positions**: create_simulation_positions / use_simulation_positions — ordering of simulations
- **simulation_availability**: create_simulation_availability / use_simulation_availability — availability windows
- **profile_personas**: create_profile_personas / use_profile_personas — persona assignments per profile

### Entries (Use Only)
- **departments**: use_departments — department assignments
- **flags**: use_flags — flag settings
- **simulations**: use_simulations — simulation bindings
- **profiles**: use_profiles — profile bindings

## Rules
- For Resources: check available context first, create only if nothing suitable exists
- For Entries: always use use_* tools with IDs from context
- Operate only on requested resource_types
- Do not invent IDs — use IDs from context
- Return only valid tool calls, no narrative text', 'Cohort Agent System Prompt', 'System prompt for cohort generation agents', true, '66666666-7777-7777-7777-666666666666', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-13T03:41:54.664757+00:00', true, false, false, '019c5517-4673-7073-adf9-00c0bd4e21dc', 'Cohort', 'AI agent for generating and managing cohort resources including names, descriptions, flags, departments, personas, and scenarios using GPT-5.1', '{}', NULL, NULL, '{019bebc4-d436-7c01-b86b-9483883762a6,019bebc4-d436-7c35-9f98-31957504bf95,019bebc4-d436-7d28-8f22-23d852477486,019c06a8-2af4-7c97-ab30-1e863db0e8e3,eebab06c-460f-45d8-94ca-64cfa9d7e20c,019c06a8-2af5-705d-ae92-7905a846a500,019c06a8-2af5-766c-9713-315ab9567235,019c06a8-2af6-727b-b94a-71bddc4d76de,35d3af95-db6a-430b-bc78-2fd51c5ff45c,45902714-adea-43d4-8068-42a1913f6a45,019c4f27-1784-75b1-964f-dd416213ce49,019c4f27-1780-7b67-ae67-f94f42caef57,fb98d031-edcc-4945-a569-84083134b310,98dfa8d8-31e9-4917-8c59-43fb8eedd84b}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '66666666-7777-7777-7777-666666666666', '{019c2f10-4100-7c00-8000-000000000001}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bcd1b-0ca2-77e8-97a1-0f329141d993', 'AI agent for generating and managing cohort resources including names, descriptions, flags, departments, personas, and scenarios using GPT-5.1', '2026-01-17T17:57:40.639882+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c2f10-4100-7c00-8000-000000000001', '## Current State
{% set draft = entries.draft_cohort if entries and entries.draft_cohort else None %}

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

{% if resources.flags and resources.flags|length > 0 %}
**Flags:** {% for item in resources.flags %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.flag_ids and draft.flag_ids|length > 0 %}
**Flags IDs:** {% for id in draft.flag_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Flags:** (not set){% endif %}

{% if resources.departments and resources.departments|length > 0 %}
**Departments:** {% for item in resources.departments %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.department_ids and draft.department_ids|length > 0 %}
**Departments IDs:** {% for id in draft.department_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Departments:** (not set){% endif %}

{% if resources.simulations and resources.simulations|length > 0 %}
**Simulations:** {% for item in resources.simulations %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.simulation_ids and draft.simulation_ids|length > 0 %}
**Simulations IDs:** {% for id in draft.simulation_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Simulations:** (not set){% endif %}

{% if resources.profiles and resources.profiles|length > 0 %}
**Profiles:** {% for item in resources.profiles %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.profile_ids and draft.profile_ids|length > 0 %}
**Profiles IDs:** {% for id in draft.profile_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Profiles:** (not set){% endif %}

{% if resources.simulation_positions and resources.simulation_positions|length > 0 %}
**Simulation Positions:** {% for item in resources.simulation_positions %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.simulation_position_ids and draft.simulation_position_ids|length > 0 %}
**Simulation Positions IDs:** {% for id in draft.simulation_position_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Simulation Positions:** (not set){% endif %}

{% if resources.simulation_availability and resources.simulation_availability|length > 0 %}
**Simulation Availability:** {% for item in resources.simulation_availability %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.simulation_availability_ids and draft.simulation_availability_ids|length > 0 %}
**Simulation Availability IDs:** {% for id in draft.simulation_availability_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Simulation Availability:** (not set){% endif %}

{% if resources.profile_personas and resources.profile_personas|length > 0 %}
**Profile Personas:** {% for item in resources.profile_personas %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.profile_persona_ids and draft.profile_persona_ids|length > 0 %}
**Profile Personas IDs:** {% for id in draft.profile_persona_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Profile Personas:** (not set){% endif %}

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

{% if resources.simulation_positions and resources.simulation_positions|length > 0 %}
#### Simulation Positions
{% for item in resources.simulation_positions %}- simulation_id: {{ item.simulation_id }} | {{ item.value }}
{% endfor %}{% endif %}

{% if resources.simulation_availability and resources.simulation_availability|length > 0 %}
#### Simulation Availability
{% for item in resources.simulation_availability %}- id: {{ item.id }} | simulation_id: {{ item.simulation_id }} | {{ item.time }} ({{ item.type }})
{% endfor %}{% endif %}

{% if resources.profile_personas and resources.profile_personas|length > 0 %}
#### Profile Personas
{% for item in resources.profile_personas %}- id: {{ item.id }} | profile_id: {{ item.profile_id }} | persona_id: {{ item.persona_id }}
{% endfor %}{% endif %}

### Entries (Use Only)
{% if resources.departments and resources.departments|length > 0 %}
#### Departments
{% for item in resources.departments %}- id: {{ item.department_id }} | {{ item.name }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}{% endif %}

{% if resources.flags and resources.flags|length > 0 %}
#### Flags
{% for item in resources.flags %}- id: {{ item.flag_option_id }} | {{ item.label or item.key }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}{% endif %}

{% if resources.simulations and resources.simulations|length > 0 %}
#### Simulations
{% for item in resources.simulations %}- id: {{ item.simulation_id }} | {{ item.name }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}{% endif %}

{% if resources.profiles and resources.profiles|length > 0 %}
#### Profiles
{% for item in resources.profiles %}- id: {{ item.profile_id }} | {{ item.name }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}{% endif %}

## Tool Usage
- **Resources**: use_* when suitable exists, create_* when nothing suitable exists
- **Entries**: always use_* with provided IDs', true, '2026-02-10T19:10:26.375145+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bcd1b-0ca2-7561-91c1-190d15981938', 'Cohort', '2026-01-17T17:57:40.639882+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-01-17T17:57:40.639882+00:00', '2026-01-17T17:57:40.639882+00:00', '66666666-6666-6666-6666-666666666666', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('66666666-6666-6666-6666-666666666666', '019c5517-4673-7073-adf9-00c0bd4e21dc', true, '2026-02-13T03:41:54.664757+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('66666666-6666-6666-6666-666666666666', '019bcd1b-0ca2-77e8-97a1-0f329141d993', '2026-01-17T17:57:40.639882+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('66666666-6666-6666-6666-666666666666', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-01-17T17:57:40.639882+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('66666666-6666-6666-6666-666666666666', '019c2f10-4100-7c00-8000-000000000001', '2026-02-10T19:10:26.375145+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('66666666-6666-6666-6666-666666666666', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '2026-01-17T17:57:40.639882+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('66666666-6666-6666-6666-666666666666', '019bcd1b-0ca2-7561-91c1-190d15981938', '2026-01-17T17:57:40.639882+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2026-01-17T17:57:40.639882+00:00', '66666666-6666-6666-6666-666666666666', '66666666-7777-7777-7777-666666666666', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('66666666-6666-6666-6666-666666666666', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-01-17T17:57:40.639882+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('66666666-6666-6666-6666-666666666666', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-01-17T17:57:40.639882+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('66666666-6666-6666-6666-666666666666', '019bebc4-d436-7d28-8f22-23d852477486', true, '2026-01-19T21:43:11.312843+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('66666666-6666-6666-6666-666666666666', 'eebab06c-460f-45d8-94ca-64cfa9d7e20c', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('66666666-6666-6666-6666-666666666666', '019c06a8-2af4-7c97-ab30-1e863db0e8e3', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('66666666-6666-6666-6666-666666666666', '019c06a8-2af5-705d-ae92-7905a846a500', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('66666666-6666-6666-6666-666666666666', '019c06a8-2af5-766c-9713-315ab9567235', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('66666666-6666-6666-6666-666666666666', '019c06a8-2af6-727b-b94a-71bddc4d76de', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('66666666-6666-6666-6666-666666666666', '35d3af95-db6a-430b-bc78-2fd51c5ff45c', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('66666666-6666-6666-6666-666666666666', '45902714-adea-43d4-8068-42a1913f6a45', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('66666666-6666-6666-6666-666666666666', '019c4f27-1784-75b1-964f-dd416213ce49', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('66666666-6666-6666-6666-666666666666', '019c4f27-1780-7b67-ae67-f94f42caef57', true, '2026-02-22T23:46:41.084407+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('66666666-6666-6666-6666-666666666666', 'fb98d031-edcc-4945-a569-84083134b310', true, '2026-02-22T23:46:41.084407+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('66666666-6666-6666-6666-666666666666', '98dfa8d8-31e9-4917-8c59-43fb8eedd84b', true, '2026-02-22T23:46:41.084407+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
