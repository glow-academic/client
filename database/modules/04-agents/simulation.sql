-- Module: Simulation
-- Category: agent
-- Description: Simulation system agent
-- ============================================================


-- Resource rows
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-13T03:41:54.664757+00:00', true, false, false, '019c5517-4673-775e-852f-114fee676a28', 'Simulation', 'AI agent for generating and managing simulation scenario resources including scenarios, scenario positions, scenario flags, and scenario rubric grade agents', '{}', NULL, NULL, '{019bebc4-d436-7c01-b86b-9483883762a6,019bebc4-d436-7cb0-a120-7762b81276c3,019bebc4-d436-7c7f-a1f3-9bc8a7bc70ba,019bebc4-d436-7c35-9f98-31957504bf95,019bebc4-d436-7d09-a5fb-d51eae133785,019c06a8-2af4-7c97-ab30-1e863db0e8e3,019c06a8-2af5-705d-ae92-7905a846a500,019c06a8-2af5-766c-9713-315ab9567235,019c06a8-2af6-727b-b94a-71bddc4d76de,019c0cd8-ad73-72dd-8a41-ea5b247384db,019c0cd8-ad73-7621-b92d-91764faa013e,019c0cd8-ad73-781f-a3aa-1f1049dd213c,019c0cd8-ad73-7a10-805f-28e22f591d29,019c0cd8-ad73-7b6f-b393-86ceeddd1beb}', NULL, NULL, '019bb25e-e5ff-7781-b262-7c33d17dec4f', '019c0cd8-ad7d-79da-8469-639662fc6a3f', '{019c0cd8-ad7e-785c-a3d5-6999d78c5b2c}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bb544-1328-7d59-8ae7-68bea0af451c', 'AI agent for generating and managing simulation scenario resources including scenarios, scenario positions, scenario flags, and scenario rubric grade agents', '2026-01-13T02:51:36.094810+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c0cd8-ad7e-785c-a3d5-6999d78c5b2c', '## Current Form State

The user is currently editing a simulation with the following selections:

{% set draft = views.draft_simulation if views and views.draft_simulation else None %}

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

