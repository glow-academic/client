-- Module: Simulation
-- Category: agent
-- Description: Simulation system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-01-30T03:00:52.718855+00:00', 'You are a simulation generation agent responsible for creating and managing simulation configurations with scenario orderings, rubrics, and time limits.

## Your Role
Generate or update only the requested resource_types for a simulation artifact.

## Tool Categories

### Resources (Create or Use)
- **names**: create_names / use_names — simulation display name
- **descriptions**: create_descriptions / use_descriptions — simulation description
- **scenario_flags**: create_scenario_flags / use_scenario_flags — flag overrides per scenario
- **scenario_positions**: create_scenario_positions / use_scenario_positions — scenario ordering
- **scenario_rubrics**: create_scenario_rubrics / use_scenario_rubrics — rubric bindings per scenario
- **scenario_time_limits**: create_scenario_time_limits / use_scenario_time_limits — time limits per scenario

### Entries (Use Only)
- **departments**: use_departments — department assignments
- **flags**: use_flags — flag settings
- **scenarios**: use_scenarios — scenario bindings

## Rules
- For Resources: check available context first, create only if nothing suitable exists
- For Entries: always use use_* tools with IDs from context
- Operate only on requested resource_types
- Do not invent IDs — use IDs from context
- Return only valid tool calls, no narrative text', 'Simulation Agent System Prompt', 'System prompt for simulation generation agents that create and manage simulation resources', true, '019c0cd8-ad7d-79da-8469-639662fc6a3f', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-13T03:41:54.664757+00:00', true, false, false, '019c5517-4673-775e-852f-114fee676a28', 'Simulation', 'AI agent for generating and managing simulation scenario resources including scenarios, scenario positions, scenario flags, and scenario rubric grade agents', '{}', NULL, NULL, '{019bebc4-d436-7c35-9f98-31957504bf95,019bebc4-d436-7cb0-a120-7762b81276c3,019bebc4-d436-7c01-b86b-9483883762a6,019bebc4-d436-7d09-a5fb-d51eae133785,019c06a8-2af5-766c-9713-315ab9567235,019c0cd8-ad73-72dd-8a41-ea5b247384db,019c0cd8-ad73-7621-b92d-91764faa013e,019c0cd8-ad73-781f-a3aa-1f1049dd213c,019c0cd8-ad73-7a10-805f-28e22f591d29,019c06a8-2af6-727b-b94a-71bddc4d76de,019c0cd8-ad73-7b6f-b393-86ceeddd1beb,019c06a8-2af4-7c97-ab30-1e863db0e8e3,019c06a8-2af5-705d-ae92-7905a846a500,7dc39eae-ae96-43d8-bf84-738d775b2780,71082313-23e6-428e-a32f-86ea85aad6bb}', NULL, NULL, '019bb25e-e5ff-7781-b262-7c33d17dec4f', '019c0cd8-ad7d-79da-8469-639662fc6a3f', '{019c0cd8-ad7e-785c-a3d5-6999d78c5b2c}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bb544-1328-7d59-8ae7-68bea0af451c', 'AI agent for generating and managing simulation scenario resources including scenarios, scenario positions, scenario flags, and scenario rubric grade agents', '2026-01-13T02:51:36.094810+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c0cd8-ad7e-785c-a3d5-6999d78c5b2c', '## Current State
{% set draft = entries.draft_simulation if entries and entries.draft_simulation else None %}

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

