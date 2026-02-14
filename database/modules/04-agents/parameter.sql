-- Module: Parameter
-- Category: agent
-- Description: Parameter system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-01-17T17:57:40.566652+00:00', 'You are a parameter generation agent responsible for creating and managing parameter resources for AI-powered training workflows.

## Operating Mode
For each requested resource type, choose exactly one approach:
1. Use existing resources with `use_*` tools when suitable items already exist.
2. Create new resources with `create_*` tools only when suitable items do not exist.

## Resource Scope
- names
- descriptions
- flags
- departments
- fields

## Tooling Rules
- Use only provided tools.
- Prefer deterministic IDs from context for `use_*` tools.
- Do not call both create and use for the same resource type unless required by dependencies.

## Quality Bar
- Keep parameter naming/description specific and non-generic.
- Keep field associations coherent with parameter intent.
- Keep outputs concise, structured, and directly actionable.
', 'Parameter Agent System Prompt', 'System prompt for parameter generation agents that create and manage parameter resources', true, '11111111-2222-2222-2222-111111111111', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-13T03:41:54.664757+00:00', true, false, false, '019c5517-4673-74b4-991e-153c7b8a9174', 'Parameter', 'AI agent for generating and managing parameter resources including names, descriptions, flags, departments, and fields using GPT-5.1', '{}', NULL, NULL, '{019bebc4-d436-7b73-a506-0b196bce4ada,019bebc4-d436-7bf6-af0e-91e685a8f15e,019bebc4-d436-7c01-b86b-9483883762a6,019bebc4-d436-7c14-a42e-f45a12c4fdb0,019bebc4-d436-7c35-9f98-31957504bf95}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '11111111-2222-2222-2222-111111111111', '{019c2f13-4100-7c00-8000-000000000001}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bcd1b-0c8b-789b-8866-7761d9eb1159', 'AI agent for generating and managing parameter resources including names, descriptions, flags, departments, and fields using GPT-5.1', '2026-01-17T17:57:40.566652+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c2f13-4100-7c00-8000-000000000001', '## Current Form State

The user is currently editing a parameter with the following selections:

{% set draft = views.draft_parameter if views and views.draft_parameter else None %}

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
**Current Flags:** {% for flag in flags %}{{ flag.label or flag.key or flag.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.flag_ids and draft.flag_ids|length > 0 %}
**Current Flag IDs:** {% for id in draft.flag_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Flags:** (none selected)
{% endif %}

{% if fields and fields|length > 0 %}
**Current Fields:** {% for field in fields %}{{ field.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.parameter_field_ids and draft.parameter_field_ids|length > 0 %}
**Current Field IDs:** {% for id in draft.parameter_field_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Fields:** (none selected)
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

{% if fields and fields|length > 0 %}
### Available Fields
{% for field in fields %}
- id: {{ field.field_id or field.id }} | name: {{ field.name }}
{% endfor %}
{% endif %}
', true, '2026-02-10T19:12:00.055832+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bb563-1b25-7c30-952d-188a1018298d', 'Parameter', '2026-01-13T03:25:29.760160+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-01-17T17:57:40.566652+00:00', '2026-01-17T17:57:40.566652+00:00', '11111111-1111-1111-1111-111111111111', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('11111111-1111-1111-1111-111111111111', '019c5517-4673-74b4-991e-153c7b8a9174', true, '2026-02-13T03:41:54.664757+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('11111111-1111-1111-1111-111111111111', '019bcd1b-0c8b-789b-8866-7761d9eb1159', '2026-01-17T17:57:40.566652+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('11111111-1111-1111-1111-111111111111', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-01-17T17:57:40.566652+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('11111111-1111-1111-1111-111111111111', '019c2f13-4100-7c00-8000-000000000001', '2026-02-10T19:12:00.055832+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('11111111-1111-1111-1111-111111111111', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '2026-01-17T17:57:40.566652+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('11111111-1111-1111-1111-111111111111', '019bb563-1b25-7c30-952d-188a1018298d', '2026-01-17T17:57:40.566652+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2026-01-17T17:57:40.566652+00:00', '11111111-1111-1111-1111-111111111111', '11111111-2222-2222-2222-111111111111', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('11111111-1111-1111-1111-111111111111', '019bebc4-d436-7b73-a506-0b196bce4ada', true, '2026-01-17T17:57:40.566652+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('11111111-1111-1111-1111-111111111111', '019bebc4-d436-7bf6-af0e-91e685a8f15e', true, '2026-01-17T17:57:40.566652+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('11111111-1111-1111-1111-111111111111', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-01-17T17:57:40.566652+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('11111111-1111-1111-1111-111111111111', '019bebc4-d436-7c14-a42e-f45a12c4fdb0', true, '2026-01-17T17:57:40.566652+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('11111111-1111-1111-1111-111111111111', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-01-17T17:57:40.566652+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
