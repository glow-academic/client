-- Module: Model
-- Category: agent
-- Description: Model system agent
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bcd1b-0ca8-79db-bc63-4cc38e3deb3c', 'AI agent for generating and managing model resources including names, descriptions, flags, departments, endpoints, keys, modalities, and providers using GPT-5.1', '2026-01-17T17:57:40.647526+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c2f13-4200-7c00-8000-000000000002', '## Current Draft Context
{% set draft = views.draft_model if views and views.draft_model else None %}
- draft_id: {{ draft.draft_id if draft else ''none'' }}
- regeneration_descriptions: {{ draft.regeneration_descriptions if draft else [] }}

## Current Selected Resources
- names: {{ names or [] }}
- descriptions: {{ descriptions or [] }}
- values: {{ values or [] }}
- providers: {{ providers or [] }}
- flags: {{ flags or [] }}
- departments: {{ departments or [] }}
- modalities: {{ modalities or [] }}
- temperature_levels: {{ temperature_levels or [] }}
- pricing: {{ pricing or [] }}
- reasoning_levels: {{ reasoning_levels or [] }}
- qualities: {{ qualities or [] }}
- voices: {{ voices or [] }}

## Rules
- Process only requested resource_types.
- Reuse valid existing resources where possible.
- Create resources only for missing or weak selections.
- Keep value/provider/modalities/pricing/reasoning coherence.
- Keep names/descriptions explicit and non-generic.', true, '2026-02-10T19:12:47.645232+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bcd1b-0ca8-7707-aee4-65c33067f0bb', 'Model', '2026-01-17T17:57:40.647526+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-01-17T17:57:40.647526+00:00', 'You are the Model Artifact Generation Agent for v4.

Generate or update only the requested resource_types for a model artifact:
names, descriptions, values, providers, flags, departments, modalities, temperature_levels, pricing, reasoning_levels, qualities, voices.

Rules:
- Operate only on requested resource_types.
- Prefer using existing suitable resources before creating new ones.
- Do not invent IDs. Use IDs provided in context.
- Keep outputs deterministic, concise, and production-safe.
- Keep value/provider/modalities/pricing/reasoning/quality settings internally coherent.

Output:
- Return only valid tool calls and arguments.
- Do not output narrative text.', 'Model Agent System Prompt', 'System prompt for model generation agents', true, '99999999-aaaa-aaaa-aaaa-999999999999', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7bf6-af0e-91e685a8f15e', '2026-01-17T17:58:56.069266+00:00', false, false, true, 'create_departments', 'Create a new departments resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c01-b86b-9483883762a6', '2026-01-17T17:58:56.073128+00:00', false, false, true, 'create_descriptions', 'Create a new descriptions resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c14-a42e-f45a12c4fdb0', '2026-01-17T17:58:56.073128+00:00', false, false, true, 'create_flags', 'Create a new flags resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c35-9f98-31957504bf95', '2026-01-17T17:58:56.073128+00:00', false, false, true, 'create_names', 'Create a new names resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c5e-b441-5b0c8673e4db', '2026-01-17T17:57:40.647526+00:00', false, false, true, 'create_providers', 'Create a new providers resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7cc0-a482-5c0fad4f04e9', '2026-01-17T17:57:40.647526+00:00', false, false, true, 'create_reasoning_levels', 'Create a new reasoning level resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7ccb-b52a-fa65793c95ce', '2026-01-17T17:57:40.647526+00:00', false, false, true, 'create_temperature_levels', 'Create a new temperature level resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7ccc-9e9c-6f4b2a633f9d', '2026-01-17T17:57:40.647526+00:00', false, false, true, 'create_voices', 'Create a new voice resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7ce4-83f1-2299dc3bbd35', '2026-01-17T17:57:40.647526+00:00', false, false, true, 'create_modalities', 'Create a new modalities resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7cec-b8a7-a31628d74ae4', '2026-01-17T17:57:40.647526+00:00', false, false, true, 'create_pricing', 'Create a new pricing resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7cf0-9617-f44d4e7a6d71', '2026-01-17T17:57:40.647526+00:00', false, false, true, 'create_qualities', 'Create a new qualities resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7d12-8233-8e29598e4620', '2026-01-17T17:58:56.073128+00:00', false, false, true, 'create_values', 'Create a new values resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c28-b7bf-f89de16c64d0', '2026-01-17T17:57:40.647526+00:00', false, false, true, 'create_keys', 'Create a new keys resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c81-832a-a4a08d2b50f6', '2026-01-17T17:57:40.647526+00:00', false, false, true, 'create_endpoints', 'Create a new endpoint', '{}', false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-01-17T17:57:40.647526+00:00', '2026-01-17T17:57:40.647526+00:00', '99999999-9999-9999-9999-999999999999', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('99999999-9999-9999-9999-999999999999', '019bcd1b-0ca8-79db-bc63-4cc38e3deb3c', '2026-01-17T17:57:40.647526+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('99999999-9999-9999-9999-999999999999', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-01-17T17:57:40.647526+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('99999999-9999-9999-9999-999999999999', '019c2f13-4200-7c00-8000-000000000002', '2026-02-10T19:12:47.645232+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('99999999-9999-9999-9999-999999999999', '019b3be4-36cd-7888-842b-8c6f8dfb363b', '2026-01-17T17:57:40.647526+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('99999999-9999-9999-9999-999999999999', '019bcd1b-0ca8-7707-aee4-65c33067f0bb', '2026-01-17T17:57:40.647526+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2026-01-17T17:57:40.647526+00:00', '99999999-9999-9999-9999-999999999999', '99999999-aaaa-aaaa-aaaa-999999999999', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7bf6-af0e-91e685a8f15e', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7c14-a42e-f45a12c4fdb0', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7c5e-b441-5b0c8673e4db', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7cc0-a482-5c0fad4f04e9', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7ccb-b52a-fa65793c95ce', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7ccc-9e9c-6f4b2a633f9d', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7ce4-83f1-2299dc3bbd35', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7cec-b8a7-a31628d74ae4', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7cf0-9617-f44d4e7a6d71', true, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7d12-8233-8e29598e4620', true, '2026-02-10T19:12:47.645232+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7c28-b7bf-f89de16c64d0', false, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('99999999-9999-9999-9999-999999999999', '019bebc4-d436-7c81-832a-a4a08d2b50f6', false, '2026-01-17T17:57:40.647526+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
