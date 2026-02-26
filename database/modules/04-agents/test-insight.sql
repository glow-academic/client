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

{% if entries.insights is defined and entries.insights and entries.insights|length > 0 %}
The following insights were previously generated:
{% for insight in entries.insights %}
- {{ insight.content }}
{% endfor %}
{% else %}
No previous insights have been generated yet.
{% endif %}

## Domain Data

{% if entries.test is defined and entries.test %}
### Test Entry
{{ entries.test | tojson }}
{% endif %}

{% if entries.test_invocation is defined and entries.test_invocation %}
### Test Invocations
{{ entries.test_invocation | tojson }}
{% endif %}

{% if entries.runs is defined and entries.runs %}
### Runs
{{ entries.runs | tojson }}
{% endif %}

## Available Resources

{% if resources.evals is defined and resources.evals %}
### Evaluations
{{ resources.evals | tojson }}
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

{% if resources.names is defined and resources.names %}
### Names
{{ resources.names | tojson }}
{% endif %}

## Task

Analyze this test data and generate focused insights about model performance, rubric evaluation quality, and scoring patterns. Call **create_test_insights** once per discrete finding.', true, '2026-02-26T00:00:00.000000+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('018f0005-0002-7000-8000-000000000002', 'Test Insight', '2026-02-26T00:00:00.000000+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Tools (args + tools_resource)
INSERT INTO public.args_resource (created_at, active, generated, mcp, id, name, description, field_type, required, default_value) VALUES ('2026-02-26T00:00:00.000000+00:00', true, false, false, '018f0001-0001-7000-8000-000000000003', 'test_insight_content', 'The analytical insight text about test results', 'string', true, '') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.args_resource (created_at, active, generated, mcp, id, name, description, field_type, required, default_value) VALUES ('2026-02-26T00:00:00.000000+00:00', true, false, false, '018f0001-0001-7000-8000-000000000004', 'test_insight_group_id', 'The group ID to attach the insight to', 'string', true, '') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.tools_resource (created_at, active, generated, mcp, id, name, description, resource, entry, artifact, createable, args_ids) VALUES ('2026-02-26T00:00:00.000000+00:00', true, false, false, '018f0002-0001-7000-8000-000000000003', 'create_test_insights', 'Create a test insight entry', NULL, 'test_insights', NULL, true, '{018f0001-0001-7000-8000-000000000003,018f0001-0001-7000-8000-000000000004}') ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-26T00:00:00.000000+00:00', '2026-02-26T00:00:00.000000+00:00', '018f0005-0001-7000-8000-000000000002', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('018f0005-0001-7000-8000-000000000002', '018f0005-0005-7000-8000-000000000002', '2026-02-26T00:00:00.000000+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('018f0005-0001-7000-8000-000000000002', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-02-26T00:00:00.000000+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('018f0005-0001-7000-8000-000000000002', '018f0005-0004-7000-8000-000000000002', '2026-02-26T00:00:00.000000+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('018f0005-0001-7000-8000-000000000002', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '2026-02-26T00:00:00.000000+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('018f0005-0001-7000-8000-000000000002', '018f0005-0002-7000-8000-000000000002', '2026-02-26T00:00:00.000000+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2026-02-26T00:00:00.000000+00:00', '018f0005-0001-7000-8000-000000000002', '018f0005-0003-7000-8000-000000000002', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('018f0005-0001-7000-8000-000000000002', '018f0002-0001-7000-8000-000000000003', true, '2026-02-26T00:00:00.000000+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;

-- agents_resource (denormalized row for generation pipeline)
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-26T00:00:00.000000+00:00', true, false, false, '018f0005-0006-7000-8000-000000000002', 'Test Insight', 'AI agent for generating analytical insights about benchmark test results including model performance, rubric evaluation, and scoring quality', '{}', NULL, NULL, '{018f0002-0001-7000-8000-000000000003}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '018f0005-0003-7000-8000-000000000002', '{018f0005-0004-7000-8000-000000000002}') ON CONFLICT (id) DO NOTHING;
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('018f0005-0001-7000-8000-000000000002', '018f0005-0006-7000-8000-000000000002', true, '2026-02-26T00:00:00.000000+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
