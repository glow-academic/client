-- Module: Agent
-- Category: agent
-- Description: Agent system agent
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bcd1b-0ca6-789c-9a76-7890886df5e7', 'AI agent for generating and managing agent resources including names, descriptions, flags, departments, prompts, instructions, models, and tools using GPT-5.1', '2026-01-17T17:57:40.643852+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c2f13-4200-7c00-8000-000000000001', '## Current Draft Context
{% set draft = views.draft_agent if views and views.draft_agent else None %}
- draft_id: {{ draft.draft_id if draft else ''none'' }}
- regeneration_descriptions: {{ draft.regeneration_descriptions if draft else [] }}

## Current Selected Resources
- names: {{ names or [] }}
- descriptions: {{ descriptions or [] }}
- models: {{ models or [] }}
- prompts: {{ prompts or [] }}
- instructions: {{ instructions or [] }}
- flags: {{ flags or [] }}
- departments: {{ departments or [] }}
- tools: {{ tools or [] }}
- temperature_levels: {{ temperature_levels or [] }}
- reasoning_levels: {{ reasoning_levels or [] }}
- voices: {{ voices or [] }}

## Rules
- Process only requested resource_types.
- Reuse valid existing resources where possible.
- Create resources only for missing or weak selections.
- Keep naming/description specific and non-generic.
- Keep model/prompt/instruction consistency high.', true, '2026-02-10T19:12:47.645232+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bcd1b-0ca6-75a6-8b1c-c88ec47260b2', 'Agent', '2026-01-17T17:57:40.643852+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-01-17T17:57:40.643852+00:00', 'You are the Agent Artifact Generation Agent for v4.

Generate or update only the requested resource_types for an agent artifact:
names, descriptions, models, prompts, instructions, flags, departments, tools, temperature_levels, reasoning_levels, voices.

Rules:
- Operate only on requested resource_types.
- Prefer using existing suitable resources before creating new ones.
- Do not invent IDs. Use IDs provided in context.
- Keep outputs deterministic, concise, and production-safe.
- Keep model/prompt/instruction alignment coherent for the agent role.

Output:
- Return only valid tool calls and arguments.
- Do not output narrative text.', 'Agent Agent System Prompt', 'System prompt for agent generation agents', true, '88888888-9999-9999-9999-888888888888', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7bc7-a392-37e8b4549478', '2026-01-17T17:57:40.643852+00:00', false, false, true, 'create_prompt', 'Set system prompt', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7bf6-af0e-91e685a8f15e', '2026-01-17T17:58:56.069266+00:00', false, false, true, 'create_departments', 'Create a new departments resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c01-b86b-9483883762a6', '2026-01-17T17:58:56.073128+00:00', false, false, true, 'create_descriptions', 'Create a new descriptions resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c14-a42e-f45a12c4fdb0', '2026-01-17T17:58:56.073128+00:00', false, false, true, 'create_flags', 'Create a new flags resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c20-b35a-73c9819b708a', '2026-01-17T17:57:40.643852+00:00', false, false, true, 'create_instructions', 'Create a new instructions resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c2e-af8f-40ed4aa3edaf', '2026-01-17T17:57:40.643852+00:00', false, false, true, 'create_models', 'Create a new models resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c35-9f98-31957504bf95', '2026-01-17T17:58:56.073128+00:00', false, false, true, 'create_names', 'Create a new names resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7cc0-a482-5c0fad4f04e9', '2026-01-17T17:57:40.647526+00:00', false, false, true, 'create_reasoning_levels', 'Create a new reasoning level resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7ccb-b52a-fa65793c95ce', '2026-01-17T17:57:40.647526+00:00', false, false, true, 'create_temperature_levels', 'Create a new temperature level resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7ccc-9e9c-6f4b2a633f9d', '2026-01-17T17:57:40.647526+00:00', false, false, true, 'create_voices', 'Create a new voice resource', '{}', false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-01-17T17:57:40.643852+00:00', '2026-01-17T17:57:40.643852+00:00', '88888888-8888-8888-8888-888888888888', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('88888888-8888-8888-8888-888888888888', '019bcd1b-0ca6-789c-9a76-7890886df5e7', '2026-01-17T17:57:40.643852+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('88888888-8888-8888-8888-888888888888', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-01-17T17:57:40.643852+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('88888888-8888-8888-8888-888888888888', '019c2f13-4200-7c00-8000-000000000001', '2026-02-10T19:12:47.645232+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('88888888-8888-8888-8888-888888888888', '019b3be4-36cd-7888-842b-8c6f8dfb363b', '2026-01-17T17:57:40.643852+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('88888888-8888-8888-8888-888888888888', '019bcd1b-0ca6-75a6-8b1c-c88ec47260b2', '2026-01-17T17:57:40.643852+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2026-01-17T17:57:40.643852+00:00', '88888888-8888-8888-8888-888888888888', '88888888-9999-9999-9999-888888888888', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('88888888-8888-8888-8888-888888888888', '019bebc4-d436-7bc7-a392-37e8b4549478', true, '2026-01-17T17:57:40.643852+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('88888888-8888-8888-8888-888888888888', '019bebc4-d436-7bf6-af0e-91e685a8f15e', true, '2026-01-17T17:57:40.643852+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('88888888-8888-8888-8888-888888888888', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-01-17T17:57:40.643852+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('88888888-8888-8888-8888-888888888888', '019bebc4-d436-7c14-a42e-f45a12c4fdb0', true, '2026-01-17T17:57:40.643852+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('88888888-8888-8888-8888-888888888888', '019bebc4-d436-7c20-b35a-73c9819b708a', true, '2026-01-17T17:57:40.643852+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('88888888-8888-8888-8888-888888888888', '019bebc4-d436-7c2e-af8f-40ed4aa3edaf', true, '2026-01-17T17:57:40.643852+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('88888888-8888-8888-8888-888888888888', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-01-17T17:57:40.643852+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('88888888-8888-8888-8888-888888888888', '019bebc4-d436-7cc0-a482-5c0fad4f04e9', true, '2026-01-17T17:57:40.643852+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('88888888-8888-8888-8888-888888888888', '019bebc4-d436-7ccb-b52a-fa65793c95ce', true, '2026-01-17T17:57:40.643852+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('88888888-8888-8888-8888-888888888888', '019bebc4-d436-7ccc-9e9c-6f4b2a633f9d', true, '2026-01-17T17:57:40.643852+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
