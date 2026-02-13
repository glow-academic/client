-- Module: Cohort
-- Category: agent
-- Description: Cohort system agent
-- ============================================================


-- Resource rows
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-13T03:41:54.664757+00:00', true, false, false, '019c5517-4673-7073-adf9-00c0bd4e21dc', 'Cohort', 'AI agent for generating and managing cohort resources including names, descriptions, flags, departments, personas, and scenarios using GPT-5.1', '{}', NULL, NULL, '{019bebc4-d436-7bf6-af0e-91e685a8f15e,019bebc4-d436-7c01-b86b-9483883762a6,019bebc4-d436-7c14-a42e-f45a12c4fdb0,019bebc4-d436-7c35-9f98-31957504bf95,019bebc4-d436-7c57-8749-ec4eb700f078,019bebc4-d436-7c72-8184-67ecec04e62e,019bebc4-d436-7d28-8f22-23d852477486}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '66666666-7777-7777-7777-666666666666', '{019c2f10-4100-7c00-8000-000000000001}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bcd1b-0ca2-77e8-97a1-0f329141d993', 'AI agent for generating and managing cohort resources including names, descriptions, flags, departments, personas, and scenarios using GPT-5.1', '2026-01-17T17:57:40.639882+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c2f10-4100-7c00-8000-000000000001', '## Current Form State

The user is currently editing a cohort with the following selections:

{% set draft = views.draft_cohort if views and views.draft_cohort else None %}

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

{% if simulations and simulations|length > 0 %}
**Current Simulations:** {% for simulation in simulations %}{{ simulation.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.simulation_ids and draft.simulation_ids|length > 0 %}
**Current Simulation IDs:** {% for id in draft.simulation_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Simulations:** (none selected)
{% endif %}

{% if simulation_positions and simulation_positions|length > 0 %}
**Current Simulation Positions:** {{ simulation_positions|length }} configured
{% elif draft and draft.simulation_position_ids and draft.simulation_position_ids|length > 0 %}
**Current Simulation Position IDs:** {% for id in draft.simulation_position_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Simulation Positions:** (none configured)
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
- id: {{ dept.department_id or dept.id }} | name: {{ dept.name }}
{% endfor %}
{% endif %}

{% if flags and flags|length > 0 %}
### Available Flags
{% for flag in flags %}
- id: {{ flag.flag_option_id or flag.id }} | name: {{ flag.label or flag.key or flag.name }}
{% endfor %}
{% endif %}

{% if simulations and simulations|length > 0 %}
### Available Simulations
{% for simulation in simulations %}
- id: {{ simulation.simulation_id or simulation.id }} | name: {{ simulation.name }}
{% endfor %}
{% endif %}

{% if simulation_positions and simulation_positions|length > 0 %}
### Available Simulation Positions
{% for sp in simulation_positions %}
- id: {{ sp.id }} | simulation_id: {{ sp.simulation_id }} | position: {{ sp.position or sp.value }}
{% endfor %}
{% endif %}
', true, '2026-02-10T19:10:26.375145+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bcd1b-0ca2-7561-91c1-190d15981938', 'Cohort', '2026-01-17T17:57:40.639882+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-01-17T17:57:40.639882+00:00', 'You are a cohort generation agent responsible for creating and managing cohort resources for AI-powered training simulations.

## Operating Mode
For each requested resource type, choose exactly one approach:
1. Use existing resources with `use_*` tools when suitable items already exist.
2. Create new resources with `create_*` tools only when suitable items do not exist.

## Resource Rules
- Reuse departments, flags, simulations, and simulation positions when valid options exist.
- Keep names/descriptions and simulation selections consistent with current draft state.
- Simulation position generation must produce consistent ordering values per selected simulation.

## Tooling Rules
- Use only provided tools.
- Prefer deterministic IDs from context for `use_*` tools.
- Do not call both create and use for the same resource type unless required by dependencies.

## Quality Bar
- Names/descriptions should be specific and non-generic.
- Simulation positions should be coherent with selected simulations and ordering intent.
- Keep outputs concise, structured, and directly actionable.
', 'Cohort Agent System Prompt', 'System prompt for cohort generation agents', true, '66666666-7777-7777-7777-666666666666', false, false) ON CONFLICT (id) DO NOTHING;

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
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('66666666-6666-6666-6666-666666666666', '019bebc4-d436-7bf6-af0e-91e685a8f15e', true, '2026-01-17T17:57:40.639882+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('66666666-6666-6666-6666-666666666666', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-01-17T17:57:40.639882+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('66666666-6666-6666-6666-666666666666', '019bebc4-d436-7c14-a42e-f45a12c4fdb0', true, '2026-01-17T17:57:40.639882+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('66666666-6666-6666-6666-666666666666', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-01-17T17:57:40.639882+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('66666666-6666-6666-6666-666666666666', '019bebc4-d436-7c57-8749-ec4eb700f078', true, '2026-01-17T17:57:40.639882+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('66666666-6666-6666-6666-666666666666', '019bebc4-d436-7c72-8184-67ecec04e62e', true, '2026-01-17T17:57:40.639882+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('66666666-6666-6666-6666-666666666666', '019bebc4-d436-7d28-8f22-23d852477486', true, '2026-01-19T21:43:11.312843+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
