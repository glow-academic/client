-- Module: Benchmark
-- Category: agent
-- Description: Benchmark system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-02-22T00:20:46.593734+00:00', 'You are an analytical insights agent for benchmark evaluation results. You analyze cross-model performance, rubric scoring patterns, and evaluation quality across benchmark test sessions.

## Output Rules
- Call **create_benchmark_insights** for each discrete insight — do not combine multiple observations into one call
- Each insight should be a focused, self-contained observation
- Lead with the most impactful finding
- Use specific scores and rubric references where available
- Compare across models, configurations, and rubric standards
- Highlight both strengths and areas for improvement
- Do not output narrative text — all output must be valid tool calls', 'Benchmark Prompt', 'System prompt for benchmark insight generation agent', true, '019c82b8-5dab-7e44-b183-540aef3f32c9', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('aa000002-0000-0000-0000-000000000002', 'AI agent for generating analytical insights about benchmark evaluation results including cross-model performance and scoring quality', '2026-02-11T20:37:27.875564+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c82b8-5dac-71a9-892c-60b882fe931f', '## Previous Insights

{% if artifacts.benchmark.get.entries.insights is defined and artifacts.benchmark.get.entries.insights and artifacts.benchmark.get.entries.insights|length > 0 %}
The following insights were previously generated:
{% for insight in artifacts.benchmark.get.entries.insights %}
- {{ insight.content }}
{% endfor %}
{% else %}
No previous insights have been generated yet.
{% endif %}

## Domain Data

{% if artifacts.benchmark.get.entries.test is defined and artifacts.benchmark.get.entries.test %}
### Test Entry
{{ artifacts.benchmark.get.entries.test | tojson }}
{% endif %}

{% if artifacts.benchmark.get.entries.test_invocation is defined and artifacts.benchmark.get.entries.test_invocation %}
### Test Invocations
{{ artifacts.benchmark.get.entries.test_invocation | tojson }}
{% endif %}

{% if artifacts.benchmark.get.entries.runs is defined and artifacts.benchmark.get.entries.runs %}
### Runs
{{ artifacts.benchmark.get.entries.runs | tojson }}
{% endif %}

## Available Resources

{% if artifacts.benchmark.get.resources.evals is defined and artifacts.benchmark.get.resources.evals %}
### Evaluations
{{ artifacts.benchmark.get.resources.evals | tojson }}
{% endif %}

{% if artifacts.benchmark.get.resources.rubrics is defined and artifacts.benchmark.get.resources.rubrics %}
### Rubrics
{{ artifacts.benchmark.get.resources.rubrics | tojson }}
{% endif %}

{% if artifacts.benchmark.get.resources.standard_groups is defined and artifacts.benchmark.get.resources.standard_groups %}
### Standard Groups
{{ artifacts.benchmark.get.resources.standard_groups | tojson }}
{% endif %}

{% if artifacts.benchmark.get.resources.standards is defined and artifacts.benchmark.get.resources.standards %}
### Standards
{{ artifacts.benchmark.get.resources.standards | tojson }}
{% endif %}

{% if artifacts.benchmark.get.resources.names is defined and artifacts.benchmark.get.resources.names %}
### Names
{{ artifacts.benchmark.get.resources.names | tojson }}
{% endif %}

## Task

Analyze this benchmark data and generate focused insights about cross-model performance, rubric evaluation quality, and scoring patterns. Call **create_benchmark_insights** once per discrete finding.', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (id) DO NOTHING;

