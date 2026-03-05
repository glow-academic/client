-- Module: Invocation
-- Category: agent
-- Description: Invocation system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-02-22T00:20:46.593734+00:00', 'You are a invocation generation agent responsible for creating and managing benchmark invocations with model, prompt, and tool configurations for evaluation runs.

## Your Role

Generate or update only the requested resource_types for a invocation artifact:
names, descriptions, flags, departments, models, prompts, instructions, runs, groups, keys, tools, temperature_levels, reasoning_levels, voices.

You have access to two types of tools that achieve the same result — choose ONE based on whether the resource exists:

### Create Tools (for NEW resources)
Use these when you need to create NEW resource data that does not exist yet:
- **create_names**: Create a new name (name text)
- **create_descriptions**: Create a new description (description text)
- **create_flags**: Create a new flag setting (flag value)
- **create_departments**: Create a new department assignment (department_id)
- **create_models**: Create a new model binding (model_id)
- **create_prompts**: Create a new system prompt (system_prompt text)
- **create_instructions**: Create a new instruction template (template text)
- **create_runs**: Create a new evaluation run (run_id)
- **create_groups**: Create a new evaluation group (group_id)
- **create_keys**: Create a new API key binding (key_id)
- **create_tools**: Create a new tool binding (tool_id)
- **create_temperature_levels**: Create a new temperature level (level)
- **create_reasoning_levels**: Create a new reasoning level (level)
- **create_voices**: Create a new voice setting (voice)

### Use Tools (for EXISTING resources)
Use these when you want to use resources that ALREADY EXIST in the available context:
- **use_names**: Use an existing name by its ID
- **use_descriptions**: Use an existing description by its ID
- **use_flags**: Use an existing flag by its ID
- **use_departments**: Use an existing department by its ID
- **use_models**: Use an existing model by its ID
- **use_prompts**: Use an existing prompt by its ID
- **use_instructions**: Use an existing instruction by its ID
- **use_runs**: Use an existing run by its ID
- **use_groups**: Use an existing group by its ID
- **use_keys**: Use an existing key by its ID
- **use_tools**: Use an existing tool by its ID
- **use_temperature_levels**: Use an existing temperature_level by its ID
- **use_reasoning_levels**: Use an existing reasoning_level by its ID
- **use_voices**: Use an existing voice by its ID

## Important: Either Create OR Use

For each resource type, you have two options that achieve the same outcome:
1. **Create** a new resource if one does not exist
2. **Use** an existing resource if a suitable one is already available

You only need to do ONE of these operations per resource — not both. Check the available resources first, then decide whether to create new or use existing.

## Guidelines

