-- Module: Department
-- Category: agent
-- Description: Department system agent
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bcd1b-0c9e-77c7-9408-98c9d2b8e010', 'AI agent for generating and managing department resources including names, descriptions, flags, and settings using GPT-5.1', '2026-01-17T17:57:40.636093+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c2f13-4400-7c00-8000-000000000001', '## Current Draft Context
{% set draft = views.draft_department if views and views.draft_department else None %}
- draft_id: {{ draft.draft_id if draft else ''none'' }}
- regeneration_descriptions: {{ draft.regeneration_descriptions if draft else [] }}

## Current Selected Resources
- names: {{ names or [] }}
- descriptions: {{ descriptions or [] }}
- flags: {{ flags or [] }}
- settings: {{ settings or [] }}

## Rules
- Process only requested resource_types.
- Reuse suitable existing resources where possible.
- Create resources only for missing or weak selections.
- Keep settings decisions aligned with department scope.', true, '2026-02-10T19:14:16.391398+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bcd1b-0c9d-77e7-a11e-ff4b66344eb8', 'Department', '2026-01-17T17:57:40.636093+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-01-17T17:57:40.636093+00:00', 'You are the Department Artifact Generation Agent for v4.

Generate or update only the requested department resource_types:
names, descriptions, flags, settings.

Rules:
- Operate only on requested resource_types.
- Prefer existing suitable resources when available.
- Create only what is needed for missing or weak selections.
- Keep department naming/description specific and operationally clear.
- Keep settings aligned with department purpose.
- Do not invent IDs; use IDs from context when linking.

Output:
- Return only valid tool calls and arguments.
- Do not output narrative text.', 'Department Agent System Prompt', 'System prompt for department generation agents', true, '44444444-5555-5555-5555-444444444444', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c01-b86b-9483883762a6', '2026-01-17T17:58:56.073128+00:00', false, false, true, 'create_descriptions', 'Create a new descriptions resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c14-a42e-f45a12c4fdb0', '2026-01-17T17:58:56.073128+00:00', false, false, true, 'create_flags', 'Create a new flags resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c35-9f98-31957504bf95', '2026-01-17T17:58:56.073128+00:00', false, false, true, 'create_names', 'Create a new names resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c69-983a-589b59713462', '2026-01-17T17:57:40.636093+00:00', false, false, true, 'create_settings', 'Create a new settings resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af5-705d-ae92-7905a846a500', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_descriptions', 'Use an existing description resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af5-766c-9713-315ab9567235', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_flags', 'Use an existing flag resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af6-727b-b94a-71bddc4d76de', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_names', 'Use an existing name resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-01-17T17:57:40.636093+00:00', '2026-01-17T17:57:40.636093+00:00', '44444444-4444-4444-4444-444444444444', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('44444444-4444-4444-4444-444444444444', '019bcd1b-0c9e-77c7-9408-98c9d2b8e010', '2026-01-17T17:57:40.636093+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('44444444-4444-4444-4444-444444444444', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-01-17T17:57:40.636093+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('44444444-4444-4444-4444-444444444444', '019c2f13-4400-7c00-8000-000000000001', '2026-02-10T19:14:16.391398+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('44444444-4444-4444-4444-444444444444', '019b3be4-36cd-7888-842b-8c6f8dfb363b', '2026-01-17T17:57:40.636093+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('44444444-4444-4444-4444-444444444444', '019bcd1b-0c9d-77e7-a11e-ff4b66344eb8', '2026-01-17T17:57:40.636093+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2026-01-17T17:57:40.636093+00:00', '44444444-4444-4444-4444-444444444444', '44444444-5555-5555-5555-444444444444', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('44444444-4444-4444-4444-444444444444', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-01-17T17:57:40.636093+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('44444444-4444-4444-4444-444444444444', '019bebc4-d436-7c14-a42e-f45a12c4fdb0', true, '2026-01-17T17:57:40.636093+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('44444444-4444-4444-4444-444444444444', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-01-17T17:57:40.636093+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('44444444-4444-4444-4444-444444444444', '019bebc4-d436-7c69-983a-589b59713462', true, '2026-01-17T17:57:40.636093+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('44444444-4444-4444-4444-444444444444', '019c06a8-2af5-705d-ae92-7905a846a500', true, '2026-02-10T19:14:16.391398+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('44444444-4444-4444-4444-444444444444', '019c06a8-2af5-766c-9713-315ab9567235', true, '2026-02-10T19:14:16.391398+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('44444444-4444-4444-4444-444444444444', '019c06a8-2af6-727b-b94a-71bddc4d76de', true, '2026-02-10T19:14:16.391398+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
