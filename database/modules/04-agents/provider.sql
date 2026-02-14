-- Module: Provider
-- Category: agent
-- Description: Provider system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-01-17T17:58:56.073128+00:00', 'You are the Provider Artifact Generation Agent for v4.

Generate or update only the requested provider resource_types:
names, descriptions, flags, departments, values, endpoints.

Rules:
- Operate only on requested resource_types.
- Prefer existing suitable resources when available.
- Create only what is needed for missing or weak selections.
- Keep provider value + endpoint + department configuration coherent.
- Key generation is disabled in this flow.
- Do not invent IDs; use IDs from context when linking.

Output:
- Return only valid tool calls and arguments.
- Do not output narrative text.', 'Provider System Prompt', 'System prompt for provider generation agents', true, '00000000-1111-1111-1111-000000000000', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-13T03:41:54.664757+00:00', true, false, false, '019c5517-4673-762c-a096-0a35439ebf11', 'Provider', 'AI agent for generating and managing provider resources including names, descriptions, flags, and endpoints using GPT-5.1', '{}', NULL, NULL, '{019bebc4-d436-7d12-8233-8e29598e4620,019bebc4-d436-7c01-b86b-9483883762a6,019bebc4-d436-7c14-a42e-f45a12c4fdb0,019bebc4-d436-7c35-9f98-31957504bf95,019bebc4-d436-7bf6-af0e-91e685a8f15e,019c06a8-2af4-7c97-ab30-1e863db0e8e3,019bebc4-d436-7c81-832a-a4a08d2b50f6,019c06a8-2af5-705d-ae92-7905a846a500,019c06a8-2af5-766c-9713-315ab9567235,019c06a8-2af6-727b-b94a-71bddc4d76de}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '00000000-1111-1111-1111-000000000000', '{019bcd1c-3358-7644-a68e-e260fdde031c}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bcd1c-334b-78ec-9926-85858921d389', 'AI agent for generating and managing provider resources including names, descriptions, flags, and endpoints using GPT-5.1', '2026-01-17T17:58:56.073128+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019bcd1c-3358-7644-a68e-e260fdde031c', '## Current Draft Context
{% set draft = views.draft_provider if views and views.draft_provider else None %}
- draft_id: {{ draft.draft_id if draft else ''none'' }}
- regeneration_descriptions: {{ draft.regeneration_descriptions if draft else [] }}

## Current Selected Resources
- names: {{ names or [] }}
- descriptions: {{ descriptions or [] }}
- flags: {{ flags or [] }}
- departments: {{ departments or [] }}
- values: {{ values or [] }}
- endpoints: {{ endpoints or [] }}
- keys: {{ keys or [] }}

## Rules
- Process only requested resource_types.
- Reuse suitable existing resources where possible.
- Create values/endpoints only when needed.
- Keep keys unchanged (key generation is disabled in this flow).', true, '2026-01-17T17:58:56.088129+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bcd1c-334b-73fb-a52d-c4516e98ae69', 'Provider', '2026-01-17T17:58:56.073128+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-01-17T17:58:56.073128+00:00', '2026-01-17T17:58:56.073128+00:00', '00000000-0000-0000-0000-000000000000', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '019c5517-4673-762c-a096-0a35439ebf11', true, '2026-02-13T03:41:54.664757+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('00000000-0000-0000-0000-000000000000', '019bcd1c-334b-78ec-9926-85858921d389', '2026-01-17T17:58:56.073128+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('00000000-0000-0000-0000-000000000000', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-01-17T17:58:56.073128+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('00000000-0000-0000-0000-000000000000', '019bcd1c-3358-7644-a68e-e260fdde031c', '2026-01-17T17:58:56.088129+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('00000000-0000-0000-0000-000000000000', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '2026-01-17T17:58:56.073128+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('00000000-0000-0000-0000-000000000000', '019bcd1c-334b-73fb-a52d-c4516e98ae69', '2026-01-17T17:58:56.073128+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2026-01-17T17:58:56.073128+00:00', '00000000-0000-0000-0000-000000000000', '00000000-1111-1111-1111-000000000000', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '019c06a8-2af4-7c97-ab30-1e863db0e8e3', true, '2026-02-10T19:13:36.011239+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '019c06a8-2af5-705d-ae92-7905a846a500', true, '2026-02-10T19:13:36.011239+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '019c06a8-2af5-766c-9713-315ab9567235', true, '2026-02-10T19:13:36.011239+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '019c06a8-2af6-727b-b94a-71bddc4d76de', true, '2026-02-10T19:13:36.011239+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '019bebc4-d436-7bf6-af0e-91e685a8f15e', true, '2026-02-10T19:13:36.011239+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-01-17T17:58:56.073128+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '019bebc4-d436-7c14-a42e-f45a12c4fdb0', true, '2026-01-17T17:58:56.073128+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-01-17T17:58:56.073128+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '019bebc4-d436-7c81-832a-a4a08d2b50f6', true, '2026-02-10T19:13:36.011239+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('00000000-0000-0000-0000-000000000000', '019bebc4-d436-7d12-8233-8e29598e4620', true, '2026-01-17T17:58:56.073128+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
