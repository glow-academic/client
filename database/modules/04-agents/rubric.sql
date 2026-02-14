-- Module: Rubric
-- Category: agent
-- Description: Rubric system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2025-12-19T19:02:10.222381+00:00', 'You are the Rubric Artifact Generation Agent for v4.

Generate or update only the requested rubric resource_types:
names, descriptions, departments, flags, points, pass_points, standard_groups, standards.

Rules:
- Operate only on requested resource_types.
- Prefer existing suitable resources when available.
- Create only what is needed for missing or weak selections.
- Keep total points and pass points coherent.
- Keep standard groups and standards consistent with rubric intent.
- Do not invent IDs; use IDs from context when linking.

Output:
- Return only valid tool calls and arguments.
- Do not output narrative text.', 'Rubric', 'System prompt for rubric generation agents', true, '019b3be4-36fe-7e8e-bdfd-05e834f7834d', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2025-12-19T19:02:10.223443+00:00', true, false, false, '019bb25e-e5f2-7f73-abf4-164c630526b2', 'Rubric', 'Agent for generating rubric descriptions and grid cell content', '{}', NULL, NULL, '{019bebc4-d436-7c35-9f98-31957504bf95,019bebc4-d436-7bf6-af0e-91e685a8f15e,019bebc4-d436-7c14-a42e-f45a12c4fdb0,019bebc4-d436-7c48-bbb0-2700d1deb830,019bebc4-d436-7bc3-aadf-8fb01ebadfdb,019bebc4-d436-7c01-b86b-9483883762a6}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '019b3be4-36fe-7e8e-bdfd-05e834f7834d', '{019bcd1b-0c44-7d26-927b-8b7a081ffac3}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019b995c-8ea1-7cb0-9364-428e72031db8', 'Agent for generating rubric descriptions and grid cell content', '2025-12-19T19:02:10.223443+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019bcd1b-0c44-7d26-927b-8b7a081ffac3', '## Current Draft Context
{% set draft = views.draft_rubric if views and views.draft_rubric else None %}
- draft_id: {{ draft.draft_id if draft else ''none'' }}
- regeneration_descriptions: {{ draft.regeneration_descriptions if draft else [] }}

## Current Selected Resources
- names: {{ names or [] }}
- descriptions: {{ descriptions or [] }}
- flags: {{ flags or [] }}
- departments: {{ departments or [] }}
- points: {{ points or [] }}
- pass_points: {{ pass_points or [] }}
- standard_groups: {{ standard_groups or [] }}
- standards: {{ standards or [] }}

## Rules
- Process only requested resource_types.
- Reuse suitable existing resources where possible.
- Create resources only for missing or weak selections.
- Keep points and pass_points coherent.
- Keep standard groups and standards mutually consistent.', true, '2026-01-17T17:57:40.543786+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019b995c-8ea0-7d0b-b711-2e26a9a6ec65', 'Rubric', '2025-12-19T19:02:10.223443+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2025-12-19T19:02:10.223443+00:00', '2025-12-19T19:02:10.223443+00:00', '019b3be4-3112-7786-ad7d-45ee39b86bc5', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019bb25e-e5f2-7f73-abf4-164c630526b2', true, '2025-12-19T19:02:10.223443+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019b995c-8ea1-7cb0-9364-428e72031db8', '2025-12-19T19:02:10.223443+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2025-12-19T19:02:10.223443+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019bcd1b-0c44-7d26-927b-8b7a081ffac3', '2026-01-17T17:57:40.543786+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '2025-12-19T19:02:10.223443+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019b995c-8ea0-7d0b-b711-2e26a9a6ec65', '2025-12-19T19:02:10.223443+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2025-12-19T19:02:10.223443+00:00', '019b3be4-3112-7786-ad7d-45ee39b86bc5', '019b3be4-36fe-7e8e-bdfd-05e834f7834d', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019bebc4-d436-7bc3-aadf-8fb01ebadfdb', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019bebc4-d436-7bf6-af0e-91e685a8f15e', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019bebc4-d436-7c14-a42e-f45a12c4fdb0', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019bebc4-d436-7c48-bbb0-2700d1deb830', true, '2026-01-13T23:48:20.098044+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019c06a8-2af4-7c97-ab30-1e863db0e8e3', true, '2026-02-10T19:14:16.391398+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019c06a8-2af5-705d-ae92-7905a846a500', true, '2026-02-10T19:14:16.391398+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019c06a8-2af5-766c-9713-315ab9567235', true, '2026-02-10T19:14:16.391398+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('019b3be4-3112-7786-ad7d-45ee39b86bc5', '019c06a8-2af6-727b-b94a-71bddc4d76de', true, '2026-02-10T19:14:16.391398+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