{% if resources.scenarios and resources.scenarios|length > 0 %}
**Scenarios:** {% for item in resources.scenarios %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.scenario_ids and draft.scenario_ids|length > 0 %}
**Scenarios IDs:** {% for id in draft.scenario_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Scenarios:** (not set){% endif %}

{% if resources.scenario_flags and resources.scenario_flags|length > 0 %}
**Scenario Flags:** {% for item in resources.scenario_flags %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.scenario_flag_ids and draft.scenario_flag_ids|length > 0 %}
**Scenario Flags IDs:** {% for id in draft.scenario_flag_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Scenario Flags:** (not set){% endif %}

{% if resources.scenario_positions and resources.scenario_positions|length > 0 %}
**Scenario Positions:** {% for item in resources.scenario_positions %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.scenario_position_ids and draft.scenario_position_ids|length > 0 %}
**Scenario Positions IDs:** {% for id in draft.scenario_position_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Scenario Positions:** (not set){% endif %}

{% if resources.scenario_rubrics and resources.scenario_rubrics|length > 0 %}
**Scenario Rubrics:** {% for item in resources.scenario_rubrics %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.scenario_rubric_ids and draft.scenario_rubric_ids|length > 0 %}
**Scenario Rubrics IDs:** {% for id in draft.scenario_rubric_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Scenario Rubrics:** (not set){% endif %}

{% if resources.scenario_time_limits and resources.scenario_time_limits|length > 0 %}
**Scenario Time Limits:** {% for item in resources.scenario_time_limits %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.scenario_time_limit_ids and draft.scenario_time_limit_ids|length > 0 %}
**Scenario Time Limits IDs:** {% for id in draft.scenario_time_limit_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}**Scenario Time Limits:** (not set){% endif %}

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

{% if resources.scenario_flags and resources.scenario_flags|length > 0 %}
#### Scenario Flags
{% for item in resources.scenario_flags %}- id: {{ item.id }} | {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}{% endif %}

{% if resources.scenario_positions and resources.scenario_positions|length > 0 %}
#### Scenario Positions
{% for item in resources.scenario_positions %}- id: {{ item.id }} | {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}{% endif %}

{% if resources.scenario_rubrics and resources.scenario_rubrics|length > 0 %}
#### Scenario Rubrics
{% for item in resources.scenario_rubrics %}- id: {{ item.id }} | {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}{% endif %}

{% if resources.scenario_time_limits and resources.scenario_time_limits|length > 0 %}
#### Scenario Time Limits
{% for item in resources.scenario_time_limits %}- id: {{ item.id }} | {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
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

{% if resources.scenarios and resources.scenarios|length > 0 %}
#### Scenarios
{% for item in resources.scenarios %}- id: {{ item.id }} | {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}{% endif %}

## Tool Usage
- **Resources**: use_* when suitable exists, create_* when nothing suitable exists
- **Entries**: always use_* with provided IDs', true, '2026-01-30T03:00:52.718855+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bb544-1328-7380-8dce-3092e322e289', 'Simulation', '2026-01-13T02:51:36.094810+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-01-13T02:51:36.094810+00:00', '2026-01-13T02:51:36.094810+00:00', 'dddddddd-dddd-dddd-dddd-dddddddddddd', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', '019c5517-4673-775e-852f-114fee676a28', true, '2026-02-13T03:41:54.664757+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', '019bb544-1328-7d59-8ae7-68bea0af451c', '2026-01-13T02:51:36.094810+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-01-13T02:51:36.094810+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', '019c0cd8-ad7e-785c-a3d5-6999d78c5b2c', '2026-01-30T03:00:52.718855+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', '019bb25e-e5ff-7781-b262-7c33d17dec4f', '2026-01-23T16:46:46.036849+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', '019bb544-1328-7380-8dce-3092e322e289', '2026-01-13T02:51:36.094810+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2026-01-13T02:51:36.094810+00:00', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '019c0cd8-ad7d-79da-8469-639662fc6a3f', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', '019bebc4-d436-7cb0-a120-7762b81276c3', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', '019bebc4-d436-7d09-a5fb-d51eae133785', true, '2026-01-17T17:57:40.541885+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', '019c06a8-2af4-7c97-ab30-1e863db0e8e3', true, '2026-01-30T03:00:52.718855+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', '019c06a8-2af5-705d-ae92-7905a846a500', true, '2026-01-30T03:00:52.718855+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', '019c06a8-2af5-766c-9713-315ab9567235', true, '2026-01-30T03:00:52.718855+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', '019c06a8-2af6-727b-b94a-71bddc4d76de', true, '2026-01-30T03:00:52.718855+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', '019c0cd8-ad73-72dd-8a41-ea5b247384db', true, '2026-01-30T03:00:52.718855+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', '019c0cd8-ad73-7621-b92d-91764faa013e', true, '2026-01-30T03:00:52.718855+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', '019c0cd8-ad73-781f-a3aa-1f1049dd213c', true, '2026-01-30T03:00:52.718855+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', '019c0cd8-ad73-7a10-805f-28e22f591d29', true, '2026-01-30T03:00:52.718855+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', '019c0cd8-ad73-7b6f-b393-86ceeddd1beb', true, '2026-01-30T03:00:52.718855+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', '7dc39eae-ae96-43d8-bf84-738d775b2780', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', '71082313-23e6-428e-a32f-86ea85aad6bb', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
