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
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-13T03:41:54.664757+00:00', true, false, false, '019c5517-4670-7a06-8b57-8d054f851772', 'Agent', 'AI agent for generating and managing agent resources including names, descriptions, flags, departments, prompts, instructions, models, and tools using GPT-5.1', '{}', NULL, NULL, '{019bebc4-d436-7bc7-a392-37e8b4549478,019bebc4-d436-7c2e-af8f-40ed4aa3edaf,019bebc4-d436-7c35-9f98-31957504bf95,019bebc4-d436-7cc0-a482-5c0fad4f04e9,019bebc4-d436-7ccb-b52a-fa65793c95ce,019bebc4-d436-7ccc-9e9c-6f4b2a633f9d,019bebc4-d436-7c01-b86b-9483883762a6,019bebc4-d436-7c20-b35a-73c9819b708a,019c06a8-2af5-766c-9713-315ab9567235,019c06a8-2af5-705d-ae92-7905a846a500,019c06a8-2af4-7c97-ab30-1e863db0e8e3,d9247def-16e8-4fff-b27e-a8af318a5dd9,3730b47a-aaf5-4531-81c5-fde207b9f77f,019c06a8-2af6-727b-b94a-71bddc4d76de,b8d2fd18-ee1b-4564-b6f4-bbac30a9cbfc,019c4f27-1782-77f6-8e39-d193b8240237,019c4f27-1784-7c83-a971-06d5405753dd,a24eefa2-fe75-4619-ae36-7eb1ea8ba4aa,209cfad1-69b5-40be-a980-406888376306,019c4f27-177f-7762-8c20-a2210565a69b,019c06a8-2af5-7f6a-aaa0-5a9aaa2ed10e}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '88888888-9999-9999-9999-888888888888', '{019c2f13-4200-7c00-8000-000000000001}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bcd1b-0ca6-789c-9a76-7890886df5e7', 'AI agent for generating and managing agent resources including names, descriptions, flags, departments, prompts, instructions, models, and tools using GPT-5.1', '2026-01-17T17:57:40.643852+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c2f13-4200-7c00-8000-000000000001', '## Current Form State

The user is currently editing a agent with the following selections:

{% set draft = views.draft_agent if views and views.draft_agent else None %}

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

{% if models and models|length > 0 %}
**Current Models:** {% for item in models %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.model_ids and draft.model_ids|length > 0 %}
**Current Models IDs:** {% for id in draft.model_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Models:** (not selected)
{% endif %}

{% if prompts and prompts|length > 0 %}
**Current Prompts:** {% for p in prompts %}{{ p.system_prompt[:80] }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.prompt_ids and draft.prompt_ids|length > 0 %}
**Current Prompts IDs:** {% for id in draft.prompt_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Prompts:** (not selected)
{% endif %}

{% if instructions and instructions|length > 0 %}
**Current Instructions:** {% for inst in instructions %}{{ inst.template[:80] }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.instruction_ids and draft.instruction_ids|length > 0 %}
**Current Instructions IDs:** {% for id in draft.instruction_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Instructions:** (not selected)
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

{% if tools and tools|length > 0 %}
**Current Tools:** {% for item in tools %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.tool_ids and draft.tool_ids|length > 0 %}
**Current Tools IDs:** {% for id in draft.tool_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Tools:** (not selected)
{% endif %}

{% if temperature_levels and temperature_levels|length > 0 %}
**Current Temperature Levels:** {% for item in temperature_levels %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.temperature_level_ids and draft.temperature_level_ids|length > 0 %}
**Current Temperature Levels IDs:** {% for id in draft.temperature_level_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Temperature Levels:** (not selected)
{% endif %}

{% if reasoning_levels and reasoning_levels|length > 0 %}
**Current Reasoning Levels:** {% for item in reasoning_levels %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.reasoning_level_ids and draft.reasoning_level_ids|length > 0 %}
**Current Reasoning Levels IDs:** {% for id in draft.reasoning_level_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Reasoning Levels:** (not selected)
{% endif %}

{% if voices and voices|length > 0 %}
**Current Voices:** {% for item in voices %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.voice_ids and draft.voice_ids|length > 0 %}
**Current Voices IDs:** {% for id in draft.voice_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Voices:** (not selected)
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

{% if models and models|length > 0 %}
### Available Models
{% for item in models %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if prompts and prompts|length > 0 %}
### Available Prompts
{% for item in prompts %}
- id: {{ item.id }} | name: {{ item.name }} | prompt: {{ item.system_prompt[:60] }}{% if item.system_prompt|length > 60 %}...{% endif %}
{% endfor %}
{% endif %}

{% if instructions and instructions|length > 0 %}
### Available Instructions
{% for item in instructions %}
- id: {{ item.id }} | template: {{ item.template[:80] }}{% if item.template|length > 80 %}...{% endif %}
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

{% if tools and tools|length > 0 %}
### Available Tools
{% for item in tools %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if temperature_levels and temperature_levels|length > 0 %}
### Available Temperature Levels
{% for item in temperature_levels %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if reasoning_levels and reasoning_levels|length > 0 %}
### Available Reasoning Levels
{% for item in reasoning_levels %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if voices and voices|length > 0 %}
### Available Voices
{% for item in voices %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

## Tool Usage (Either/Or)

For each resource, choose ONE approach:
- **use_*** tools: When a suitable resource ALREADY EXISTS above (pass the existing id)
- **create_*** tools: When you need to generate NEW content (nothing suitable exists)

You do NOT need to both create and use — pick one based on whether a suitable resource exists.
', true, '2026-02-10T19:12:47.645232+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bcd1b-0ca6-75a6-8b1c-c88ec47260b2', 'Agent', '2026-01-17T17:57:40.643852+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-01-17T17:57:40.643852+00:00', '2026-01-17T17:57:40.643852+00:00', '88888888-8888-8888-8888-888888888888', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('88888888-8888-8888-8888-888888888888', '019c5517-4670-7a06-8b57-8d054f851772', true, '2026-02-13T03:41:54.664757+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('88888888-8888-8888-8888-888888888888', '019bcd1b-0ca6-789c-9a76-7890886df5e7', '2026-01-17T17:57:40.643852+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('88888888-8888-8888-8888-888888888888', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-01-17T17:57:40.643852+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('88888888-8888-8888-8888-888888888888', '019c2f13-4200-7c00-8000-000000000001', '2026-02-10T19:12:47.645232+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('88888888-8888-8888-8888-888888888888', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '2026-01-17T17:57:40.643852+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('88888888-8888-8888-8888-888888888888', '019bcd1b-0ca6-75a6-8b1c-c88ec47260b2', '2026-01-17T17:57:40.643852+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2026-01-17T17:57:40.643852+00:00', '88888888-8888-8888-8888-888888888888', '88888888-9999-9999-9999-888888888888', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
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
