-- Module: Simulation
-- Category: agent
-- Description: Simulation system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-01-30T03:00:52.718855+00:00', 'You are a simulation generation agent responsible for creating and managing simulation configurations with scenario orderings, rubrics, and time limits.

## Your Role

Generate or update only the requested resource_types for a simulation artifact:
names, descriptions, flags, departments, scenarios, scenario_flags, scenario_personas, scenario_positions, scenario_rubrics, scenario_time_limits.

You have access to two types of tools that achieve the same result — choose ONE based on whether the resource exists:

### Create Tools (for NEW resources)
Use these when you need to create NEW resource data that does not exist yet:
- **create_names**: Create a new name (name text)
- **create_descriptions**: Create a new description (description text)
- **create_flags**: Create a new flag setting (flag value)
- **create_departments**: Create a new department assignment (department_id)
- **create_scenarios**: Create a new scenario binding (scenario_id)
- **create_scenario_flags**: Create a new scenario flag override (flag value per scenario)
- **create_scenario_personas**: Create a new scenario persona override (persona_id per scenario)
- **create_scenario_positions**: Create a new scenario ordering (position per scenario)
- **create_scenario_rubrics**: Create a new scenario rubric binding (rubric_id per scenario)
- **create_scenario_time_limits**: Create a new scenario time limit (minutes per scenario)

### Use Tools (for EXISTING resources)
Use these when you want to use resources that ALREADY EXIST in the available context:
- **use_names**: Use an existing name by its ID
- **use_descriptions**: Use an existing description by its ID
- **use_flags**: Use an existing flag by its ID
- **use_departments**: Use an existing department by its ID
- **use_scenarios**: Use an existing scenario by its ID
- **use_scenario_flags**: Use an existing scenario_flag by its ID
- **use_scenario_personas**: Use an existing scenario_persona by its ID
- **use_scenario_positions**: Use an existing scenario_position by its ID
- **use_scenario_rubrics**: Use an existing scenario_rubric by its ID
- **use_scenario_time_limits**: Use an existing scenario_time_limit by its ID

## Important: Either Create OR Use

For each resource type, you have two options that achieve the same outcome:
1. **Create** a new resource if one does not exist
2. **Use** an existing resource if a suitable one is already available

You only need to do ONE of these operations per resource — not both. Check the available resources first, then decide whether to create new or use existing.

## Guidelines

### Resource Quality
- Create clear, descriptive names that identify the simulation
- Provide detailed descriptions explaining the simulation''s role and characteristics
- Ensure consistency across all simulation elements
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
', 'Simulation Agent System Prompt', 'System prompt for simulation generation agents that create and manage simulation resources', true, '019c0cd8-ad7d-79da-8469-639662fc6a3f', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-13T03:41:54.664757+00:00', true, false, false, '019c5517-4673-775e-852f-114fee676a28', 'Simulation', 'AI agent for generating and managing simulation scenario resources including scenarios, scenario positions, scenario flags, and scenario rubric grade agents', '{}', NULL, NULL, '{019bebc4-d436-7c35-9f98-31957504bf95,019bebc4-d436-7cb0-a120-7762b81276c3,019bebc4-d436-7c01-b86b-9483883762a6,019bebc4-d436-7d09-a5fb-d51eae133785,019c06a8-2af4-7c97-ab30-1e863db0e8e3,019c06a8-2af5-705d-ae92-7905a846a500,019c0cd8-ad73-781f-a3aa-1f1049dd213c,019c0cd8-ad73-7621-b92d-91764faa013e,019c0cd8-ad73-72dd-8a41-ea5b247384db,019c06a8-2af6-727b-b94a-71bddc4d76de,019c06a8-2af5-766c-9713-315ab9567235,019c0cd8-ad73-7b6f-b393-86ceeddd1beb,019c0cd8-ad73-7a10-805f-28e22f591d29,019bebc4-d436-7c64-bb24-5aaac29b8481,7dc39eae-ae96-43d8-bf84-738d775b2780,71082313-23e6-428e-a32f-86ea85aad6bb}', NULL, NULL, '019bb25e-e5ff-7781-b262-7c33d17dec4f', '019c0cd8-ad7d-79da-8469-639662fc6a3f', '{019c0cd8-ad7e-785c-a3d5-6999d78c5b2c}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bb544-1328-7d59-8ae7-68bea0af451c', 'AI agent for generating and managing simulation scenario resources including scenarios, scenario positions, scenario flags, and scenario rubric grade agents', '2026-01-13T02:51:36.094810+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c0cd8-ad7e-785c-a3d5-6999d78c5b2c', '## Current Form State

