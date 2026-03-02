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

{% if artifacts.attempt.get.entries.insights is defined and artifacts.attempt.get.entries.insights and artifacts.attempt.get.entries.insights|length > 0 %}
The following insights were previously generated:
{% for insight in artifacts.attempt.get.entries.insights %}
- {{ insight.content }}
{% endfor %}
{% else %}
No previous insights have been generated yet.
{% endif %}

## Domain Data

{% if artifacts.attempt.get.entries.attempt is defined and artifacts.attempt.get.entries.attempt %}
### Attempt
{{ artifacts.attempt.get.entries.attempt | tojson }}
{% endif %}

{% if artifacts.attempt.get.entries.attempt_chat is defined and artifacts.attempt.get.entries.attempt_chat %}
### Chat Data
{{ artifacts.attempt.get.entries.attempt_chat | tojson }}
{% endif %}

{% if artifacts.attempt.get.entries.attempt_message is defined and artifacts.attempt.get.entries.attempt_message %}
### Messages
{{ artifacts.attempt.get.entries.attempt_message | tojson }}
{% endif %}

{% if artifacts.attempt.get.entries.runs is defined and artifacts.attempt.get.entries.runs %}
### Runs
{{ artifacts.attempt.get.entries.runs | tojson }}
{% endif %}

## Available Resources

{% if artifacts.attempt.get.resources.scenarios is defined and artifacts.attempt.get.resources.scenarios %}
### Scenarios
{{ artifacts.attempt.get.resources.scenarios | tojson }}
{% endif %}

{% if artifacts.attempt.get.resources.personas is defined and artifacts.attempt.get.resources.personas %}
### Personas
{{ artifacts.attempt.get.resources.personas | tojson }}
{% endif %}

{% if artifacts.attempt.get.resources.rubrics is defined and artifacts.attempt.get.resources.rubrics %}
### Rubrics
{{ artifacts.attempt.get.resources.rubrics | tojson }}
{% endif %}

{% if artifacts.attempt.get.resources.standard_groups is defined and artifacts.attempt.get.resources.standard_groups %}
### Standard Groups
{{ artifacts.attempt.get.resources.standard_groups | tojson }}
{% endif %}

{% if artifacts.attempt.get.resources.standards is defined and artifacts.attempt.get.resources.standards %}
### Standards
{{ artifacts.attempt.get.resources.standards | tojson }}
{% endif %}

{% if artifacts.attempt.get.resources.documents is defined and artifacts.attempt.get.resources.documents %}
### Documents
{{ artifacts.attempt.get.resources.documents | tojson }}
{% endif %}

{% if artifacts.attempt.get.resources.objectives is defined and artifacts.attempt.get.resources.objectives %}
### Objectives
{{ artifacts.attempt.get.resources.objectives | tojson }}
{% endif %}

{% if artifacts.attempt.get.resources.questions is defined and artifacts.attempt.get.resources.questions %}
### Questions
{{ artifacts.attempt.get.resources.questions | tojson }}
{% endif %}

{% if artifacts.attempt.get.resources.options is defined and artifacts.attempt.get.resources.options %}
### Options
{{ artifacts.attempt.get.resources.options | tojson }}
{% endif %}

{% if artifacts.attempt.get.resources.problem_statements is defined and artifacts.attempt.get.resources.problem_statements %}
### Problem Statements
{{ artifacts.attempt.get.resources.problem_statements | tojson }}
{% endif %}

{% if artifacts.attempt.get.resources.images is defined and artifacts.attempt.get.resources.images %}
### Images
{{ artifacts.attempt.get.resources.images | tojson }}
{% endif %}