-- Tools (args + tools_resource)
INSERT INTO public.args_resource (created_at, active, generated, mcp, id, name, description, field_type, required, default_value) VALUES ('2026-02-26T00:00:00.000000+00:00', true, false, false, '018f0001-0001-7000-8000-000000000005', 'benchmark_insight_content', 'The analytical insight text about benchmark results', 'string', true, '') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (created_at, active, generated, mcp, id, name, description, field_type, required, default_value) VALUES ('2026-02-26T00:00:00.000000+00:00', true, false, false, '018f0001-0001-7000-8000-000000000006', 'benchmark_insight_group_id', 'The group ID to attach the insight to', 'string', true, '') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (created_at, active, generated, mcp, id, name, description, department_ids, operation, args_ids, args_output_ids, resources, entries, artifacts) VALUES ('2026-02-26T00:00:00.000000+00:00', true, false, false, '018f0002-0001-7000-8000-000000000004', 'create_benchmark_insights', 'Create a benchmark insight entry', '{}', 'create', '{018f0001-0001-7000-8000-000000000005,018f0001-0001-7000-8000-000000000006}', '{}', '{}'::text[], '{benchmark_insights}'::text[], '{}'::text[]) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voices, model_id, prompt_id, instruction_ids) VALUES ('2026-02-11T20:37:27.875564+00:00', true, false, false, 'aa000003-0000-0000-0000-000000000003', 'Benchmark', 'AI agent for generating analytical insights about benchmark evaluation results including cross-model performance and scoring quality', '{}', 0, 'none', '{018f0002-0001-7000-8000-000000000004}', NULL, '{}', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '019c82b8-5dab-7e44-b183-540aef3f32c9', '{019c82b8-5dac-71a9-892c-60b882fe931f}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('aa000001-0000-0000-0000-000000000001', 'Benchmark', '2026-02-11T20:37:27.875564+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-11T20:37:27.875564+00:00', '2026-02-11T20:37:27.875564+00:00', 'aabbccdd-aabb-ccdd-aabb-ccddaabbccdd', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('aabbccdd-aabb-ccdd-aabb-ccddaabbccdd', 'aa000003-0000-0000-0000-000000000003', true, '2026-02-13T03:41:54.664757+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, active, created_at, generated, mcp)
SELECT 'aabbccdd-aabb-ccdd-aabb-ccddaabbccdd', ar.model_id, true, '2026-02-13T03:41:54.664757+00:00', false, false
FROM public.agents_resource ar
WHERE ar.id = 'aa000003-0000-0000-0000-000000000003'
  AND ar.model_id IS NOT NULL
ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_reasoning_levels_junction
INSERT INTO public.agent_reasoning_levels_junction (agent_id, reasoning_level_id, active, created_at, generated, mcp)
SELECT 'aabbccdd-aabb-ccdd-aabb-ccddaabbccdd', rlr.id, true, '2026-02-13T03:41:54.664757+00:00', false, false
FROM public.agents_resource ar
JOIN public.reasoning_levels_resource rlr
  ON rlr.reasoning_level = ar.reasoning
 AND rlr.active = true
WHERE ar.id = 'aa000003-0000-0000-0000-000000000003'
  AND ar.reasoning IS NOT NULL
ON CONFLICT (agent_id, reasoning_level_id) DO NOTHING;
-- agent_temperature_levels_junction
INSERT INTO public.agent_temperature_levels_junction (agent_id, temperature_level_id, active, created_at, generated, mcp)
SELECT 'aabbccdd-aabb-ccdd-aabb-ccddaabbccdd', tlr.id, true, '2026-02-13T03:41:54.664757+00:00', false, false
FROM public.agents_resource ar
JOIN public.temperature_levels_resource tlr
  ON tlr.temperature = ar.temperature
 AND tlr.active = true
WHERE ar.id = 'aa000003-0000-0000-0000-000000000003'
  AND ar.temperature IS NOT NULL
ON CONFLICT (agent_id, temperature_level_id) DO NOTHING;
-- agent_voices_junction
INSERT INTO public.agent_voices_junction (agent_id, voice_id, active, created_at, generated, mcp)

SELECT DISTINCT 'aabbccdd-aabb-ccdd-aabb-ccddaabbccdd'::uuid, vr.id, true, '2026-02-13T03:41:54.664757+00:00'::timestamptz, false, false
FROM public.agents_resource ar
JOIN unnest(COALESCE(ar.voices, ARRAY[]::text[])) AS v(voice) ON true
JOIN public.voices_resource vr
  ON vr.voice = v.voice
 AND vr.active = true
WHERE ar.id = 'aa000003-0000-0000-0000-000000000003'
ON CONFLICT (agent_id, voice_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('aabbccdd-aabb-ccdd-aabb-ccddaabbccdd', 'aa000002-0000-0000-0000-000000000002', '2026-02-11T20:37:27.875564+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('aabbccdd-aabb-ccdd-aabb-ccddaabbccdd', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-02-11T20:37:27.875564+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('aabbccdd-aabb-ccdd-aabb-ccddaabbccdd', 'aa000001-0000-0000-0000-000000000001', '2026-02-11T20:37:27.875564+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('aabbccdd-aabb-ccdd-aabb-ccddaabbccdd', '018f0002-0001-7000-8000-000000000004', true, '2026-02-26T00:00:00.000000+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