### Resource Quality
- Create clear, descriptive names that identify the invocation
- Provide detailed descriptions explaining the invocation''s role and characteristics
- Ensure consistency across all invocation elements
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
', 'Invocation Prompt', 'AI agent for creating and managing benchmark invocations with model and tool configurations', true, '019c82b8-5d98-7325-a679-689f9e16dabc', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voices, model_id, prompt_id, instruction_ids) VALUES ('2026-02-22T00:20:46.593734+00:00', true, false, false, '019c82b8-5d98-7674-8cd4-2ed7bdddf354', 'Invocation', 'AI agent for creating and managing benchmark invocations with model and tool configurations', '{}', 0, 'none', '{019bebc4-d436-7cc0-a482-5c0fad4f04e9,019c4f27-1782-77f6-8e39-d193b8240237,019bebc4-d436-7ccc-9e9c-6f4b2a633f9d,209cfad1-69b5-40be-a980-406888376306,019c4f27-1784-7c83-a971-06d5405753dd,019bebc4-d436-7ccb-b52a-fa65793c95ce,a24eefa2-fe75-4619-ae36-7eb1ea8ba4aa,d9247def-16e8-4fff-b27e-a8af318a5dd9,5133b52b-e5ee-4f08-a9e0-f5b459ab8bea,019bebc4-d436-7c28-b7bf-f89de16c64d0,019c4f27-177b-7617-a58c-86ec6b464e38,019bebc4-d436-7cdb-9b0e-0d85b487bde8,019c4f27-1783-7c26-b0a1-3103c94891b6,019bebc4-d436-7cfd-9d16-5083f373be80,019c06a8-2af5-7f6a-aaa0-5a9aaa2ed10e,019bebc4-d436-7c20-b35a-73c9819b708a,b8d2fd18-ee1b-4564-b6f4-bbac30a9cbfc,3730b47a-aaf5-4531-81c5-fde207b9f77f,019c4f27-177f-7762-8c20-a2210565a69b,019bebc4-d436-7c2e-af8f-40ed4aa3edaf,019c06a8-2af4-7c97-ab30-1e863db0e8e3,019c06a8-2af5-766c-9713-315ab9567235,019c06a8-2af5-705d-ae92-7905a846a500,019bebc4-d436-7c01-b86b-9483883762a6,019c06a8-2af6-727b-b94a-71bddc4d76de,019bebc4-d436-7c35-9f98-31957504bf95}', NULL, '{}', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '019c82b8-5d98-7325-a679-689f9e16dabc', '{019c82b8-5d98-7498-9204-38405a4e7abe}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d98-789c-83a0-bf2e640749e3', 'AI agent for creating and managing benchmark invocations with model and tool configurations', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c82b8-5d98-7498-9204-38405a4e7abe', '## Current State
{% set draft = artifacts.invocation.get.entries.draft_invocation if artifacts.invocation.get.entries and artifacts.invocation.get.entries.draft_invocation else None %}
{% if draft and draft.name_ids and draft.name_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.invocation.get.resources.names if item.id|string in draft.name_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Names: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Names: ({{ draft.name_ids|length }} selected by ID){% endif %}{% else %}Names: (not set){% endif %}
{% if draft and draft.description_ids and draft.description_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.invocation.get.resources.descriptions if item.id|string in draft.description_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Descriptions: {% for item in selected %}{{ item.description[:100] }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Descriptions: ({{ draft.description_ids|length }} selected by ID){% endif %}{% else %}Descriptions: (not set){% endif %}
{% if draft and draft.flag_ids and draft.flag_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.invocation.get.resources.flags if item.flag_option_id|string in draft.flag_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Flags: {% for item in selected %}{{ item.label or item.key }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Flags: ({{ draft.flag_ids|length }} selected by ID){% endif %}{% else %}Flags: (not set){% endif %}
{% if draft and draft.department_ids and draft.department_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.invocation.get.resources.departments if item.department_id|string in draft.department_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Departments: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Departments: ({{ draft.department_ids|length }} selected by ID){% endif %}{% else %}Departments: (not set){% endif %}
{% if draft and draft.model_ids and draft.model_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.invocation.get.resources.models if item.id|string in draft.model_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Models: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Models: ({{ draft.model_ids|length }} selected by ID){% endif %}{% else %}Models: (not set){% endif %}
{% if draft and draft.prompt_ids and draft.prompt_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.invocation.get.resources.prompts if item.id|string in draft.prompt_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Prompts: {% for item in selected %}{{ item.system_prompt[:80] }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Prompts: ({{ draft.prompt_ids|length }} selected by ID){% endif %}{% else %}Prompts: (not set){% endif %}
{% if draft and draft.instruction_ids and draft.instruction_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.invocation.get.resources.instructions if item.id|string in draft.instruction_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Instructions: {% for item in selected %}{{ item.template[:80] }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Instructions: ({{ draft.instruction_ids|length }} selected by ID){% endif %}{% else %}Instructions: (not set){% endif %}
{% if draft and draft.run_ids and draft.run_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.invocation.get.resources.runs if item.id|string in draft.run_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Runs: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Runs: ({{ draft.run_ids|length }} selected by ID){% endif %}{% else %}Runs: (not set){% endif %}
{% if draft and draft.group_ids and draft.group_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.invocation.get.resources.groups if item.id|string in draft.group_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Groups: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Groups: ({{ draft.group_ids|length }} selected by ID){% endif %}{% else %}Groups: (not set){% endif %}
{% if draft and draft.key_ids and draft.key_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.invocation.get.resources.keys if item.id|string in draft.key_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Keys: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Keys: ({{ draft.key_ids|length }} selected by ID){% endif %}{% else %}Keys: (not set){% endif %}
{% if draft and draft.tool_ids and draft.tool_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.invocation.get.resources.tools if item.id|string in draft.tool_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Tools: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Tools: ({{ draft.tool_ids|length }} selected by ID){% endif %}{% else %}Tools: (not set){% endif %}
{% if draft and draft.temperature_level_ids and draft.temperature_level_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.invocation.get.resources.temperature_levels if item.id|string in draft.temperature_level_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Temperature Levels: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Temperature Levels: ({{ draft.temperature_level_ids|length }} selected by ID){% endif %}{% else %}Temperature Levels: (not set){% endif %}
{% if draft and draft.reasoning_level_ids and draft.reasoning_level_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.invocation.get.resources.reasoning_levels if item.id|string in draft.reasoning_level_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Reasoning Levels: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Reasoning Levels: ({{ draft.reasoning_level_ids|length }} selected by ID){% endif %}{% else %}Reasoning Levels: (not set){% endif %}
{% if draft and draft.voice_ids and draft.voice_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.invocation.get.resources.voices if item.id|string in draft.voice_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Voices: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Voices: ({{ draft.voice_ids|length }} selected by ID){% endif %}{% else %}Voices: (not set){% endif %}

---

{% set all_gen_types = (artifacts.invocation.get.resources.types or []) + (artifacts.invocation.get.entries.types or []) %}
## Available Resources
{% if "names" in all_gen_types and artifacts.invocation.get.resources.names and artifacts.invocation.get.resources.names|length > 0 %}
Names:
{% for item in artifacts.invocation.get.resources.names %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "descriptions" in all_gen_types and artifacts.invocation.get.resources.descriptions and artifacts.invocation.get.resources.descriptions|length > 0 %}
Descriptions:
{% for item in artifacts.invocation.get.resources.descriptions %}
- id: {{ item.id }} | {{ item.description[:100] }}{% if item.description|length > 100 %}...{% endif %}
{% endfor %}
{% endif %}
{% if "flags" in all_gen_types and artifacts.invocation.get.resources.flags and artifacts.invocation.get.resources.flags|length > 0 %}
Flags:
{% for item in artifacts.invocation.get.resources.flags %}
- id: {{ item.flag_option_id }} | {{ item.label or item.key }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}
{% if "departments" in all_gen_types and artifacts.invocation.get.resources.departments and artifacts.invocation.get.resources.departments|length > 0 %}
Departments:
{% for item in artifacts.invocation.get.resources.departments %}
- id: {{ item.department_id }} | {{ item.name }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}
{% if "models" in all_gen_types and artifacts.invocation.get.resources.models and artifacts.invocation.get.resources.models|length > 0 %}
Models:
{% for item in artifacts.invocation.get.resources.models %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "prompts" in all_gen_types and artifacts.invocation.get.resources.prompts and artifacts.invocation.get.resources.prompts|length > 0 %}
Prompts:
{% for item in artifacts.invocation.get.resources.prompts %}
- id: {{ item.id }} | {{ item.system_prompt[:80] }}{% if item.system_prompt|length > 80 %}...{% endif %}
{% endfor %}
{% endif %}
{% if "instructions" in all_gen_types and artifacts.invocation.get.resources.instructions and artifacts.invocation.get.resources.instructions|length > 0 %}
Instructions:
{% for item in artifacts.invocation.get.resources.instructions %}
- id: {{ item.id }} | {{ item.template[:80] }}{% if item.template|length > 80 %}...{% endif %}
{% endfor %}
{% endif %}
{% if "runs" in all_gen_types and artifacts.invocation.get.resources.runs and artifacts.invocation.get.resources.runs|length > 0 %}
Runs:
{% for item in artifacts.invocation.get.resources.runs %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "groups" in all_gen_types and artifacts.invocation.get.resources.groups and artifacts.invocation.get.resources.groups|length > 0 %}
Groups:
{% for item in artifacts.invocation.get.resources.groups %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "keys" in all_gen_types and artifacts.invocation.get.resources.keys and artifacts.invocation.get.resources.keys|length > 0 %}
Keys:
{% for item in artifacts.invocation.get.resources.keys %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "tools" in all_gen_types and artifacts.invocation.get.resources.tools and artifacts.invocation.get.resources.tools|length > 0 %}
Tools:
{% for item in artifacts.invocation.get.resources.tools %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "temperature_levels" in all_gen_types and artifacts.invocation.get.resources.temperature_levels and artifacts.invocation.get.resources.temperature_levels|length > 0 %}
Temperature Levels:
{% for item in artifacts.invocation.get.resources.temperature_levels %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "reasoning_levels" in all_gen_types and artifacts.invocation.get.resources.reasoning_levels and artifacts.invocation.get.resources.reasoning_levels|length > 0 %}
Reasoning Levels:
{% for item in artifacts.invocation.get.resources.reasoning_levels %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "voices" in all_gen_types and artifacts.invocation.get.resources.voices and artifacts.invocation.get.resources.voices|length > 0 %}
Voices:
{% for item in artifacts.invocation.get.resources.voices %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}

---

## Generating For
{% if artifacts.invocation.get.resources.types and artifacts.invocation.get.resources.types|length > 0 %}
Resource types (create or use): {{ artifacts.invocation.get.resources.types|join(", ") }}
{% endif %}
{% if artifacts.invocation.get.entries.types and artifacts.invocation.get.entries.types|length > 0 %}
Entry types (use only): {{ artifacts.invocation.get.entries.types|join(", ") }}
{% endif %}

Rules:
- For resource types: use_* when a suitable resource exists, create_* when nothing suitable exists
- For entry types: always use_* with IDs from available resources
- Only operate on the resource/entry types listed above
- Do not invent IDs — use IDs from available resources
', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d98-7822-b7c3-91e5f6a26030', 'Invocation', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-22T00:20:46.593734+00:00', '2026-02-22T00:20:46.593734+00:00', 'ab000001-0000-0000-0000-000000000001', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('ab000001-0000-0000-0000-000000000001', '019c82b8-5d98-7674-8cd4-2ed7bdddf354', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, active, created_at, generated, mcp)
SELECT 'ab000001-0000-0000-0000-000000000001', ar.model_id, true, '2026-02-22T00:20:46.593734+00:00', false, false
FROM public.agents_resource ar
WHERE ar.id = '019c82b8-5d98-7674-8cd4-2ed7bdddf354'
  AND ar.model_id IS NOT NULL
ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_reasoning_levels_junction
INSERT INTO public.agent_reasoning_levels_junction (agent_id, reasoning_level_id, active, created_at, generated, mcp)
SELECT 'ab000001-0000-0000-0000-000000000001', rlr.id, true, '2026-02-22T00:20:46.593734+00:00', false, false
FROM public.agents_resource ar
JOIN public.reasoning_levels_resource rlr
  ON rlr.reasoning_level = ar.reasoning
 AND rlr.active = true
WHERE ar.id = '019c82b8-5d98-7674-8cd4-2ed7bdddf354'
  AND ar.reasoning IS NOT NULL
ON CONFLICT (agent_id, reasoning_level_id) DO NOTHING;
-- agent_temperature_levels_junction
INSERT INTO public.agent_temperature_levels_junction (agent_id, temperature_level_id, active, created_at, generated, mcp)
SELECT 'ab000001-0000-0000-0000-000000000001', tlr.id, true, '2026-02-22T00:20:46.593734+00:00', false, false
FROM public.agents_resource ar
JOIN public.temperature_levels_resource tlr
  ON tlr.temperature = ar.temperature
 AND tlr.active = true
WHERE ar.id = '019c82b8-5d98-7674-8cd4-2ed7bdddf354'
  AND ar.temperature IS NOT NULL
ON CONFLICT (agent_id, temperature_level_id) DO NOTHING;
-- agent_voices_junction
INSERT INTO public.agent_voices_junction (agent_id, voice_id, active, created_at, generated, mcp)

SELECT DISTINCT 'ab000001-0000-0000-0000-000000000001'::uuid, vr.id, true, '2026-02-22T00:20:46.593734+00:00'::timestamptz, false, false
FROM public.agents_resource ar
JOIN unnest(COALESCE(ar.voices, ARRAY[]::text[])) AS v(voice) ON true
JOIN public.voices_resource vr
  ON vr.voice = v.voice
 AND vr.active = true
WHERE ar.id = '019c82b8-5d98-7674-8cd4-2ed7bdddf354'
ON CONFLICT (agent_id, voice_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('ab000001-0000-0000-0000-000000000001', '019c82b8-5d98-789c-83a0-bf2e640749e3', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, created_at, generated, mcp, active) VALUES ('ab000001-0000-0000-0000-000000000001', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('ab000001-0000-0000-0000-000000000001', '019c82b8-5d98-7822-b7c3-91e5f6a26030', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000001-0000-0000-0000-000000000001', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000001-0000-0000-0000-000000000001', '019c06a8-2af6-727b-b94a-71bddc4d76de', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000001-0000-0000-0000-000000000001', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000001-0000-0000-0000-000000000001', '019c06a8-2af5-705d-ae92-7905a846a500', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000001-0000-0000-0000-000000000001', '019c06a8-2af5-766c-9713-315ab9567235', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000001-0000-0000-0000-000000000001', '019c06a8-2af4-7c97-ab30-1e863db0e8e3', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000001-0000-0000-0000-000000000001', '019bebc4-d436-7c2e-af8f-40ed4aa3edaf', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000001-0000-0000-0000-000000000001', '019c4f27-177f-7762-8c20-a2210565a69b', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000001-0000-0000-0000-000000000001', '3730b47a-aaf5-4531-81c5-fde207b9f77f', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000001-0000-0000-0000-000000000001', 'b8d2fd18-ee1b-4564-b6f4-bbac30a9cbfc', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000001-0000-0000-0000-000000000001', '019bebc4-d436-7c20-b35a-73c9819b708a', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000001-0000-0000-0000-000000000001', '019c06a8-2af5-7f6a-aaa0-5a9aaa2ed10e', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000001-0000-0000-0000-000000000001', '019bebc4-d436-7cfd-9d16-5083f373be80', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000001-0000-0000-0000-000000000001', '019c4f27-1783-7c26-b0a1-3103c94891b6', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000001-0000-0000-0000-000000000001', '019bebc4-d436-7cdb-9b0e-0d85b487bde8', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000001-0000-0000-0000-000000000001', '019c4f27-177b-7617-a58c-86ec6b464e38', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000001-0000-0000-0000-000000000001', '019bebc4-d436-7c28-b7bf-f89de16c64d0', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000001-0000-0000-0000-000000000001', '5133b52b-e5ee-4f08-a9e0-f5b459ab8bea', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000001-0000-0000-0000-000000000001', 'd9247def-16e8-4fff-b27e-a8af318a5dd9', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000001-0000-0000-0000-000000000001', 'a24eefa2-fe75-4619-ae36-7eb1ea8ba4aa', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000001-0000-0000-0000-000000000001', '019bebc4-d436-7ccb-b52a-fa65793c95ce', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000001-0000-0000-0000-000000000001', '019c4f27-1784-7c83-a971-06d5405753dd', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000001-0000-0000-0000-000000000001', '019bebc4-d436-7cc0-a482-5c0fad4f04e9', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000001-0000-0000-0000-000000000001', '019c4f27-1782-77f6-8e39-d193b8240237', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000001-0000-0000-0000-000000000001', '019bebc4-d436-7ccc-9e9c-6f4b2a633f9d', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000001-0000-0000-0000-000000000001', '209cfad1-69b5-40be-a980-406888376306', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
