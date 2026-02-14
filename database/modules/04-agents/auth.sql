-- Module: Auth
-- Category: agent
-- Description: Auth system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-01-17T17:57:40.627996+00:00', 'You are the Auth Artifact Generation Agent for v4.

Generate or update only the requested auth resource_types:
names, descriptions, flags, protocols, slugs, items.

Rules:
- Operate only on requested resource_types.
- Prefer existing suitable resources when available.
- Create only what is needed for missing or weak selections.
- Keep protocol/slug/item configuration internally coherent.
- Do not invent IDs; use IDs from context when linking.

Output:
- Return only valid tool calls and arguments.
- Do not output narrative text.', 'Auth Agent System Prompt', 'System prompt for auth generation agents that create and manage auth resources', true, '22222222-3333-3333-3333-222222222222', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-13T03:41:54.664757+00:00', true, false, false, '019c5517-4672-7c5f-953f-8c064353f7d4', 'Auth', 'AI agent for generating and managing auth resources including names, descriptions, flags, protocols, slugs, and items using GPT-5.1', '{}', NULL, NULL, '{019bebc4-d436-7c35-9f98-31957504bf95,019bebc4-d436-7c99-9c5d-1d6d7e0aeb46,019bebc4-d436-7c96-b29a-80cc1f4d73b1,019bebc4-d436-7c14-a42e-f45a12c4fdb0,019bebc4-d436-7c8f-9f19-28ba6dc8519f,019bebc4-d436-7c01-b86b-9483883762a6,019c06a8-2af5-766c-9713-315ab9567235,019c06a8-2af5-705d-ae92-7905a846a500,019c06a8-2af6-727b-b94a-71bddc4d76de}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '22222222-3333-3333-3333-222222222222', '{019c2f13-4500-7c00-8000-000000000001}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bcd1b-0c97-704a-8b0a-99075990e1e5', 'AI agent for generating and managing auth resources including names, descriptions, flags, protocols, slugs, and items using GPT-5.1', '2026-01-17T17:57:40.627996+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c2f13-4500-7c00-8000-000000000001', '## Current Draft Context
{% set draft = views.draft_auth if views and views.draft_auth else None %}
- draft_id: {{ draft.draft_id if draft else ''none'' }}
- regeneration_descriptions: {{ draft.regeneration_descriptions if draft else [] }}

## Current Selected Resources
- names: {{ names or [] }}
- descriptions: {{ descriptions or [] }}
- flags: {{ flags or [] }}
- protocols: {{ protocols or [] }}
- slugs: {{ slugs or [] }}
- items: {{ items or [] }}

## Rules
- Process only requested resource_types.
- Reuse suitable existing resources where possible.
- Create resources only for missing or weak selections.
- Keep protocols/slugs/items coherent for auth configuration.', true, '2026-02-10T19:15:00.738862+00:00', false, false) ON CONFLICT (id) DO NOTHING;
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
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('22222222-2222-2222-2222-222222222222', '019bebc4-d436-7c14-a42e-f45a12c4fdb0', true, '2026-01-17T17:57:40.627996+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('22222222-2222-2222-2222-222222222222', '019c06a8-2af6-727b-b94a-71bddc4d76de', true, '2026-02-10T19:15:00.738862+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('22222222-2222-2222-2222-222222222222', '019c06a8-2af5-705d-ae92-7905a846a500', true, '2026-02-10T19:15:00.738862+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('22222222-2222-2222-2222-222222222222', '019bebc4-d436-7c8f-9f19-28ba6dc8519f', true, '2026-01-17T17:57:40.627996+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('22222222-2222-2222-2222-222222222222', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-01-17T17:57:40.627996+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
