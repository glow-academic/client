-- Module: Attempt Insight
-- Category: agent
-- Description: Attempt Insight system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-02-23T17:47:02.459307+00:00', 'You are an analytical insights agent for individual training attempts. You analyze learner performance, conversation quality, rubric scores, and skill development within a single attempt session.

## Output Rules
- Call **create_attempt_insights** for each discrete insight — do not combine multiple observations into one call
- Each insight should be a focused, self-contained observation
- Lead with the most impactful finding
- Use specific scores and rubric references where available
- Compare against rubric standards and benchmarks
- Highlight both strengths and areas for improvement
- Do not output narrative text — all output must be valid tool calls', 'Attempt Insight Prompt', 'System prompt for attempt insight generation agent', true, '018f0005-0003-7000-8000-000000000001', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('018f0005-0005-7000-8000-000000000001', 'AI agent for generating analytical insights about individual training attempts including performance, conversation quality, and skill development', '2026-02-23T17:47:02.459307+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('018f0005-0004-7000-8000-000000000001', '## Previous Insights

{% if entries.insights is defined and entries.insights and entries.insights|length > 0 %}
The following insights were previously generated:
{% for insight in entries.insights %}
- {{ insight.content }}
{% endfor %}
{% else %}
No previous insights have been generated yet.
{% endif %}

## Domain Data

{% if entries.attempt is defined and entries.attempt %}
### Attempt
{{ entries.attempt | tojson }}
{% endif %}

{% if entries.attempt_chat is defined and entries.attempt_chat %}
### Chat Data
{{ entries.attempt_chat | tojson }}
{% endif %}

{% if entries.attempt_message is defined and entries.attempt_message %}
### Messages
{{ entries.attempt_message | tojson }}
{% endif %}

{% if entries.runs is defined and entries.runs %}
### Runs
{{ entries.runs | tojson }}
{% endif %}

## Available Resources

{% if resources.scenarios is defined and resources.scenarios %}
### Scenarios
{{ resources.scenarios | tojson }}
{% endif %}

{% if resources.personas is defined and resources.personas %}
### Personas
{{ resources.personas | tojson }}
{% endif %}

{% if resources.rubrics is defined and resources.rubrics %}
### Rubrics
{{ resources.rubrics | tojson }}
{% endif %}

{% if resources.standard_groups is defined and resources.standard_groups %}
### Standard Groups
{{ resources.standard_groups | tojson }}
{% endif %}

{% if resources.standards is defined and resources.standards %}
### Standards
{{ resources.standards | tojson }}
{% endif %}

{% if resources.documents is defined and resources.documents %}
### Documents
{{ resources.documents | tojson }}
{% endif %}

{% if resources.objectives is defined and resources.objectives %}
### Objectives
{{ resources.objectives | tojson }}
{% endif %}

{% if resources.questions is defined and resources.questions %}
### Questions
{{ resources.questions | tojson }}
{% endif %}

{% if resources.options is defined and resources.options %}
### Options
{{ resources.options | tojson }}
{% endif %}

{% if resources.problem_statements is defined and resources.problem_statements %}
### Problem Statements
{{ resources.problem_statements | tojson }}
{% endif %}

{% if resources.images is defined and resources.images %}
### Images
{{ resources.images | tojson }}
{% endif %}

{% if resources.videos is defined and resources.videos %}
### Videos
{{ resources.videos | tojson }}
{% endif %}

## Task

Analyze this attempt data and generate focused insights about learner performance, conversation quality, rubric scores, and skill development. Call **create_attempt_insights** once per discrete finding.', true, '2026-02-23T17:47:02.459307+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('018f0005-0002-7000-8000-000000000001', 'Attempt Insight', '2026-02-23T17:36:15.969225+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-23T17:36:15.969225+00:00', '2026-02-23T17:36:15.969225+00:00', '018f0005-0001-7000-8000-000000000001', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('018f0005-0001-7000-8000-000000000001', '018f0005-0005-7000-8000-000000000001', '2026-02-23T17:47:02.459307+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('018f0005-0001-7000-8000-000000000001', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-02-23T17:47:02.459307+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('018f0005-0001-7000-8000-000000000001', '018f0005-0004-7000-8000-000000000001', '2026-02-23T17:47:02.459307+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('018f0005-0001-7000-8000-000000000001', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '2026-02-23T17:47:02.459307+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('018f0005-0001-7000-8000-000000000001', '018f0005-0002-7000-8000-000000000001', '2026-02-23T17:36:15.969225+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2026-02-23T17:47:02.459307+00:00', '018f0005-0001-7000-8000-000000000001', '018f0005-0003-7000-8000-000000000001', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- Tools (args + tools_resource)
INSERT INTO public.args_resource (created_at, active, generated, mcp, id, name, description, field_type, required, default_value) VALUES ('2026-02-23T17:36:15.969225+00:00', true, false, false, '018f0001-0001-7000-8000-000000000001', 'insight_content', 'The analytical insight text', 'string', true, '') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (created_at, active, generated, mcp, id, name, description, field_type, required, default_value) VALUES ('2026-02-23T17:36:15.969225+00:00', true, false, false, '018f0001-0001-7000-8000-000000000002', 'insight_group_id', 'The group ID to attach the insight to', 'string', true, '') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (created_at, active, generated, mcp, id, name, description, resource, entry, artifact, createable, args_ids) VALUES ('2026-02-23T17:36:15.969225+00:00', true, false, false, '018f0002-0001-7000-8000-000000000002', 'create_attempt_insights', 'Create an attempt insight entry', NULL, 'attempt_insights', NULL, true, '{018f0001-0001-7000-8000-000000000001,018f0001-0001-7000-8000-000000000002}') ON CONFLICT (id) DO NOTHING;

-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('018f0005-0001-7000-8000-000000000001', '018f0002-0001-7000-8000-000000000002', true, '2026-02-23T17:47:02.459307+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;

-- agents_resource (denormalized row for generation pipeline)
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-23T17:47:02.459307+00:00', true, false, false, '018f0005-0006-7000-8000-000000000001', 'Attempt Insight', 'AI agent for generating analytical insights about individual training attempts including performance, conversation quality, and skill development', '{}', NULL, NULL, '{018f0002-0001-7000-8000-000000000002}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '018f0005-0003-7000-8000-000000000001', '{018f0005-0004-7000-8000-000000000001}') ON CONFLICT (id) DO NOTHING;
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('018f0005-0001-7000-8000-000000000001', '018f0005-0006-7000-8000-000000000001', true, '2026-02-23T17:47:02.459307+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
