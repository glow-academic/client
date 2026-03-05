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
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voices, model_id, prompt_id, instruction_ids) VALUES ('2026-02-22T00:20:46.593734+00:00', true, false, false, '019c82b8-5d91-7995-a6ef-94dcca1c92be', 'Eval', 'AI agent for generating and managing eval resources including names, descriptions, flags, departments, scenarios, rubrics, and various eval-specific resources using GPT-5.1', '{}', 0, 'none', '{019bebc4-d436-7cdb-9b0e-0d85b487bde8,cbae0937-636c-4b82-9ecc-ed4f4abadc07,019c06a8-2af6-727b-b94a-71bddc4d76de,4264ba54-2e31-4a1c-ab6b-605b2c63e759,019bebc4-d436-7c01-b86b-9483883762a6,019c06a8-2af5-705d-ae92-7905a846a500,019c06a8-2af5-766c-9713-315ab9567235,019c06a8-2af4-7c97-ab30-1e863db0e8e3,019bebc4-d436-7cfd-9d16-5083f373be80,019c4f27-1783-7c26-b0a1-3103c94891b6,019bebc4-d436-7cfa-abc2-0b12c8166a91,88115f24-f7ca-45cd-a431-ef9b381a96d0,eb7d2884-cc40-4d92-bed8-b23f604c0f0c,093e0e28-1bd1-49a3-8464-c6322ddac802,451a9536-b994-47ab-8663-1a7757735505,019bebc4-d436-7cd5-9cfb-f52df7b3d47d,019c4f27-177b-7617-a58c-86ec6b464e38,019bebc4-d436-7c35-9f98-31957504bf95}', NULL, '{}', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '019c82b8-5d90-7dd8-8a75-b66daccc81c0', '{019c82b8-5d91-731a-a632-4b4732a87cf5}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bcd1c-333f-7a05-a8ba-10219e4394dc', 'AI agent for generating and managing eval resources including names, descriptions, flags, departments, scenarios, rubrics, and various eval-specific resources using GPT-5.1', '2026-01-17T17:58:56.053417+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c82b8-5d91-731a-a632-4b4732a87cf5', '## Current State
{% set draft = artifacts.eval.get.entries.draft_eval if artifacts.eval.get.entries and artifacts.eval.get.entries.draft_eval else None %}
{% if draft and draft.name_ids and draft.name_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.eval.get.resources.names if item.id|string in draft.name_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Names: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Names: ({{ draft.name_ids|length }} selected by ID){% endif %}{% else %}Names: (not set){% endif %}
{% if draft and draft.description_ids and draft.description_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.eval.get.resources.descriptions if item.id|string in draft.description_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Descriptions: {% for item in selected %}{{ item.description[:100] }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Descriptions: ({{ draft.description_ids|length }} selected by ID){% endif %}{% else %}Descriptions: (not set){% endif %}
{% if draft and draft.flag_ids and draft.flag_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.eval.get.resources.flags if item.flag_option_id|string in draft.flag_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Flags: {% for item in selected %}{{ item.label or item.key }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Flags: ({{ draft.flag_ids|length }} selected by ID){% endif %}{% else %}Flags: (not set){% endif %}
{% if draft and draft.department_ids and draft.department_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.eval.get.resources.departments if item.department_id|string in draft.department_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Departments: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Departments: ({{ draft.department_ids|length }} selected by ID){% endif %}{% else %}Departments: (not set){% endif %}
{% if draft and draft.run_ids and draft.run_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.eval.get.resources.runs if item.id|string in draft.run_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Runs: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Runs: ({{ draft.run_ids|length }} selected by ID){% endif %}{% else %}Runs: (not set){% endif %}
{% if draft and draft.run_position_ids and draft.run_position_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.eval.get.resources.run_positions if item.id|string in draft.run_position_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Run Positions: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Run Positions: ({{ draft.run_position_ids|length }} selected by ID){% endif %}{% else %}Run Positions: (not set){% endif %}
{% if draft and draft.runs_rubric_ids and draft.runs_rubric_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.eval.get.resources.runs_rubrics if item.id|string in draft.runs_rubric_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Runs Rubrics: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Runs Rubrics: ({{ draft.runs_rubric_ids|length }} selected by ID){% endif %}{% else %}Runs Rubrics: (not set){% endif %}
{% if draft and draft.group_ids and draft.group_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.eval.get.resources.groups if item.id|string in draft.group_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Groups: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Groups: ({{ draft.group_ids|length }} selected by ID){% endif %}{% else %}Groups: (not set){% endif %}
{% if draft and draft.group_position_ids and draft.group_position_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.eval.get.resources.group_positions if item.id|string in draft.group_position_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Group Positions: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Group Positions: ({{ draft.group_position_ids|length }} selected by ID){% endif %}{% else %}Group Positions: (not set){% endif %}
{% if draft and draft.groups_rubric_ids and draft.groups_rubric_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.eval.get.resources.groups_rubrics if item.id|string in draft.groups_rubric_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Groups Rubrics: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Groups Rubrics: ({{ draft.groups_rubric_ids|length }} selected by ID){% endif %}{% else %}Groups Rubrics: (not set){% endif %}

---

{% set all_gen_types = (artifacts.eval.get.resources.types or []) + (artifacts.eval.get.entries.types or []) %}
## Available Resources
{% if "names" in all_gen_types and artifacts.eval.get.resources.names and artifacts.eval.get.resources.names|length > 0 %}
Names:
{% for item in artifacts.eval.get.resources.names %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "descriptions" in all_gen_types and artifacts.eval.get.resources.descriptions and artifacts.eval.get.resources.descriptions|length > 0 %}
Descriptions:
{% for item in artifacts.eval.get.resources.descriptions %}
- id: {{ item.id }} | {{ item.description[:100] }}{% if item.description|length > 100 %}...{% endif %}
{% endfor %}
{% endif %}
{% if "flags" in all_gen_types and artifacts.eval.get.resources.flags and artifacts.eval.get.resources.flags|length > 0 %}
Flags:
{% for item in artifacts.eval.get.resources.flags %}
- id: {{ item.flag_option_id }} | {{ item.label or item.key }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}
{% if "departments" in all_gen_types and artifacts.eval.get.resources.departments and artifacts.eval.get.resources.departments|length > 0 %}
Departments:
{% for item in artifacts.eval.get.resources.departments %}
- id: {{ item.department_id }} | {{ item.name }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}
{% if "runs" in all_gen_types and artifacts.eval.get.resources.runs and artifacts.eval.get.resources.runs|length > 0 %}
Runs:
{% for item in artifacts.eval.get.resources.runs %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "run_positions" in all_gen_types and artifacts.eval.get.resources.run_positions and artifacts.eval.get.resources.run_positions|length > 0 %}
Run Positions:
{% for item in artifacts.eval.get.resources.run_positions %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "runs_rubrics" in all_gen_types and artifacts.eval.get.resources.runs_rubrics and artifacts.eval.get.resources.runs_rubrics|length > 0 %}
Runs Rubrics:
{% for item in artifacts.eval.get.resources.runs_rubrics %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "groups" in all_gen_types and artifacts.eval.get.resources.groups and artifacts.eval.get.resources.groups|length > 0 %}
Groups:
{% for item in artifacts.eval.get.resources.groups %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "group_positions" in all_gen_types and artifacts.eval.get.resources.group_positions and artifacts.eval.get.resources.group_positions|length > 0 %}
Group Positions:
{% for item in artifacts.eval.get.resources.group_positions %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "groups_rubrics" in all_gen_types and artifacts.eval.get.resources.groups_rubrics and artifacts.eval.get.resources.groups_rubrics|length > 0 %}
Groups Rubrics:
{% for item in artifacts.eval.get.resources.groups_rubrics %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}

---

## Generating For
{% if artifacts.eval.get.resources.types and artifacts.eval.get.resources.types|length > 0 %}
Resource types (create or use): {{ artifacts.eval.get.resources.types|join(", ") }}
{% endif %}
{% if artifacts.eval.get.entries.types and artifacts.eval.get.entries.types|length > 0 %}
Entry types (use only): {{ artifacts.eval.get.entries.types|join(", ") }}
{% endif %}

Rules:
- For resource types: use_* when a suitable resource exists, create_* when nothing suitable exists
- For entry types: always use_* with IDs from available resources
- Only operate on the resource/entry types listed above
- Do not invent IDs — use IDs from available resources
', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bcd1c-333e-73c9-a949-c31c83edf84d', 'Eval', '2026-01-17T17:58:56.053417+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-01-17T17:58:56.053417+00:00', '2026-01-17T17:58:56.053417+00:00', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019c82b8-5d91-7995-a6ef-94dcca1c92be', '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, active, created_at, generated, mcp)
SELECT 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', ar.model_id, true, '2026-02-22T00:20:46.593734+00:00', false, false
FROM public.agents_resource ar
WHERE ar.id = '019c82b8-5d91-7995-a6ef-94dcca1c92be'
  AND ar.model_id IS NOT NULL
ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_reasoning_levels_junction
INSERT INTO public.agent_reasoning_levels_junction (agent_id, reasoning_level_id, active, created_at, generated, mcp)
SELECT 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', rlr.id, true, '2026-02-22T00:20:46.593734+00:00', false, false
FROM public.agents_resource ar
JOIN public.reasoning_levels_resource rlr
  ON rlr.reasoning_level = ar.reasoning
 AND rlr.active = true
WHERE ar.id = '019c82b8-5d91-7995-a6ef-94dcca1c92be'
  AND ar.reasoning IS NOT NULL
ON CONFLICT (agent_id, reasoning_level_id) DO NOTHING;
-- agent_temperature_levels_junction
INSERT INTO public.agent_temperature_levels_junction (agent_id, temperature_level_id, active, created_at, generated, mcp)
SELECT 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', tlr.id, true, '2026-02-22T00:20:46.593734+00:00', false, false
FROM public.agents_resource ar
JOIN public.temperature_levels_resource tlr
  ON tlr.temperature = ar.temperature
 AND tlr.active = true
WHERE ar.id = '019c82b8-5d91-7995-a6ef-94dcca1c92be'
  AND ar.temperature IS NOT NULL
ON CONFLICT (agent_id, temperature_level_id) DO NOTHING;
-- agent_voices_junction
INSERT INTO public.agent_voices_junction (agent_id, voice_id, active, created_at, generated, mcp)

SELECT DISTINCT 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid, vr.id, true, '2026-02-22T00:20:46.593734+00:00'::timestamptz, false, false
FROM public.agents_resource ar
JOIN unnest(COALESCE(ar.voices, ARRAY[]::text[])) AS v(voice) ON true
JOIN public.voices_resource vr
  ON vr.voice = v.voice
 AND vr.active = true
WHERE ar.id = '019c82b8-5d91-7995-a6ef-94dcca1c92be'
ON CONFLICT (agent_id, voice_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bcd1c-333f-7a05-a8ba-10219e4394dc', '2026-01-17T17:58:56.053417+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, created_at, generated, mcp, active) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', '2026-01-17T17:58:56.053417+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bcd1c-333e-73c9-a949-c31c83edf84d', '2026-01-17T17:58:56.053417+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bebc4-d436-7c35-9f98-31957504bf95', '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019c06a8-2af6-727b-b94a-71bddc4d76de', '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bebc4-d436-7c01-b86b-9483883762a6', '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019c06a8-2af5-705d-ae92-7905a846a500', '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019c06a8-2af5-766c-9713-315ab9567235', '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019c06a8-2af4-7c97-ab30-1e863db0e8e3', '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bebc4-d436-7cfd-9d16-5083f373be80', '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019c4f27-1783-7c26-b0a1-3103c94891b6', '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bebc4-d436-7cfa-abc2-0b12c8166a91', '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '88115f24-f7ca-45cd-a431-ef9b381a96d0', '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '093e0e28-1bd1-49a3-8464-c6322ddac802', '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '4264ba54-2e31-4a1c-ab6b-605b2c63e759', '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bebc4-d436-7cdb-9b0e-0d85b487bde8', '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019c4f27-177b-7617-a58c-86ec6b464e38', '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bebc4-d436-7cd5-9cfb-f52df7b3d47d', '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '451a9536-b994-47ab-8663-1a7757735505', '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'cbae0937-636c-4b82-9ecc-ed4f4abadc07', '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'eb7d2884-cc40-4d92-bed8-b23f604c0f0c', '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
