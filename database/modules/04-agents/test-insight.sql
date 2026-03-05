-- Module: Test Insight
-- Category: agent
-- Description: Test Insight system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-02-26T00:00:00.000000+00:00', 'You are an analytical insights agent for benchmark test results. You analyze model performance, rubric scores, and evaluation quality within a single test session.

## Output Rules
- Call **create_test_insights** for each discrete insight — do not combine multiple observations into one call
- Each insight should be a focused, self-contained observation
- Lead with the most impactful finding
- Use specific scores and rubric references where available
- Compare against rubric standards and benchmarks
- Highlight both strengths and areas for improvement
- Do not output narrative text — all output must be valid tool calls', 'Test Insight Prompt', 'System prompt for test insight generation agent', true, '018f0005-0003-7000-8000-000000000002', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('018f0005-0005-7000-8000-000000000002', 'AI agent for generating analytical insights about benchmark test results including model performance, rubric evaluation, and scoring quality', '2026-02-26T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('018f0005-0004-7000-8000-000000000002', '## Previous Insights

{% if artifacts.test.get.entries.insights is defined and artifacts.test.get.entries.insights and artifacts.test.get.entries.insights|length > 0 %}
The following insights were previously generated:
{% for insight in artifacts.test.get.entries.insights %}
- {{ insight.content }}
{% endfor %}
{% else %}
No previous insights have been generated yet.
{% endif %}

## Domain Data

{% if artifacts.test.get.entries.test is defined and artifacts.test.get.entries.test %}
### Test Entry
{{ artifacts.test.get.entries.test | tojson }}
{% endif %}

{% if artifacts.test.get.entries.test_invocation is defined and artifacts.test.get.entries.test_invocation %}
### Test Invocations
{{ artifacts.test.get.entries.test_invocation | tojson }}
{% endif %}

{% if artifacts.test.get.entries.runs is defined and artifacts.test.get.entries.runs %}
### Runs
{{ artifacts.test.get.entries.runs | tojson }}
{% endif %}

## Available Resources

{% if artifacts.test.get.resources.evals is defined and artifacts.test.get.resources.evals %}
### Evaluations
{{ artifacts.test.get.resources.evals | tojson }}
{% endif %}

{% if artifacts.test.get.resources.rubrics is defined and artifacts.test.get.resources.rubrics %}
### Rubrics
{{ artifacts.test.get.resources.rubrics | tojson }}
{% endif %}

{% if artifacts.test.get.resources.standard_groups is defined and artifacts.test.get.resources.standard_groups %}
### Standard Groups
{{ artifacts.test.get.resources.standard_groups | tojson }}
{% endif %}

{% if artifacts.test.get.resources.standards is defined and artifacts.test.get.resources.standards %}
### Standards
{{ artifacts.test.get.resources.standards | tojson }}
{% endif %}

{% if artifacts.test.get.resources.names is defined and artifacts.test.get.resources.names %}
### Names
{{ artifacts.test.get.resources.names | tojson }}
{% endif %}

## Task

Analyze this test data and generate focused insights about model performance, rubric evaluation quality, and scoring patterns. Call **create_test_insights** once per discrete finding.', true, '2026-02-26T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('018f0005-0002-7000-8000-000000000002', 'Test Insight', '2026-02-26T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-26T00:00:00.000000+00:00', '2026-02-26T00:00:00.000000+00:00', '018f0005-0001-7000-8000-000000000002', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('018f0005-0001-7000-8000-000000000002', '018f0005-0005-7000-8000-000000000002', '2026-02-26T00:00:00.000000+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, created_at, generated, mcp, active) VALUES ('018f0005-0001-7000-8000-000000000002', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', '2026-02-26T00:00:00.000000+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('018f0005-0001-7000-8000-000000000002', '018f0005-0002-7000-8000-000000000002', '2026-02-26T00:00:00.000000+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('018f0005-0001-7000-8000-000000000002', '018f0002-0001-7000-8000-000000000003', true, '2026-02-26T00:00:00.000000+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;

-- agents_resource (denormalized row for generation pipeline)
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voices, model_id, prompt_id, instruction_ids) VALUES ('2026-02-26T00:00:00.000000+00:00', true, false, false, '018f0005-0006-7000-8000-000000000002', 'Test Insight', 'AI agent for generating analytical insights about benchmark test results including model performance, rubric evaluation, and scoring quality', '{}', 0, 'none', '{018f0002-0001-7000-8000-000000000003}', NULL, '{}', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '018f0005-0003-7000-8000-000000000002', '{018f0005-0004-7000-8000-000000000002}') ON CONFLICT (id) DO NOTHING;
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('018f0005-0001-7000-8000-000000000002', '018f0005-0006-7000-8000-000000000002', true, '2026-02-26T00:00:00.000000+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, active, created_at, generated, mcp)
SELECT '018f0005-0001-7000-8000-000000000002', ar.model_id, true, '2026-02-26T00:00:00.000000+00:00', false, false
FROM public.agents_resource ar
WHERE ar.id = '018f0005-0006-7000-8000-000000000002'
  AND ar.model_id IS NOT NULL
ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_reasoning_levels_junction
INSERT INTO public.agent_reasoning_levels_junction (agent_id, reasoning_level_id, active, created_at, generated, mcp)
SELECT '018f0005-0001-7000-8000-000000000002', rlr.id, true, '2026-02-26T00:00:00.000000+00:00', false, false
FROM public.agents_resource ar
JOIN public.reasoning_levels_resource rlr
  ON rlr.reasoning_level = ar.reasoning
 AND rlr.active = true
WHERE ar.id = '018f0005-0006-7000-8000-000000000002'
  AND ar.reasoning IS NOT NULL
ON CONFLICT (agent_id, reasoning_level_id) DO NOTHING;
-- agent_temperature_levels_junction
INSERT INTO public.agent_temperature_levels_junction (agent_id, temperature_level_id, active, created_at, generated, mcp)
SELECT '018f0005-0001-7000-8000-000000000002', tlr.id, true, '2026-02-26T00:00:00.000000+00:00', false, false
FROM public.agents_resource ar
JOIN public.temperature_levels_resource tlr
  ON tlr.temperature = ar.temperature
 AND tlr.active = true
WHERE ar.id = '018f0005-0006-7000-8000-000000000002'
  AND ar.temperature IS NOT NULL
ON CONFLICT (agent_id, temperature_level_id) DO NOTHING;
-- agent_voices_junction
INSERT INTO public.agent_voices_junction (agent_id, voice_id, active, created_at, generated, mcp)

SELECT DISTINCT '018f0005-0001-7000-8000-000000000002'::uuid, vr.id, true, '2026-02-26T00:00:00.000000+00:00'::timestamptz, false, false
FROM public.agents_resource ar
JOIN unnest(COALESCE(ar.voices, ARRAY[]::text[])) AS v(voice) ON true
JOIN public.voices_resource vr
  ON vr.voice = v.voice
 AND vr.active = true
WHERE ar.id = '018f0005-0006-7000-8000-000000000002'
ON CONFLICT (agent_id, voice_id) DO NOTHING;