{% if departments and departments|length > 0 %}
**Current Departments:** {% for dept in departments %}{{ dept.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.department_ids and draft.department_ids|length > 0 %}
**Current Department IDs:** {% for id in draft.department_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Departments:** (none selected)
{% endif %}

{% if flags and flags|length > 0 %}
**Current Flags:** {% for flag in flags %}{{ flag.label or flag.key }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.flag_ids and draft.flag_ids|length > 0 %}
**Current Flag IDs:** {% for id in draft.flag_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Flags:** (none selected)
{% endif %}

{% if scenarios and scenarios|length > 0 %}
**Current Scenarios:** {% for scenario in scenarios %}{{ scenario.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.scenario_ids and draft.scenario_ids|length > 0 %}
**Current Scenario IDs:** {% for id in draft.scenario_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Scenarios:** (none selected)
{% endif %}

{% if scenario_flags and scenario_flags|length > 0 %}
**Current Scenario Flags:** {{ scenario_flags|length }} configured
{% elif draft and draft.scenario_flag_ids and draft.scenario_flag_ids|length > 0 %}
**Current Scenario Flag IDs:** {% for id in draft.scenario_flag_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Scenario Flags:** (none configured)
{% endif %}

{% if scenario_positions and scenario_positions|length > 0 %}
**Current Scenario Positions:** {{ scenario_positions|length }} configured
{% elif draft and draft.scenario_position_ids and draft.scenario_position_ids|length > 0 %}
**Current Scenario Position IDs:** {% for id in draft.scenario_position_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Scenario Positions:** (none configured)
{% endif %}

{% if scenario_rubrics and scenario_rubrics|length > 0 %}
**Current Scenario Rubrics:** {{ scenario_rubrics|length }} configured
{% elif draft and draft.scenario_rubric_ids and draft.scenario_rubric_ids|length > 0 %}
**Current Scenario Rubric IDs:** {% for id in draft.scenario_rubric_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Scenario Rubrics:** (none configured)
{% endif %}

{% if scenario_time_limits and scenario_time_limits|length > 0 %}
**Current Scenario Time Limits:** {{ scenario_time_limits|length }} configured
{% elif draft and draft.scenario_time_limit_ids and draft.scenario_time_limit_ids|length > 0 %}
**Current Scenario Time Limit IDs:** {% for id in draft.scenario_time_limit_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Scenario Time Limits:** (none configured)
{% endif %}

---

## Available Context Resources

Choose one action per resource type:
- `use_*` when suitable resources already exist.
- `create_*` only when no suitable resources exist.

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

{% if departments and departments|length > 0 %}
### Available Departments
{% for dept in departments %}
- id: {{ dept.department_id }} | name: {{ dept.name }}
{% endfor %}
{% endif %}

{% if flags and flags|length > 0 %}
### Available Flags
{% for flag in flags %}
- id: {{ flag.flag_option_id or flag.id }} | name: {{ flag.label or flag.key }}
{% endfor %}
{% endif %}

{% if scenarios and scenarios|length > 0 %}
### Available Scenarios
{% for scenario in scenarios %}
- id: {{ scenario.scenario_id }} | name: {{ scenario.name }}
{% endfor %}
{% endif %}

{% if scenario_flags and scenario_flags|length > 0 %}
### Available Scenario Flag Configurations
{% for sf in scenario_flags %}
- id: {{ sf.id }} | scenario_id: {{ sf.scenario_id }} | flag_id: {{ sf.flag_id }}
{% endfor %}
{% endif %}

{% if scenario_positions and scenario_positions|length > 0 %}
### Available Scenario Positions
{% for sp in scenario_positions %}
- id: {{ sp.id }} | scenario_id: {{ sp.scenario_id }} | position: {{ sp.position }}
{% endfor %}
{% endif %}

{% if scenario_rubrics and scenario_rubrics|length > 0 %}
### Available Scenario Rubrics
{% for sr in scenario_rubrics %}
- id: {{ sr.id }} | scenario_id: {{ sr.scenario_id }} | rubric_id: {{ sr.rubric_id }}
{% endfor %}
{% endif %}

{% if scenario_time_limits and scenario_time_limits|length > 0 %}
### Available Scenario Time Limits
{% for stl in scenario_time_limits %}
- id: {{ stl.id }} | scenario_id: {{ stl.scenario_id }} | time_limit_seconds: {{ stl.time_limit_seconds }}
{% endfor %}
{% endif %}
', true, '2026-01-30T03:00:52.718855+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bb544-1328-7380-8dce-3092e322e289', 'Simulation', '2026-01-13T02:51:36.094810+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-01-30T03:00:52.718855+00:00', 'You are a simulation generation agent responsible for creating and managing simulation resources for AI-powered training simulations.

## Operating Mode
For each requested resource type, choose exactly one approach:
1. Use existing resources with `use_*` tools when suitable items already exist.
2. Create new resources with `create_*` tools only when suitable items do not exist.

## Resource Rules
- Reuse departments, flags, and scenarios when valid options exist.
- Keep names/descriptions and scenario configuration resources consistent with current draft state.
- For time configuration creation, `create_times` must reference the target `scenario_id` and produce `time_limit_seconds`.

## Tooling Rules
- Use only provided tools.
- Prefer deterministic IDs from context for `use_*` tools.
- Do not call both create and use for the same resource type unless required by dependencies.

## Quality Bar
- Names/descriptions should be specific and non-generic.
- Scenario flags/positions/rubrics/time limits must be internally consistent with selected scenarios.
- Keep outputs concise, structured, and directly actionable.
', 'Simulation Agent System Prompt', 'System prompt for simulation generation agents that create and manage simulation resources', true, '019c0cd8-ad7d-79da-8469-639662fc6a3f', false, false) ON CONFLICT (id) DO NOTHING;

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
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', '019bebc4-d436-7c7f-a1f3-9bc8a7bc70ba', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
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