{% if artifacts.attempt.get.resources.videos is defined and artifacts.attempt.get.resources.videos %}
### Videos
{{ artifacts.attempt.get.resources.videos | tojson }}
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
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('018f0005-0001-7000-8000-000000000001', '018f0005-0002-7000-8000-000000000001', '2026-02-23T17:36:15.969225+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- Tools (args + tools_resource)
INSERT INTO public.args_resource (created_at, active, generated, mcp, id, name, description, field_type, required, default_value) VALUES ('2026-02-23T17:36:15.969225+00:00', true, false, false, '018f0001-0001-7000-8000-000000000001', 'insight_content', 'The analytical insight text', 'string', true, '') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (created_at, active, generated, mcp, id, name, description, field_type, required, default_value) VALUES ('2026-02-23T17:36:15.969225+00:00', true, false, false, '018f0001-0001-7000-8000-000000000002', 'insight_group_id', 'The group ID to attach the insight to', 'string', true, '') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (created_at, active, generated, mcp, id, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('2026-02-23T17:36:15.969225+00:00', true, false, false, '018f0002-0001-7000-8000-000000000002', 'create_attempt_insights', 'Create an attempt insight entry', '{}', 'create', '{018f0001-0001-7000-8000-000000000001,018f0001-0001-7000-8000-000000000002}', '{}', '{}'::text[], '{attempt_insights}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('018f0005-0001-7000-8000-000000000001', '018f0002-0001-7000-8000-000000000002', true, '2026-02-23T17:47:02.459307+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;

-- agents_resource (denormalized row for generation pipeline)
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voices, model_id, prompt_id, instruction_ids) VALUES ('2026-02-23T17:47:02.459307+00:00', true, false, false, '018f0005-0006-7000-8000-000000000001', 'Attempt Insight', 'AI agent for generating analytical insights about individual training attempts including performance, conversation quality, and skill development', '{}', 0, 'none', '{018f0002-0001-7000-8000-000000000002}', NULL, '{}', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '018f0005-0003-7000-8000-000000000001', '{018f0005-0004-7000-8000-000000000001}') ON CONFLICT (id) DO NOTHING;
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('018f0005-0001-7000-8000-000000000001', '018f0005-0006-7000-8000-000000000001', true, '2026-02-23T17:47:02.459307+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, active, created_at, generated, mcp)
SELECT '018f0005-0001-7000-8000-000000000001', ar.model_id, true, '2026-02-23T17:47:02.459307+00:00', false, false
FROM public.agents_resource ar
WHERE ar.id = '018f0005-0006-7000-8000-000000000001'
  AND ar.model_id IS NOT NULL
ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_reasoning_levels_junction
INSERT INTO public.agent_reasoning_levels_junction (agent_id, reasoning_level_id, active, created_at, generated, mcp)
SELECT '018f0005-0001-7000-8000-000000000001', rlr.id, true, '2026-02-23T17:47:02.459307+00:00', false, false
FROM public.agents_resource ar
JOIN public.reasoning_levels_resource rlr
  ON rlr.reasoning_level = ar.reasoning
 AND rlr.active = true
WHERE ar.id = '018f0005-0006-7000-8000-000000000001'
  AND ar.reasoning IS NOT NULL
ON CONFLICT (agent_id, reasoning_level_id) DO NOTHING;
-- agent_temperature_levels_junction
INSERT INTO public.agent_temperature_levels_junction (agent_id, temperature_level_id, active, created_at, generated, mcp)
SELECT '018f0005-0001-7000-8000-000000000001', tlr.id, true, '2026-02-23T17:47:02.459307+00:00', false, false
FROM public.agents_resource ar
JOIN public.temperature_levels_resource tlr
  ON tlr.temperature = ar.temperature
 AND tlr.active = true
WHERE ar.id = '018f0005-0006-7000-8000-000000000001'
  AND ar.temperature IS NOT NULL
ON CONFLICT (agent_id, temperature_level_id) DO NOTHING;
-- agent_voices_junction
INSERT INTO public.agent_voices_junction (agent_id, voice_id, active, created_at, generated, mcp)

SELECT DISTINCT '018f0005-0001-7000-8000-000000000001'::uuid, vr.id, true, '2026-02-23T17:47:02.459307+00:00'::timestamptz, false, false
FROM public.agents_resource ar
JOIN unnest(COALESCE(ar.voices, ARRAY[]::text[])) AS v(voice) ON true
JOIN public.voices_resource vr
  ON vr.voice = v.voice
 AND vr.active = true
WHERE ar.id = '018f0005-0006-7000-8000-000000000001'
ON CONFLICT (agent_id, voice_id) DO NOTHING;
