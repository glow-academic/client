-- Module: Agent
-- Category: agent
-- Description: Agent system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-01-17T17:57:40.643852+00:00', 'You are a agent generation agent responsible for creating and managing AI agents with models, prompts, instructions, and tool bindings.

## Your Role

Generate or update only the requested resource_types for a agent artifact:
names, descriptions, models, prompts, instructions, flags, departments, tools, temperature_levels, reasoning_levels, voices.

You have access to two types of tools that achieve the same result — choose ONE based on whether the resource exists:

### Create Tools (for NEW resources)
Use these when you need to create NEW resource data that does not exist yet:
- **create_names**: Create a new name (name text)
- **create_descriptions**: Create a new description (description text)
- **create_models**: Create a new model binding (model_id)
- **create_prompts**: Create a new system prompt (system_prompt text)
- **create_instructions**: Create a new instruction template (template text)
- **create_flags**: Create a new flag setting (flag value)
- **create_departments**: Create a new department assignment (department_id)
- **create_tools**: Create a new tool binding (tool_id)
- **create_temperature_levels**: Create a new temperature level (level)
- **create_reasoning_levels**: Create a new reasoning level (level)
- **create_voices**: Create a new voice setting (voice)

### Use Tools (for EXISTING resources)
Use these when you want to use resources that ALREADY EXIST in the available context:
- **use_names**: Use an existing name by its ID
- **use_descriptions**: Use an existing description by its ID
- **use_models**: Use an existing model by its ID
- **use_prompts**: Use an existing prompt by its ID
- **use_instructions**: Use an existing instruction by its ID
- **use_flags**: Use an existing flag by its ID
- **use_departments**: Use an existing department by its ID
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
- Create clear, descriptive names that identify the agent
- Provide detailed descriptions explaining the agent''s role and characteristics
- Ensure consistency across all agent elements
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
', 'Agent Agent System Prompt', 'System prompt for agent generation agents', true, '88888888-9999-9999-9999-888888888888', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voices, model_id, prompt_id, instruction_ids) VALUES ('2026-02-13T03:41:54.664757+00:00', true, false, false, '019c5517-4670-7a06-8b57-8d054f851772', 'Agent', 'AI agent for generating and managing agent resources including names, descriptions, flags, departments, prompts, instructions, models, and tools using GPT-5.1', '{}', 0, 'none', '{019bebc4-d436-7bc7-a392-37e8b4549478,019bebc4-d436-7c2e-af8f-40ed4aa3edaf,019bebc4-d436-7c35-9f98-31957504bf95,019bebc4-d436-7cc0-a482-5c0fad4f04e9,019bebc4-d436-7ccb-b52a-fa65793c95ce,019bebc4-d436-7ccc-9e9c-6f4b2a633f9d,019bebc4-d436-7c01-b86b-9483883762a6,019bebc4-d436-7c20-b35a-73c9819b708a,019c06a8-2af5-766c-9713-315ab9567235,019c06a8-2af5-705d-ae92-7905a846a500,019c06a8-2af4-7c97-ab30-1e863db0e8e3,d9247def-16e8-4fff-b27e-a8af318a5dd9,3730b47a-aaf5-4531-81c5-fde207b9f77f,019c06a8-2af6-727b-b94a-71bddc4d76de,b8d2fd18-ee1b-4564-b6f4-bbac30a9cbfc,019c4f27-1782-77f6-8e39-d193b8240237,019c4f27-1784-7c83-a971-06d5405753dd,a24eefa2-fe75-4619-ae36-7eb1ea8ba4aa,209cfad1-69b5-40be-a980-406888376306,019c4f27-177f-7762-8c20-a2210565a69b,019c06a8-2af5-7f6a-aaa0-5a9aaa2ed10e}', NULL, '{}', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '88888888-9999-9999-9999-888888888888', '{019c2f13-4200-7c00-8000-000000000001}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bcd1b-0ca6-789c-9a76-7890886df5e7', 'AI agent for generating and managing agent resources including names, descriptions, flags, departments, prompts, instructions, models, and tools using GPT-5.1', '2026-01-17T17:57:40.643852+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c2f13-4200-7c00-8000-000000000001', '## Current State
{% set draft = artifacts.agent.get.entries.draft_agent if artifacts.agent.get.entries and artifacts.agent.get.entries.draft_agent else None %}
{% if draft and draft.name_ids and draft.name_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.agent.get.resources.names if item.id|string in draft.name_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Names: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Names: ({{ draft.name_ids|length }} selected by ID){% endif %}{% else %}Names: (not set){% endif %}
{% if draft and draft.description_ids and draft.description_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.agent.get.resources.descriptions if item.id|string in draft.description_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Descriptions: {% for item in selected %}{{ item.description[:100] }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Descriptions: ({{ draft.description_ids|length }} selected by ID){% endif %}{% else %}Descriptions: (not set){% endif %}
{% if draft and draft.model_ids and draft.model_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.agent.get.resources.models if item.id|string in draft.model_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Models: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Models: ({{ draft.model_ids|length }} selected by ID){% endif %}{% else %}Models: (not set){% endif %}
{% if draft and draft.prompt_ids and draft.prompt_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.agent.get.resources.prompts if item.id|string in draft.prompt_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Prompts: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Prompts: ({{ draft.prompt_ids|length }} selected by ID){% endif %}{% else %}Prompts: (not set){% endif %}
{% if draft and draft.instruction_ids and draft.instruction_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.agent.get.resources.instructions if item.id|string in draft.instruction_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Instructions: {% for item in selected %}{{ item.template[:80] }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Instructions: ({{ draft.instruction_ids|length }} selected by ID){% endif %}{% else %}Instructions: (not set){% endif %}
{% if draft and draft.flag_ids and draft.flag_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.agent.get.resources.flags if item.flag_option_id|string in draft.flag_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Flags: {% for item in selected %}{{ item.label or item.key }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Flags: ({{ draft.flag_ids|length }} selected by ID){% endif %}{% else %}Flags: (not set){% endif %}
{% if draft and draft.department_ids and draft.department_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.agent.get.resources.departments if item.department_id|string in draft.department_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Departments: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Departments: ({{ draft.department_ids|length }} selected by ID){% endif %}{% else %}Departments: (not set){% endif %}
{% if draft and draft.tool_ids and draft.tool_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.agent.get.resources.tools if item.id|string in draft.tool_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Tools: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Tools: ({{ draft.tool_ids|length }} selected by ID){% endif %}{% else %}Tools: (not set){% endif %}
{% if draft and draft.temperature_level_ids and draft.temperature_level_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.agent.get.resources.temperature_levels if item.id|string in draft.temperature_level_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Temperature Levels: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Temperature Levels: ({{ draft.temperature_level_ids|length }} selected by ID){% endif %}{% else %}Temperature Levels: (not set){% endif %}
{% if draft and draft.reasoning_level_ids and draft.reasoning_level_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.agent.get.resources.reasoning_levels if item.id|string in draft.reasoning_level_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Reasoning Levels: {% for item in selected %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Reasoning Levels: ({{ draft.reasoning_level_ids|length }} selected by ID){% endif %}{% else %}Reasoning Levels: (not set){% endif %}
{% if draft and draft.voice_ids and draft.voice_ids|length > 0 %}{% set selected = [] %}{% for item in artifacts.agent.get.resources.voices if item.id|string in draft.voice_ids|map("string")|list %}{% if selected.append(item) %}{% endif %}{% endfor %}{% if selected|length > 0 %}Voices: {% for item in selected %}{{ item.voice }}{% if not loop.last %}, {% endif %}{% endfor %}{% else %}Voices: ({{ draft.voice_ids|length }} selected by ID){% endif %}{% else %}Voices: (not set){% endif %}

---

{% set all_gen_types = (artifacts.agent.get.resources.types or []) + (artifacts.agent.get.entries.types or []) %}
## Available Resources
{% if "names" in all_gen_types and artifacts.agent.get.resources.names and artifacts.agent.get.resources.names|length > 0 %}
Names:
{% for item in artifacts.agent.get.resources.names %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "descriptions" in all_gen_types and artifacts.agent.get.resources.descriptions and artifacts.agent.get.resources.descriptions|length > 0 %}
Descriptions:
{% for item in artifacts.agent.get.resources.descriptions %}
- id: {{ item.id }} | {{ item.description[:100] }}{% if item.description|length > 100 %}...{% endif %}
{% endfor %}
{% endif %}
{% if "models" in all_gen_types and artifacts.agent.get.resources.models and artifacts.agent.get.resources.models|length > 0 %}
Models:
{% for item in artifacts.agent.get.resources.models %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "prompts" in all_gen_types and artifacts.agent.get.resources.prompts and artifacts.agent.get.resources.prompts|length > 0 %}
Prompts:
{% for item in artifacts.agent.get.resources.prompts %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "instructions" in all_gen_types and artifacts.agent.get.resources.instructions and artifacts.agent.get.resources.instructions|length > 0 %}
Instructions:
{% for item in artifacts.agent.get.resources.instructions %}
- id: {{ item.id }} | {{ item.template[:80] }}{% if item.template|length > 80 %}...{% endif %}
{% endfor %}
{% endif %}
{% if "flags" in all_gen_types and artifacts.agent.get.resources.flags and artifacts.agent.get.resources.flags|length > 0 %}
Flags:
{% for item in artifacts.agent.get.resources.flags %}
- id: {{ item.flag_option_id }} | {{ item.label or item.key }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}
{% if "departments" in all_gen_types and artifacts.agent.get.resources.departments and artifacts.agent.get.resources.departments|length > 0 %}
Departments:
{% for item in artifacts.agent.get.resources.departments %}
- id: {{ item.department_id }} | {{ item.name }}{% if item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}
{% if "tools" in all_gen_types and artifacts.agent.get.resources.tools and artifacts.agent.get.resources.tools|length > 0 %}
Tools:
{% for item in artifacts.agent.get.resources.tools %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "temperature_levels" in all_gen_types and artifacts.agent.get.resources.temperature_levels and artifacts.agent.get.resources.temperature_levels|length > 0 %}
Temperature Levels:
{% for item in artifacts.agent.get.resources.temperature_levels %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "reasoning_levels" in all_gen_types and artifacts.agent.get.resources.reasoning_levels and artifacts.agent.get.resources.reasoning_levels|length > 0 %}
Reasoning Levels:
{% for item in artifacts.agent.get.resources.reasoning_levels %}
- id: {{ item.id }} | {{ item.name }}
{% endfor %}
{% endif %}
{% if "voices" in all_gen_types and artifacts.agent.get.resources.voices and artifacts.agent.get.resources.voices|length > 0 %}
Voices:
{% for item in artifacts.agent.get.resources.voices %}
- id: {{ item.id }} | {{ item.voice }}
{% endfor %}
{% endif %}

---

## Generating For
{% if artifacts.agent.get.resources.types and artifacts.agent.get.resources.types|length > 0 %}
Resource types (create or use): {{ artifacts.agent.get.resources.types|join(", ") }}
{% endif %}
{% if artifacts.agent.get.entries.types and artifacts.agent.get.entries.types|length > 0 %}
Entry types (use only): {{ artifacts.agent.get.entries.types|join(", ") }}
{% endif %}

Rules:
- For resource types: use_* when a suitable resource exists, create_* when nothing suitable exists
- For entry types: always use_* with IDs from available resources
- Only operate on the resource/entry types listed above
- Do not invent IDs — use IDs from available resources
', true, '2026-02-10T19:12:47.645232+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bcd1b-0ca6-75a6-8b1c-c88ec47260b2', 'Agent', '2026-01-17T17:57:40.643852+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-01-17T17:57:40.643852+00:00', '2026-01-17T17:57:40.643852+00:00', '88888888-8888-8888-8888-888888888888', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('88888888-8888-8888-8888-888888888888', '019c5517-4670-7a06-8b57-8d054f851772', true, '2026-02-13T03:41:54.664757+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, active, created_at, generated, mcp)
SELECT '88888888-8888-8888-8888-888888888888', ar.model_id, true, '2026-02-13T03:41:54.664757+00:00', false, false
FROM public.agents_resource ar
WHERE ar.id = '019c5517-4670-7a06-8b57-8d054f851772'
  AND ar.model_id IS NOT NULL
ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_reasoning_levels_junction
INSERT INTO public.agent_reasoning_levels_junction (agent_id, reasoning_level_id, active, created_at, generated, mcp)
SELECT '88888888-8888-8888-8888-888888888888', rlr.id, true, '2026-02-13T03:41:54.664757+00:00', false, false
FROM public.agents_resource ar
JOIN public.reasoning_levels_resource rlr
  ON rlr.reasoning_level = ar.reasoning
 AND rlr.active = true
WHERE ar.id = '019c5517-4670-7a06-8b57-8d054f851772'
  AND ar.reasoning IS NOT NULL
ON CONFLICT (agent_id, reasoning_level_id) DO NOTHING;
-- agent_temperature_levels_junction
INSERT INTO public.agent_temperature_levels_junction (agent_id, temperature_level_id, active, created_at, generated, mcp)
SELECT '88888888-8888-8888-8888-888888888888', tlr.id, true, '2026-02-13T03:41:54.664757+00:00', false, false
FROM public.agents_resource ar
JOIN public.temperature_levels_resource tlr
  ON tlr.temperature = ar.temperature
 AND tlr.active = true
WHERE ar.id = '019c5517-4670-7a06-8b57-8d054f851772'
  AND ar.temperature IS NOT NULL
ON CONFLICT (agent_id, temperature_level_id) DO NOTHING;
-- agent_voices_junction
INSERT INTO public.agent_voices_junction (agent_id, voice_id, active, created_at, generated, mcp)

SELECT DISTINCT '88888888-8888-8888-8888-888888888888'::uuid, vr.id, true, '2026-02-13T03:41:54.664757+00:00'::timestamptz, false, false
FROM public.agents_resource ar
JOIN unnest(COALESCE(ar.voices, ARRAY[]::text[])) AS v(voice) ON true
JOIN public.voices_resource vr
  ON vr.voice = v.voice
 AND vr.active = true
WHERE ar.id = '019c5517-4670-7a06-8b57-8d054f851772'
ON CONFLICT (agent_id, voice_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('88888888-8888-8888-8888-888888888888', '019bcd1b-0ca6-789c-9a76-7890886df5e7', '2026-01-17T17:57:40.643852+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, created_at, generated, mcp, active) VALUES ('88888888-8888-8888-8888-888888888888', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', '2026-01-17T17:57:40.643852+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('88888888-8888-8888-8888-888888888888', '019bcd1b-0ca6-75a6-8b1c-c88ec47260b2', '2026-01-17T17:57:40.643852+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('88888888-8888-8888-8888-888888888888', '019bebc4-d436-7bc7-a392-37e8b4549478', true, '2026-01-17T17:57:40.643852+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('88888888-8888-8888-8888-888888888888', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-01-17T17:57:40.643852+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('88888888-8888-8888-8888-888888888888', '019bebc4-d436-7c20-b35a-73c9819b708a', true, '2026-01-17T17:57:40.643852+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('88888888-8888-8888-8888-888888888888', '019bebc4-d436-7c2e-af8f-40ed4aa3edaf', true, '2026-01-17T17:57:40.643852+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('88888888-8888-8888-8888-888888888888', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-01-17T17:57:40.643852+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('88888888-8888-8888-8888-888888888888', '019bebc4-d436-7cc0-a482-5c0fad4f04e9', true, '2026-01-17T17:57:40.643852+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('88888888-8888-8888-8888-888888888888', '019bebc4-d436-7ccb-b52a-fa65793c95ce', true, '2026-01-17T17:57:40.643852+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('88888888-8888-8888-8888-888888888888', '019bebc4-d436-7ccc-9e9c-6f4b2a633f9d', true, '2026-01-17T17:57:40.643852+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('88888888-8888-8888-8888-888888888888', '3730b47a-aaf5-4531-81c5-fde207b9f77f', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('88888888-8888-8888-8888-888888888888', 'd9247def-16e8-4fff-b27e-a8af318a5dd9', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('88888888-8888-8888-8888-888888888888', '019c06a8-2af4-7c97-ab30-1e863db0e8e3', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('88888888-8888-8888-8888-888888888888', '019c06a8-2af5-705d-ae92-7905a846a500', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('88888888-8888-8888-8888-888888888888', '019c06a8-2af5-766c-9713-315ab9567235', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('88888888-8888-8888-8888-888888888888', '019c06a8-2af5-7f6a-aaa0-5a9aaa2ed10e', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('88888888-8888-8888-8888-888888888888', '019c4f27-177f-7762-8c20-a2210565a69b', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('88888888-8888-8888-8888-888888888888', '019c06a8-2af6-727b-b94a-71bddc4d76de', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('88888888-8888-8888-8888-888888888888', 'b8d2fd18-ee1b-4564-b6f4-bbac30a9cbfc', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('88888888-8888-8888-8888-888888888888', '019c4f27-1782-77f6-8e39-d193b8240237', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('88888888-8888-8888-8888-888888888888', '019c4f27-1784-7c83-a971-06d5405753dd', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('88888888-8888-8888-8888-888888888888', 'a24eefa2-fe75-4619-ae36-7eb1ea8ba4aa', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('88888888-8888-8888-8888-888888888888', '209cfad1-69b5-40be-a980-406888376306', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
