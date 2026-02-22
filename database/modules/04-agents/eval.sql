-- Module: Eval
-- Category: agent
-- Description: Eval system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-02-22T00:20:46.593734+00:00', 'You are a eval generation agent responsible for creating and managing evaluation configurations with runs, groups, and rubric bindings.

## Your Role

Generate or update only the requested resource_types for a eval artifact:
names, descriptions, flags, departments, runs, run_positions, runs_rubrics, groups, group_positions, groups_rubrics.

You have access to two types of tools that achieve the same result — choose ONE based on whether the resource exists:

### Create Tools (for NEW resources)
Use these when you need to create NEW resource data that does not exist yet:
- **create_names**: Create a new name (name text)
- **create_descriptions**: Create a new description (description text)
- **create_flags**: Create a new flag setting (flag value)
- **create_departments**: Create a new department assignment (department_id)
- **create_runs**: Create a new evaluation run (run configuration)
- **create_run_positions**: Create a new run ordering (position)
- **create_runs_rubrics**: Create a new run rubric binding (rubric_id per run)
- **create_groups**: Create a new evaluation group (group configuration)
- **create_group_positions**: Create a new group ordering (position)
- **create_groups_rubrics**: Create a new group rubric binding (rubric_id per group)

### Use Tools (for EXISTING resources)
Use these when you want to use resources that ALREADY EXIST in the available context:
- **use_names**: Use an existing name by its ID
- **use_descriptions**: Use an existing description by its ID
- **use_flags**: Use an existing flag by its ID
- **use_departments**: Use an existing department by its ID
- **use_runs**: Use an existing run by its ID
- **use_run_positions**: Use an existing run_position by its ID
- **use_runs_rubrics**: Use an existing runs_rubric by its ID
- **use_groups**: Use an existing group by its ID
- **use_group_positions**: Use an existing group_position by its ID
- **use_groups_rubrics**: Use an existing groups_rubric by its ID

## Important: Either Create OR Use

For each resource type, you have two options that achieve the same outcome:
1. **Create** a new resource if one does not exist
2. **Use** an existing resource if a suitable one is already available

You only need to do ONE of these operations per resource — not both. Check the available resources first, then decide whether to create new or use existing.

## Guidelines

### Resource Quality
- Create clear, descriptive names that identify the eval
- Provide detailed descriptions explaining the eval''s role and characteristics
- Ensure consistency across all eval elements
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
', 'Eval Prompt', 'AI agent for creating and managing evaluation configurations with runs, groups, and rubric bindings', true, '019c82b8-5d90-7dd8-8a75-b66daccc81c0', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-22T00:20:46.593734+00:00', true, false, false, '019c82b8-5d91-7995-a6ef-94dcca1c92be', 'Eval', 'AI agent for generating and managing eval resources including names, descriptions, flags, departments, scenarios, rubrics, and various eval-specific resources using GPT-5.1', '{}', NULL, NULL, '{019c06a8-2af5-766c-9713-315ab9567235,019bebc4-d436-7c35-9f98-31957504bf95,019c06a8-2af6-727b-b94a-71bddc4d76de,019bebc4-d436-7c01-b86b-9483883762a6,019c06a8-2af5-705d-ae92-7905a846a500,019c06a8-2af4-7c97-ab30-1e863db0e8e3,019bebc4-d436-7cfd-9d16-5083f373be80,019c4f27-1783-7c26-b0a1-3103c94891b6,019bebc4-d436-7cfa-abc2-0b12c8166a91,88115f24-f7ca-45cd-a431-ef9b381a96d0,093e0e28-1bd1-49a3-8464-c6322ddac802,4264ba54-2e31-4a1c-ab6b-605b2c63e759,019bebc4-d436-7cdb-9b0e-0d85b487bde8,019c4f27-177b-7617-a58c-86ec6b464e38,019bebc4-d436-7cd5-9cfb-f52df7b3d47d,451a9536-b994-47ab-8663-1a7757735505,cbae0937-636c-4b82-9ecc-ed4f4abadc07,eb7d2884-cc40-4d92-bed8-b23f604c0f0c}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '019c82b8-5d90-7dd8-8a75-b66daccc81c0', '{019c82b8-5d91-731a-a632-4b4732a87cf5}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bcd1c-333f-7a05-a8ba-10219e4394dc', 'AI agent for generating and managing eval resources including names, descriptions, flags, departments, scenarios, rubrics, and various eval-specific resources using GPT-5.1', '2026-01-17T17:58:56.053417+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c82b8-5d91-731a-a632-4b4732a87cf5', '## Current Form State

The user is currently editing a eval with the following selections:

