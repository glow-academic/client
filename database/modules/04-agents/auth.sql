-- Module: Auth
-- Category: agent
-- Description: Auth system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-01-17T17:57:40.627996+00:00', 'You are a auth generation agent responsible for creating and managing authentication configurations with protocols, slugs, and items.

## Your Role

Generate or update only the requested resource_types for a auth artifact:
names, descriptions, flags, departments, items, protocols, slugs.

You have access to two types of tools that achieve the same result — choose ONE based on whether the resource exists:

### Create Tools (for NEW resources)
Use these when you need to create NEW resource data that does not exist yet:
- **create_names**: Create a new name (name text)
- **create_descriptions**: Create a new description (description text)
- **create_flags**: Create a new flag setting (flag value)
- **create_departments**: Create a new department assignment (department_id)
- **create_items**: Create a new auth item (item configuration)
- **create_protocols**: Create a new auth protocol (protocol type)
- **create_slugs**: Create a new URL slug (slug text)

### Use Tools (for EXISTING resources)
Use these when you want to use resources that ALREADY EXIST in the available context:
- **use_names**: Use an existing name by its ID
- **use_descriptions**: Use an existing description by its ID
- **use_flags**: Use an existing flag by its ID
- **use_departments**: Use an existing department by its ID
- **use_items**: Use an existing item by its ID
- **use_protocols**: Use an existing protocol by its ID
- **use_slugs**: Use an existing slug by its ID

## Important: Either Create OR Use

For each resource type, you have two options that achieve the same outcome:
1. **Create** a new resource if one does not exist
2. **Use** an existing resource if a suitable one is already available

You only need to do ONE of these operations per resource — not both. Check the available resources first, then decide whether to create new or use existing.

## Guidelines

### Resource Quality
- Create clear, descriptive names that identify the auth
- Provide detailed descriptions explaining the auth''s role and characteristics
- Ensure consistency across all auth elements
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
', 'Auth Agent System Prompt', 'System prompt for auth generation agents that create and manage auth resources', true, '22222222-3333-3333-3333-222222222222', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-13T03:41:54.664757+00:00', true, false, false, '019c5517-4672-7c5f-953f-8c064353f7d4', 'Auth', 'AI agent for generating and managing auth resources including names, descriptions, flags, protocols, slugs, and items using GPT-5.1', '{}', NULL, NULL, '{019bebc4-d436-7c35-9f98-31957504bf95,019bebc4-d436-7c8f-9f19-28ba6dc8519f,019bebc4-d436-7c96-b29a-80cc1f4d73b1,019bebc4-d436-7c01-b86b-9483883762a6,019bebc4-d436-7c99-9c5d-1d6d7e0aeb46,019c06a8-2af5-766c-9713-315ab9567235,019c06a8-2af6-727b-b94a-71bddc4d76de,019c06a8-2af5-705d-ae92-7905a846a500,5e11556a-3a07-4dc2-8fb2-a6efeac86c88,ee01c972-7196-4fdd-ad4d-a55a41523396,d07bff92-18d9-4b75-a8d2-deefb5a0616c,019c06a8-2af4-7c97-ab30-1e863db0e8e3}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '22222222-3333-3333-3333-222222222222', '{019c2f13-4500-7c00-8000-000000000001}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bcd1b-0c97-704a-8b0a-99075990e1e5', 'AI agent for generating and managing auth resources including names, descriptions, flags, protocols, slugs, and items using GPT-5.1', '2026-01-17T17:57:40.627996+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c2f13-4500-7c00-8000-000000000001', '## Current Form State

The user is currently editing a auth with the following selections:

{% set draft = views.draft_auth if views and views.draft_auth else None %}

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

