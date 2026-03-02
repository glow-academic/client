-- Module: Simulation
-- Category: agent
-- Description: Simulation system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-01-30T03:00:52.718855+00:00', 'You are a simulation generation agent responsible for creating and managing simulation configurations with scenario orderings, rubrics, and time limits.

Your Role: Generate or update only the requested resource types for a simulation artifact.

Resource Guidance:
- names, descriptions: Strongly prefer creating new — these are typically unique to each simulation, but reuse if it genuinely fits
- scenario_flags, scenario_positions, scenario_rubrics, scenario_time_limits: Strongly prefer creating new — these are per-scenario configuration specific to this simulation, but reuse if suitable
- departments, flags, scenarios: Use existing from available context

Rules:
- For use-only resources: always use use_* tools with IDs from context
- Operate only on the resource/entry types specified in the developer instructions
- Do not invent IDs — use IDs from context
- Return only valid tool calls, no narrative text', 'Simulation Agent System Prompt', 'System prompt for simulation generation agents that create and manage simulation resources', true, '019c0cd8-ad7d-79da-8469-639662fc6a3f', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-13T03:41:54.664757+00:00', true, false, false, '019c5517-4673-775e-852f-114fee676a28', 'Simulation', 'AI agent for generating and managing simulation scenario resources including scenarios, scenario positions, scenario flags, and scenario rubric grade agents', '{}', NULL, NULL, '{019bebc4-d436-7c35-9f98-31957504bf95,019bebc4-d436-7cb0-a120-7762b81276c3,019bebc4-d436-7c01-b86b-9483883762a6,019bebc4-d436-7d09-a5fb-d51eae133785,019c06a8-2af5-766c-9713-315ab9567235,019c0cd8-ad73-72dd-8a41-ea5b247384db,019c0cd8-ad73-7621-b92d-91764faa013e,019c0cd8-ad73-781f-a3aa-1f1049dd213c,019c0cd8-ad73-7a10-805f-28e22f591d29,019c06a8-2af6-727b-b94a-71bddc4d76de,019c0cd8-ad73-7b6f-b393-86ceeddd1beb,019c06a8-2af4-7c97-ab30-1e863db0e8e3,019c06a8-2af5-705d-ae92-7905a846a500,7dc39eae-ae96-43d8-bf84-738d775b2780,71082313-23e6-428e-a32f-86ea85aad6bb,019523a0-0020-7000-8000-000000000002}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '019c0cd8-ad7d-79da-8469-639662fc6a3f', '{019c0cd8-ad7e-785c-a3d5-6999d78c5b2c}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bb544-1328-7d59-8ae7-68bea0af451c', 'AI agent for generating and managing simulation scenario resources including scenarios, scenario positions, scenario flags, and scenario rubric grade agents', '2026-01-13T02:51:36.094810+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c0cd8-ad7e-785c-a3d5-6999d78c5b2c', '## Current State
{% set draft = artifacts.simulation.get.entries.draft_simulation if artifacts.simulation.get.entries and artifacts.simulation.get.entries.draft_simulation else None %}
{% if draft and draft.name_ids and draft.name_ids|length > 0 %}{% set selected_names = [] %}{% for n in artifacts.simulation.get.resources.names if n.id|string in draft.name_ids|map("string")|list %}{% if selected_names.append(n) %}{% endif %}{% endfor %}{% if selected_names|length > 0 %}Names: {% for n in selected_names %}{{ n.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Names: ({{ draft.name_ids|length }} selected by ID){% endif %}{% else %}Names: (not set){% endif %}
{% if draft and draft.description_ids and draft.description_ids|length > 0 %}{% set selected_descs = [] %}{% for d in artifacts.simulation.get.resources.descriptions if d.id|string in draft.description_ids|map("string")|list %}{% if selected_descs.append(d) %}{% endif %}{% endfor %}{% if selected_descs|length > 0 %}Descriptions: {% for d in selected_descs %}{{ d.description[:100] }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Descriptions: ({{ draft.description_ids|length }} selected by ID){% endif %}{% else %}Descriptions: (not set){% endif %}
{% if draft and draft.flag_ids and draft.flag_ids|length > 0 %}{% set selected_flags = [] %}{% for f in artifacts.simulation.get.resources.flags if f.flag_option_id|string in draft.flag_ids|map("string")|list %}{% if selected_flags.append(f) %}{% endif %}{% endfor %}{% if selected_flags|length > 0 %}Flags: {% for f in selected_flags %}{{ f.label or f.key }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Flags: ({{ draft.flag_ids|length }} selected by ID){% endif %}{% else %}Flags: (not set){% endif %}
{% if draft and draft.department_ids and draft.department_ids|length > 0 %}{% set selected_depts = [] %}{% for d in artifacts.simulation.get.resources.departments if d.department_id|string in draft.department_ids|map("string")|list %}{% if selected_depts.append(d) %}{% endif %}{% endfor %}{% if selected_depts|length > 0 %}Departments: {% for d in selected_depts %}{{ d.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Departments: ({{ draft.department_ids|length }} selected by ID){% endif %}{% else %}Departments: (not set){% endif %}
{% if draft and draft.scenario_ids and draft.scenario_ids|length > 0 %}{% set selected_scenarios = [] %}{% for s in artifacts.simulation.get.resources.scenarios if s.scenario_id|string in draft.scenario_ids|map("string")|list %}{% if selected_scenarios.append(s) %}{% endif %}{% endfor %}{% if selected_scenarios|length > 0 %}Scenarios: {% for s in selected_scenarios %}{{ s.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Scenarios: ({{ draft.scenario_ids|length }} selected by ID){% endif %}{% else %}Scenarios: (not set){% endif %}
{% if draft and draft.scenario_flag_ids and draft.scenario_flag_ids|length > 0 %}Scenario Flags: {{ draft.scenario_flag_ids|length }} configured{% else %}Scenario Flags: (not set){% endif %}
{% if draft and draft.scenario_position_ids and draft.scenario_position_ids|length > 0 %}Scenario Positions: {{ draft.scenario_position_ids|length }} configured{% else %}Scenario Positions: (not set){% endif %}
{% if draft and draft.scenario_rubric_ids and draft.scenario_rubric_ids|length > 0 %}Scenario Rubrics: {{ draft.scenario_rubric_ids|length }} configured{% else %}Scenario Rubrics: (not set){% endif %}
{% if draft and draft.scenario_time_limit_ids and draft.scenario_time_limit_ids|length > 0 %}Scenario Time Limits: {{ draft.scenario_time_limit_ids|length }} configured{% else %}Scenario Time Limits: (not set){% endif %}

---

{% set all_gen_types = (artifacts.simulation.get.resources.types or []) + (artifacts.simulation.get.entries.types or []) %}
## Available Resources
{% if "names" in all_gen_types and artifacts.simulation.get.resources.names and artifacts.simulation.get.resources.names|length > 0 %}
Names:
{% for item in artifacts.simulation.get.resources.names %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "descriptions" in all_gen_types and artifacts.simulation.get.resources.descriptions and artifacts.simulation.get.resources.descriptions|length > 0 %}
Descriptions:
{% for item in artifacts.simulation.get.resources.descriptions %}
- id: {{ item.id }} | {{ item.description[:100] }}{% if item.description|length > 100 %}...{% endif %}
{% endfor %}
{% endif %}
{% if "departments" in all_gen_types and artifacts.simulation.get.resources.departments and artifacts.simulation.get.resources.departments|length > 0 %}
Departments:
{% for item in artifacts.simulation.get.resources.departments %}
- id: {{ item.department_id }} | {{ item.name }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}
{% if "flags" in all_gen_types and artifacts.simulation.get.resources.flags and artifacts.simulation.get.resources.flags|length > 0 %}
Flags:
{% for item in artifacts.simulation.get.resources.flags %}
- id: {{ item.flag_option_id }} | {{ item.label or item.key }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}
{% if "scenarios" in all_gen_types and artifacts.simulation.get.resources.scenarios and artifacts.simulation.get.resources.scenarios|length > 0 %}
Scenarios:
{% for item in artifacts.simulation.get.resources.scenarios %}
- id: {{ item.scenario_id }} | {{ item.name }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}
{% if "scenario_flags" in all_gen_types and artifacts.simulation.get.resources.scenario_flags and artifacts.simulation.get.resources.scenario_flags|length > 0 %}
Scenario Flags:
{% for item in artifacts.simulation.get.resources.scenario_flags %}
- id: {{ item.id }} | scenario_id: {{ item.scenario_id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "scenario_positions" in all_gen_types and artifacts.simulation.get.resources.scenario_positions and artifacts.simulation.get.resources.scenario_positions|length > 0 %}
Scenario Positions:
{% for item in artifacts.simulation.get.resources.scenario_positions %}
- id: {{ item.id }} | scenario_id: {{ item.scenario_id }} | value: {{ item.value }}
{% endfor %}
{% endif %}
{% if "scenario_rubrics" in all_gen_types and artifacts.simulation.get.resources.scenario_rubrics and artifacts.simulation.get.resources.scenario_rubrics|length > 0 %}
Scenario Rubrics:
{% for item in artifacts.simulation.get.resources.scenario_rubrics %}
- id: {{ item.id }} | scenario_id: {{ item.scenario_id }} | rubric_id: {{ item.rubric_id }}
{% endfor %}
{% endif %}
{% if "scenario_time_limits" in all_gen_types and artifacts.simulation.get.resources.scenario_time_limits and artifacts.simulation.get.resources.scenario_time_limits|length > 0 %}
Scenario Time Limits:
{% for item in artifacts.simulation.get.resources.scenario_time_limits %}
- id: {{ item.id }} | scenario_id: {{ item.scenario_id }} | {{ item.time_limit_seconds }}s
{% endfor %}
{% endif %}

---

## Generating For
{% if artifacts.simulation.get.resources.types and artifacts.simulation.get.resources.types|length > 0 %}
Resource types (create or use): {{ artifacts.simulation.get.resources.types|join(", ") }}
{% endif %}
{% if artifacts.simulation.get.entries.types and artifacts.simulation.get.entries.types|length > 0 %}
Entry types (use only): {{ artifacts.simulation.get.entries.types|join(", ") }}
{% endif %}

Rules:
- For resource types: use_* when a suitable resource exists, create_* when nothing suitable exists
- For entry types: always use_* with IDs from available resources
- Only operate on the resource/entry types listed above
- Do not invent IDs — use IDs from available resources', true, '2026-01-30T03:00:52.718855+00:00', false, false) ON CONFLICT (id) DO NOTHING;
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
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', '019bb544-1328-7380-8dce-3092e322e289', '2026-01-13T02:51:36.094810+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
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
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', '019523a0-0020-7000-8000-000000000002', true, '2026-02-24T13:16:34.035984+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