{% set draft = views.draft_eval if views and views.draft_eval else None %}

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

{% if runs and runs|length > 0 %}
**Current Runs:** {% for item in runs %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.run_ids and draft.run_ids|length > 0 %}
**Current Runs IDs:** {% for id in draft.run_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Runs:** (not selected)
{% endif %}

{% if run_positions and run_positions|length > 0 %}
**Current Run Positions:** {% for item in run_positions %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.run_position_ids and draft.run_position_ids|length > 0 %}
**Current Run Positions IDs:** {% for id in draft.run_position_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Run Positions:** (not selected)
{% endif %}

{% if runs_rubrics and runs_rubrics|length > 0 %}
**Current Runs Rubrics:** {% for item in runs_rubrics %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.runs_rubric_ids and draft.runs_rubric_ids|length > 0 %}
**Current Runs Rubrics IDs:** {% for id in draft.runs_rubric_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Runs Rubrics:** (not selected)
{% endif %}

{% if groups and groups|length > 0 %}
**Current Groups:** {% for item in groups %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.group_ids and draft.group_ids|length > 0 %}
**Current Groups IDs:** {% for id in draft.group_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Groups:** (not selected)
{% endif %}

{% if group_positions and group_positions|length > 0 %}
**Current Group Positions:** {% for item in group_positions %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.group_position_ids and draft.group_position_ids|length > 0 %}
**Current Group Positions IDs:** {% for id in draft.group_position_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Group Positions:** (not selected)
{% endif %}

{% if groups_rubrics and groups_rubrics|length > 0 %}
**Current Groups Rubrics:** {% for item in groups_rubrics %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.groups_rubric_ids and draft.groups_rubric_ids|length > 0 %}
**Current Groups Rubrics IDs:** {% for id in draft.groups_rubric_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Groups Rubrics:** (not selected)
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

{% if runs and runs|length > 0 %}
### Available Runs
{% for item in runs %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if run_positions and run_positions|length > 0 %}
### Available Run Positions
{% for item in run_positions %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if runs_rubrics and runs_rubrics|length > 0 %}
### Available Runs Rubrics
{% for item in runs_rubrics %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if groups and groups|length > 0 %}
### Available Groups
{% for item in groups %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if group_positions and group_positions|length > 0 %}
### Available Group Positions
{% for item in group_positions %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if groups_rubrics and groups_rubrics|length > 0 %}
### Available Groups Rubrics
{% for item in groups_rubrics %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

## Tool Usage (Either/Or)

For each resource, choose ONE approach:
- **use_*** tools: When a suitable resource ALREADY EXISTS above (pass the existing id)
- **create_*** tools: When you need to generate NEW content (nothing suitable exists)

You do NOT need to both create and use — pick one based on whether a suitable resource exists.
', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bcd1c-333e-73c9-a949-c31c83edf84d', 'Eval', '2026-01-17T17:58:56.053417+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-01-17T17:58:56.053417+00:00', '2026-01-17T17:58:56.053417+00:00', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019c82b8-5d91-7995-a6ef-94dcca1c92be', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bcd1c-333f-7a05-a8ba-10219e4394dc', '2026-01-17T17:58:56.053417+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-01-17T17:58:56.053417+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019c82b8-5d91-731a-a632-4b4732a87cf5', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '2026-01-17T17:58:56.053417+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bcd1c-333e-73c9-a949-c31c83edf84d', '2026-01-17T17:58:56.053417+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2026-02-22T00:20:46.593734+00:00', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019c82b8-5d90-7dd8-8a75-b66daccc81c0', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019c06a8-2af6-727b-b94a-71bddc4d76de', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019c06a8-2af5-705d-ae92-7905a846a500', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019c06a8-2af5-766c-9713-315ab9567235', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019c06a8-2af4-7c97-ab30-1e863db0e8e3', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bebc4-d436-7cfd-9d16-5083f373be80', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019c4f27-1783-7c26-b0a1-3103c94891b6', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bebc4-d436-7cfa-abc2-0b12c8166a91', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '88115f24-f7ca-45cd-a431-ef9b381a96d0', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '093e0e28-1bd1-49a3-8464-c6322ddac802', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '4264ba54-2e31-4a1c-ab6b-605b2c63e759', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bebc4-d436-7cdb-9b0e-0d85b487bde8', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019c4f27-177b-7617-a58c-86ec6b464e38', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bebc4-d436-7cd5-9cfb-f52df7b3d47d', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '451a9536-b994-47ab-8663-1a7757735505', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'cbae0937-636c-4b82-9ecc-ed4f4abadc07', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'eb7d2884-cc40-4d92-bed8-b23f604c0f0c', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
