-- Module: Tool
-- Category: agent
-- Description: Tool system agent
-- ============================================================


-- Resource rows
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019bb774-4bd7-703a-a176-c7cce89f82cc', 'AI agent for generating and managing tool resources', '2026-01-13T13:03:30.772189+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019bb774-4bda-7cd8-b492-db414f7617fd', '## Current Draft Context
{% set draft = views.draft_tool if views and views.draft_tool else None %}
- draft_id: {{ draft.draft_id if draft else ''none'' }}
- regeneration_descriptions: {{ draft.regeneration_descriptions if draft else [] }}

## Current Selected Resources
- names: {{ names or [] }}
- descriptions: {{ descriptions or [] }}
- args: {{ args or [] }}
- args_outputs: {{ args_outputs or [] }}
- flags: {{ flags or [] }}

## Rules
- Process only requested resource_types.
- Reuse suitable existing resources where possible.
- Create args/args_outputs only when the current schema is incomplete.
- Keep args_outputs aligned to actual returned fields from create tools.', true, '2026-01-13T13:03:30.778438+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019bb774-4bd6-7baf-ada4-fb8d903f66bd', 'Tool', '2026-01-13T13:03:30.772189+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-01-13T13:03:30.768696+00:00', 'You are the Tool Artifact Generation Agent for v4.

Generate or update only the requested tool resource_types:
names, descriptions, args, args_outputs, flags.

Rules:
- Operate only on requested resource_types.
- Prefer existing suitable resources when available.
- Create only what is needed for missing or weak selections.
- Keep argument schemas coherent with expected tool inputs/outputs.
- Do not invent IDs; use IDs from context when linking.

Output:
- Return only valid tool calls and arguments.
- Do not output narrative text.', 'Tool Agent System Prompt', 'System prompt for tool generation agents that create and manage tool resources', true, 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af5-705d-ae92-7905a846a500', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_descriptions', 'Use an existing description resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af5-766c-9713-315ab9567235', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_flags', 'Use an existing flag resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019c06a8-2af6-727b-b94a-71bddc4d76de', '2026-01-28T22:10:10.283595+00:00', false, false, true, 'use_names', 'Use an existing name resource instead of creating a new one', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c01-b86b-9483883762a6', '2026-01-17T17:58:56.073128+00:00', false, false, true, 'create_descriptions', 'Create a new descriptions resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c14-a42e-f45a12c4fdb0', '2026-01-17T17:58:56.073128+00:00', false, false, true, 'create_flags', 'Create a new flags resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7c35-9f98-31957504bf95', '2026-01-17T17:58:56.073128+00:00', false, false, true, 'create_names', 'Create a new names resource', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7d16-8107-8dc0086e3182', '2026-01-15T02:40:56.685940+00:00', false, false, true, 'create_args', 'Create an argument field for a tool', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-7d1d-9e14-3299c8677730', '2026-01-15T02:40:56.692128+00:00', false, false, true, 'create_args_outputs', 'Create an output template for a tool argument', '{}', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (id, created_at, generated, mcp, active, name, description, department_ids, createable) VALUES ('019bebc4-d436-78e3-ae05-f12509f43557', '2026-01-17T17:57:40.542955+00:00', false, false, true, 'create_template', 'Create a dynamic document using a template. The template schema defines the required fields and their types. This tool accepts template-specific arguments based on the template schema.', '{}', false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-01-13T13:03:30.772189+00:00', '2026-01-13T13:03:30.772189+00:00', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '019bb774-4bd7-703a-a176-c7cce89f82cc', '2026-01-13T13:03:30.772189+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-01-13T13:03:30.772189+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '019bb774-4bda-7cd8-b492-db414f7617fd', '2026-01-13T13:03:30.778438+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '019b3be4-36cd-7888-842b-8c6f8dfb363b', '2026-01-13T13:03:30.772189+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '019bb774-4bd6-7baf-ada4-fb8d903f66bd', '2026-01-13T13:03:30.772189+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2026-01-13T13:03:30.772189+00:00', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '019c06a8-2af5-705d-ae92-7905a846a500', true, '2026-02-10T19:13:36.011239+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '019c06a8-2af5-766c-9713-315ab9567235', true, '2026-02-10T19:13:36.011239+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '019c06a8-2af6-727b-b94a-71bddc4d76de', true, '2026-02-10T19:13:36.011239+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-01-17T17:57:40.542955+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '019bebc4-d436-7c14-a42e-f45a12c4fdb0', true, '2026-02-10T19:13:36.011239+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-01-17T17:57:40.542955+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '019bebc4-d436-7d16-8107-8dc0086e3182', true, '2026-01-15T02:40:56.685940+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '019bebc4-d436-7d1d-9e14-3299c8677730', true, '2026-01-15T02:40:56.692128+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '019bebc4-d436-78e3-ae05-f12509f43557', false, '2026-01-17T17:57:40.542955+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
