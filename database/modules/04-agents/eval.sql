-- Module: Eval
-- Category: agent
-- Description: Eval system agent
-- ============================================================


-- Resource rows
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-03T19:33:56.322550+00:00', true, false, false, '019c24ff-49e2-7dee-b670-1478eab95447', 'Chat Agent', 'Agent responsible for augmenting messages with content blocks and hints during simulations', '{}', NULL, NULL, '{019bebc4-d436-7ba3-9c29-c24f308f6e56,019bebc4-d436-7b60-9f57-f7c03f636fac}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '019c16d8-a12c-70db-82d7-454f71f50c08', '{019c16d8-a12c-788f-8361-7201fed4f3e6}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bcd1c-333f-7a05-a8ba-10219e4394dc', 'AI agent for generating and managing eval resources including names, descriptions, flags, departments, scenarios, rubrics, and various eval-specific resources using GPT-5.1', '2026-01-17T17:58:56.053417+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019bb798-89d6-774a-a3b2-f6d57050833d', '## Current Draft Context
{% set draft = views.draft_eval if views and views.draft_eval else None %}
- draft_id: {{ draft.draft_id if draft else ''none'' }}
- regeneration_descriptions: {{ draft.regeneration_descriptions if draft else [] }}

## Current Selected Resources
- names: {{ names or [] }}
- descriptions: {{ descriptions or [] }}
- flags: {{ flags or [] }}
- departments: {{ departments or [] }}
- eval_agents: {{ eval_agents or [] }}
- rubrics: {{ rubrics or [] }}
- run_positions: {{ run_positions or [] }}
- group_positions: {{ group_positions or [] }}
- run_rubrics: {{ run_rubrics or [] }}
- group_rubrics: {{ group_rubrics or [] }}

## Rules
- Process only requested resource_types.
- Reuse suitable existing resources where possible.
- Create resources only for missing or weak selections.
- Keep run/group position and rubric mappings coherent.', true, '2026-01-13T13:43:05.942140+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bcd1c-333e-73c9-a949-c31c83edf84d', 'Eval', '2026-01-17T17:58:56.053417+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-01-13T03:08:53.528135+00:00', 'You are the Eval Artifact Generation Agent for v4.

Generate or update only the requested eval resource_types:
names, descriptions, flags, departments, agents, run_positions, group_positions, run_rubrics, group_rubrics.

Rules:
- Operate only on requested resource_types.
- Prefer existing suitable resources when available.
- Create only what is needed for missing or weak selections.
- Keep run/group position and rubric mappings coherent.
- Do not invent IDs; use IDs from context when linking.

Output:
- Return only valid tool calls and arguments.
- Do not output narrative text.', 'Eval Agent System Prompt', 'System prompt for eval generation agents that create and manage eval resources', true, 'ffffffff-1111-1111-1111-ffffffffffff', false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-01-17T17:58:56.053417+00:00', '2026-01-17T17:58:56.053417+00:00', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019c24ff-49e2-7dee-b670-1478eab95447', true, '2026-02-03T19:33:56.323557+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bcd1c-333f-7a05-a8ba-10219e4394dc', '2026-01-17T17:58:56.053417+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-01-17T17:58:56.053417+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bb798-89d6-774a-a3b2-f6d57050833d', '2026-02-10T19:15:00.738862+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '2026-01-17T17:58:56.053417+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bcd1c-333e-73c9-a949-c31c83edf84d', '2026-01-17T17:58:56.053417+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2026-02-10T19:15:00.738862+00:00', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'ffffffff-1111-1111-1111-ffffffffffff', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-02-10T19:15:00.738862+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bebc4-d436-7bf6-af0e-91e685a8f15e', true, '2026-02-10T19:15:00.738862+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019c06a8-2af5-766c-9713-315ab9567235', true, '2026-02-10T19:15:00.738862+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bebc4-d436-7cd5-9cfb-f52df7b3d47d', true, '2026-02-10T19:15:00.738862+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bebc4-d436-7c14-a42e-f45a12c4fdb0', true, '2026-02-10T19:15:00.738862+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019c06a8-2af6-727b-b94a-71bddc4d76de', true, '2026-02-10T19:15:00.738862+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bebc4-d436-7ce3-babd-f4ea7d97e54c', true, '2026-02-10T19:15:00.738862+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019c06a8-2af5-705d-ae92-7905a846a500', true, '2026-02-10T19:15:00.738862+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-02-10T19:15:00.738862+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bebc4-d436-7bde-91ab-92070869fe7f', true, '2026-02-10T19:15:00.738862+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019c06a8-2af4-7c97-ab30-1e863db0e8e3', true, '2026-02-10T19:15:00.738862+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bebc4-d436-7d07-9685-efb55bdcac10', true, '2026-02-10T19:15:00.738862+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '019bebc4-d436-7cfa-abc2-0b12c8166a91', true, '2026-02-10T19:15:00.738862+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