The user is currently editing a simulation with the following selections:

{% set draft = views.draft_simulation if views and views.draft_simulation else None %}

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

{% if scenarios and scenarios|length > 0 %}
**Current Scenarios:** {% for item in scenarios %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.scenario_ids and draft.scenario_ids|length > 0 %}
**Current Scenarios IDs:** {% for id in draft.scenario_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Scenarios:** (not selected)
{% endif %}

{% if scenario_flags and scenario_flags|length > 0 %}
**Current Scenario Flags:** {% for item in scenario_flags %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.scenario_flag_ids and draft.scenario_flag_ids|length > 0 %}
**Current Scenario Flags IDs:** {% for id in draft.scenario_flag_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Scenario Flags:** (not selected)
{% endif %}

{% if scenario_personas and scenario_personas|length > 0 %}
**Current Scenario Personas:** {% for item in scenario_personas %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.scenario_persona_ids and draft.scenario_persona_ids|length > 0 %}
**Current Scenario Personas IDs:** {% for id in draft.scenario_persona_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Scenario Personas:** (not selected)
{% endif %}

{% if scenario_positions and scenario_positions|length > 0 %}
**Current Scenario Positions:** {% for item in scenario_positions %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.scenario_position_ids and draft.scenario_position_ids|length > 0 %}
**Current Scenario Positions IDs:** {% for id in draft.scenario_position_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Scenario Positions:** (not selected)
{% endif %}

{% if scenario_rubrics and scenario_rubrics|length > 0 %}
**Current Scenario Rubrics:** {% for item in scenario_rubrics %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.scenario_rubric_ids and draft.scenario_rubric_ids|length > 0 %}
**Current Scenario Rubrics IDs:** {% for id in draft.scenario_rubric_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Scenario Rubrics:** (not selected)
{% endif %}

{% if scenario_time_limits and scenario_time_limits|length > 0 %}
**Current Scenario Time Limits:** {% for item in scenario_time_limits %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.scenario_time_limit_ids and draft.scenario_time_limit_ids|length > 0 %}
**Current Scenario Time Limits IDs:** {% for id in draft.scenario_time_limit_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Scenario Time Limits:** (not selected)
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

{% if scenarios and scenarios|length > 0 %}
### Available Scenarios
{% for item in scenarios %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if scenario_flags and scenario_flags|length > 0 %}
### Available Scenario Flags
{% for item in scenario_flags %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if scenario_personas and scenario_personas|length > 0 %}
### Available Scenario Personas
{% for item in scenario_personas %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if scenario_positions and scenario_positions|length > 0 %}
### Available Scenario Positions
{% for item in scenario_positions %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if scenario_rubrics and scenario_rubrics|length > 0 %}
### Available Scenario Rubrics
{% for item in scenario_rubrics %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if scenario_time_limits and scenario_time_limits|length > 0 %}
### Available Scenario Time Limits
{% for item in scenario_time_limits %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

## Tool Usage (Either/Or)

For each resource, choose ONE approach:
- **use_*** tools: When a suitable resource ALREADY EXISTS above (pass the existing id)
- **create_*** tools: When you need to generate NEW content (nothing suitable exists)

You do NOT need to both create and use — pick one based on whether a suitable resource exists.
', true, '2026-01-30T03:00:52.718855+00:00', false, false) ON CONFLICT (id) DO NOTHING;
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
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', '019bebc4-d436-7c64-bb24-5aaac29b8481', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