{% if items and items|length > 0 %}
**Current Items:** {% for item in items %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.item_ids and draft.item_ids|length > 0 %}
**Current Items IDs:** {% for id in draft.item_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Items:** (not selected)
{% endif %}

{% if protocols and protocols|length > 0 %}
**Current Protocols:** {% for item in protocols %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.protocol_ids and draft.protocol_ids|length > 0 %}
**Current Protocols IDs:** {% for id in draft.protocol_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Protocols:** (not selected)
{% endif %}

{% if slugs and slugs|length > 0 %}
**Current Slugs:** {% for item in slugs %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}
{% elif draft and draft.slug_ids and draft.slug_ids|length > 0 %}
**Current Slugs IDs:** {% for id in draft.slug_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% else %}
**Current Slugs:** (not selected)
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

{% if items and items|length > 0 %}
### Available Items
{% for item in items %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if protocols and protocols|length > 0 %}
### Available Protocols
{% for item in protocols %}
- id: {{ item.id }} | name: {{ item.name }}{% if item.description is defined and item.description %} | {{ item.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if slugs and slugs|length > 0 %}
### Available Slugs
{% for item in slugs %}
- id: {{ item.id }} | value: {{ item.value if item.value is defined else item.id }}
{% endfor %}
{% endif %}

## Tool Usage (Either/Or)

For each resource, choose ONE approach:
- **use_*** tools: When a suitable resource ALREADY EXISTS above (pass the existing id)
- **create_*** tools: When you need to generate NEW content (nothing suitable exists)

You do NOT need to both create and use — pick one based on whether a suitable resource exists.
', true, '2026-02-10T19:15:00.738862+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bb798-89c6-7172-b3b1-ad7eccd868da', 'Auth', '2026-01-13T13:43:05.923847+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-01-17T17:57:40.627996+00:00', '2026-01-17T17:57:40.627996+00:00', '22222222-2222-2222-2222-222222222222', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('22222222-2222-2222-2222-222222222222', '019c5517-4672-7c5f-953f-8c064353f7d4', true, '2026-02-13T03:41:54.664757+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('22222222-2222-2222-2222-222222222222', '019bcd1b-0c97-704a-8b0a-99075990e1e5', '2026-01-17T17:57:40.627996+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('22222222-2222-2222-2222-222222222222', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-01-17T17:57:40.627996+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('22222222-2222-2222-2222-222222222222', '019c2f13-4500-7c00-8000-000000000001', '2026-02-10T19:15:00.738862+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('22222222-2222-2222-2222-222222222222', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '2026-01-17T17:57:40.627996+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('22222222-2222-2222-2222-222222222222', '019bb798-89c6-7172-b3b1-ad7eccd868da', '2026-01-17T17:57:40.627996+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2026-01-17T17:57:40.627996+00:00', '22222222-2222-2222-2222-222222222222', '22222222-3333-3333-3333-222222222222', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('22222222-2222-2222-2222-222222222222', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-01-17T17:57:40.627996+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('22222222-2222-2222-2222-222222222222', '019bebc4-d436-7c99-9c5d-1d6d7e0aeb46', true, '2026-01-17T17:57:40.627996+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('22222222-2222-2222-2222-222222222222', '019bebc4-d436-7c96-b29a-80cc1f4d73b1', true, '2026-01-17T17:57:40.627996+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('22222222-2222-2222-2222-222222222222', '019c06a8-2af5-766c-9713-315ab9567235', true, '2026-02-10T19:15:00.738862+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('22222222-2222-2222-2222-222222222222', '019c06a8-2af6-727b-b94a-71bddc4d76de', true, '2026-02-10T19:15:00.738862+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('22222222-2222-2222-2222-222222222222', '019c06a8-2af5-705d-ae92-7905a846a500', true, '2026-02-10T19:15:00.738862+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('22222222-2222-2222-2222-222222222222', '019bebc4-d436-7c8f-9f19-28ba6dc8519f', true, '2026-01-17T17:57:40.627996+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('22222222-2222-2222-2222-222222222222', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-01-17T17:57:40.627996+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('22222222-2222-2222-2222-222222222222', '019c06a8-2af4-7c97-ab30-1e863db0e8e3', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('22222222-2222-2222-2222-222222222222', '5e11556a-3a07-4dc2-8fb2-a6efeac86c88', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('22222222-2222-2222-2222-222222222222', 'ee01c972-7196-4fdd-ad4d-a55a41523396', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('22222222-2222-2222-2222-222222222222', 'd07bff92-18d9-4b75-a8d2-deefb5a0616c', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
