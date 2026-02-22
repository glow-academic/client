-- Module: Benchmark
-- Category: agent
-- Description: Benchmark system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-02-22T00:20:46.593734+00:00', 'You are a benchmark configuration agent for benchmark execution running evaluations across model configurations.

## Your Role

Generate or update the configuration for a benchmark evaluation run. Set up the model, prompt, instructions, and tool bindings needed for the evaluation.

## Tools

- **create_names**: Create a name for the benchmark run
- **create_descriptions**: Create a description for the benchmark run
- **create_instructions**: Create an instruction template
- **create_models**: Create a model configuration
- **create_prompt**: Set the system prompt
- **create_keys**: Create an API key binding
- **create_reasoning_levels**: Create a reasoning level
- **create_temperature_levels**: Create a temperature level
- **create_voices**: Create a voice setting
- **use_names**: Use an existing name by its ID
- **use_descriptions**: Use an existing description by its ID
- **use_flags**: Use an existing flag by its ID
- **use_departments**: Use an existing department by its ID
- **use_instructions**: Use an existing instruction by its ID

## Guidelines

- Prefer using existing resources when suitable ones are available
- Create new resources only when nothing suitable exists
- Do not invent IDs — use IDs provided in context
- Keep outputs deterministic, concise, and production-safe
- Return only valid tool calls and arguments
- Do not output narrative text
', 'Benchmark Prompt', 'AI agent for benchmark configuration and evaluation run setup', true, '019c82b8-5dab-7e44-b183-540aef3f32c9', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-11T20:37:27.875564+00:00', true, false, false, 'aa000003-0000-0000-0000-000000000003', 'Benchmark', 'AI agent for generating and managing benchmark evaluation resources', '{}', NULL, NULL, '{019bebc4-d436-7c28-b7bf-f89de16c64d0,019bebc4-d436-7cc0-a482-5c0fad4f04e9,019bebc4-d436-7ccb-b52a-fa65793c95ce,019bebc4-d436-7ccc-9e9c-6f4b2a633f9d,019bebc4-d436-7bc7-a392-37e8b4549478,019bebc4-d436-7c20-b35a-73c9819b708a,019bebc4-d436-7c35-9f98-31957504bf95,019bebc4-d436-7c01-b86b-9483883762a6,019bebc4-d436-7c2e-af8f-40ed4aa3edaf,019c06a8-2af5-7f6a-aaa0-5a9aaa2ed10e,019c06a8-2af5-766c-9713-315ab9567235,019c06a8-2af4-7c97-ab30-1e863db0e8e3,019c06a8-2af5-705d-ae92-7905a846a500,019c06a8-2af6-727b-b94a-71bddc4d76de}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '019c82b8-5dab-7e44-b183-540aef3f32c9', '{019c82b8-5dac-71a9-892c-60b882fe931f}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('aa000002-0000-0000-0000-000000000002', 'AI agent for generating and managing benchmark evaluation resources', '2026-02-11T20:37:27.875564+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c82b8-5dac-71a9-892c-60b882fe931f', '## Context

{% set draft = views.draft_invocation if views and views.draft_invocation else None %}

{% if draft %}
### Current State
{{ draft | tojson }}
{% endif %}

{% if models and models|length > 0 %}
### Available Models
{% for item in models %}
- id: {{ item.id }} | name: {{ item.name }}
{% endfor %}
{% endif %}

{% if instructions and instructions|length > 0 %}
### Available Instructions
{% for item in instructions %}
- id: {{ item.id }} | template: {{ item.template[:80] }}{% if item.template|length > 80 %}...{% endif %}
{% endfor %}
{% endif %}

{% if departments and departments|length > 0 %}
### Available Departments
{% for item in departments %}
- id: {{ item.id }} | name: {{ item.name }}
{% endfor %}
{% endif %}

## Tool Usage

Use the tools listed in the system prompt. Prefer **use_*** tools when suitable resources already exist above.
', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('aa000001-0000-0000-0000-000000000001', 'Benchmark', '2026-02-11T20:37:27.875564+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-11T20:37:27.875564+00:00', '2026-02-11T20:37:27.875564+00:00', 'aabbccdd-aabb-ccdd-aabb-ccddaabbccdd', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('aabbccdd-aabb-ccdd-aabb-ccddaabbccdd', 'aa000003-0000-0000-0000-000000000003', true, '2026-02-13T03:41:54.664757+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('aabbccdd-aabb-ccdd-aabb-ccddaabbccdd', 'aa000002-0000-0000-0000-000000000002', '2026-02-11T20:37:27.875564+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('aabbccdd-aabb-ccdd-aabb-ccddaabbccdd', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-02-11T20:37:27.875564+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('aabbccdd-aabb-ccdd-aabb-ccddaabbccdd', '019c82b8-5dac-71a9-892c-60b882fe931f', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('aabbccdd-aabb-ccdd-aabb-ccddaabbccdd', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '2026-02-11T20:37:27.875564+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('aabbccdd-aabb-ccdd-aabb-ccddaabbccdd', 'aa000001-0000-0000-0000-000000000001', '2026-02-11T20:37:27.875564+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2026-02-22T00:20:46.593734+00:00', 'aabbccdd-aabb-ccdd-aabb-ccddaabbccdd', '019c82b8-5dab-7e44-b183-540aef3f32c9', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aabbccdd-aabb-ccdd-aabb-ccddaabbccdd', '019bebc4-d436-7c35-9f98-31957504bf95', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aabbccdd-aabb-ccdd-aabb-ccddaabbccdd', '019bebc4-d436-7c01-b86b-9483883762a6', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aabbccdd-aabb-ccdd-aabb-ccddaabbccdd', '019bebc4-d436-7c2e-af8f-40ed4aa3edaf', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aabbccdd-aabb-ccdd-aabb-ccddaabbccdd', '019bebc4-d436-7bc7-a392-37e8b4549478', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aabbccdd-aabb-ccdd-aabb-ccddaabbccdd', '019bebc4-d436-7c20-b35a-73c9819b708a', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aabbccdd-aabb-ccdd-aabb-ccddaabbccdd', '019bebc4-d436-7ccc-9e9c-6f4b2a633f9d', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aabbccdd-aabb-ccdd-aabb-ccddaabbccdd', '019bebc4-d436-7ccb-b52a-fa65793c95ce', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aabbccdd-aabb-ccdd-aabb-ccddaabbccdd', '019bebc4-d436-7cc0-a482-5c0fad4f04e9', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aabbccdd-aabb-ccdd-aabb-ccddaabbccdd', '019bebc4-d436-7c28-b7bf-f89de16c64d0', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aabbccdd-aabb-ccdd-aabb-ccddaabbccdd', '019c06a8-2af6-727b-b94a-71bddc4d76de', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aabbccdd-aabb-ccdd-aabb-ccddaabbccdd', '019c06a8-2af5-705d-ae92-7905a846a500', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aabbccdd-aabb-ccdd-aabb-ccddaabbccdd', '019c06a8-2af4-7c97-ab30-1e863db0e8e3', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aabbccdd-aabb-ccdd-aabb-ccddaabbccdd', '019c06a8-2af5-766c-9713-315ab9567235', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aabbccdd-aabb-ccdd-aabb-ccddaabbccdd', '019c06a8-2af5-7f6a-aaa0-5a9aaa2ed10e', true, '2026-02-11T20:37:27.875564+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
