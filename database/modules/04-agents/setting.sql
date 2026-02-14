-- Module: Setting
-- Category: agent
-- Description: Setting system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-01-13T13:54:04.534107+00:00', 'You are the Setting Artifact Generation Agent for v4.

Generate or update only the requested setting resource_types:
names, descriptions, flags, colors, departments, profiles, auths, keys, providers, thresholds, settings.

Rules:
- Operate only on requested resource_types.
- Prefer existing suitable resources when available.
- Create only what is needed for missing or weak selections.
- Keep auth/provider/key/threshold configuration internally coherent.
- Do not invent IDs; use IDs from context when linking.

Output:
- Return only valid tool calls and arguments.
- Do not output narrative text.', 'Setting Agent System Prompt', 'System prompt for setting generation agents that create and manage setting resources', true, '77777777-1111-1111-1111-777777777777', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-13T03:41:54.664757+00:00', true, false, false, '019c5517-4673-76c3-aefe-14e93c1ec6f5', 'Setting', 'AI agent for generating and managing setting resources', '{}', NULL, NULL, '{019bebc4-d436-7c75-ad20-e10da932e60b,019bebc4-d436-7c01-b86b-9483883762a6,019bebc4-d436-7c14-a42e-f45a12c4fdb0,019bebc4-d436-7c5e-b441-5b0c8673e4db,019bebc4-d436-7be1-9553-b722c5a74848,019bebc4-d436-7bee-9d95-c252a477881d,019bebc4-d436-7bf6-af0e-91e685a8f15e,019bebc4-d436-7c35-9f98-31957504bf95,019c06a8-2af6-727b-b94a-71bddc4d76de,019c06a8-2af4-7c97-ab30-1e863db0e8e3,019bebc4-d436-7c69-983a-589b59713462,019c06a8-2af4-765d-abe4-dc47e392ad30,019bebc4-d436-7c28-b7bf-f89de16c64d0,019c06a8-2af5-766c-9713-315ab9567235,019bebc4-d436-7c57-8749-ec4eb700f078,019c06a8-2af5-705d-ae92-7905a846a500}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '77777777-1111-1111-1111-777777777777', '{019bb7a2-9693-7069-8077-ed87670ef096}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bb7a2-968c-7570-977d-7e6719faeda4', 'AI agent for generating and managing setting resources', '2026-01-13T13:54:04.539077+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019bb7a2-9693-7069-8077-ed87670ef096', '## Current Draft Context
{% set draft = views.draft_setting if views and views.draft_setting else None %}
- draft_id: {{ draft.draft_id if draft else ''none'' }}
- regeneration_descriptions: {{ draft.regeneration_descriptions if draft else [] }}

## Current Selected Resources
- names: {{ names or [] }}
- descriptions: {{ descriptions or [] }}
- flags: {{ flags or [] }}
- colors: {{ colors or [] }}
- departments: {{ departments or [] }}
- profiles: {{ profiles or [] }}
- auths: {{ auths or [] }}
- keys: {{ keys or [] }}
- providers: {{ providers or [] }}
- thresholds: {{ thresholds or [] }}
- roles: {{ roles or [] }}
- routes: {{ routes or [] }}
- role_routes: {{ role_routes or [] }}

## Rules
- Process only requested resource_types.
- Reuse suitable existing resources where possible.
- Create resources only for missing or weak selections.
- Keep auth/provider/key/threshold and role/route combinations coherent.', true, '2026-01-13T13:54:04.562409+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bb7a2-968a-707d-a734-49a824bb1dec', 'Setting', '2026-01-13T13:54:04.539077+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-01-13T13:54:04.539077+00:00', '2026-01-13T13:54:04.539077+00:00', '77777777-7777-7777-7777-777777777777', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019c5517-4673-76c3-aefe-14e93c1ec6f5', true, '2026-02-13T03:41:54.664757+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('77777777-7777-7777-7777-777777777777', '019bb7a2-968c-7570-977d-7e6719faeda4', '2026-01-13T13:54:04.539077+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('77777777-7777-7777-7777-777777777777', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-01-13T13:54:04.539077+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('77777777-7777-7777-7777-777777777777', '019bb7a2-9693-7069-8077-ed87670ef096', '2026-01-13T13:54:04.562409+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('77777777-7777-7777-7777-777777777777', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '2026-01-13T13:54:04.539077+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('77777777-7777-7777-7777-777777777777', '019bb7a2-968a-707d-a734-49a824bb1dec', '2026-01-13T13:54:04.539077+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2026-01-13T13:54:04.539077+00:00', '77777777-7777-7777-7777-777777777777', '77777777-1111-1111-1111-777777777777', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019c06a8-2af4-7c97-ab30-1e863db0e8e3', true, '2026-02-10T19:15:44.750082+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019bebc4-d436-7c69-983a-589b59713462', true, '2026-02-10T19:15:44.750082+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019c06a8-2af4-765d-abe4-dc47e392ad30', true, '2026-02-10T19:15:44.750082+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019bebc4-d436-7c75-ad20-e10da932e60b', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019bebc4-d436-7c28-b7bf-f89de16c64d0', true, '2026-02-10T19:15:44.750082+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019bebc4-d436-7bf6-af0e-91e685a8f15e', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019c06a8-2af5-766c-9713-315ab9567235', true, '2026-02-10T19:15:44.750082+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019bebc4-d436-7c57-8749-ec4eb700f078', true, '2026-02-10T19:15:44.750082+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019bebc4-d436-7c14-a42e-f45a12c4fdb0', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019bebc4-d436-7c5e-b441-5b0c8673e4db', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019bebc4-d436-7be1-9553-b722c5a74848', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019bebc4-d436-7bee-9d95-c252a477881d', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019c06a8-2af5-705d-ae92-7905a846a500', true, '2026-02-10T19:15:44.750082+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('77777777-7777-7777-7777-777777777777', '019c06a8-2af6-727b-b94a-71bddc4d76de', true, '2026-02-10T19:15:44.750082+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
