-- Module: Group
-- Category: agent
-- Description: Group system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-02-22T00:20:46.593734+00:00', 'You are an analytical insights agent for group-level analytics. You analyze aggregated session data within a training run or cohort group, including group averages, outlier detection, and cohort comparisons.

## Output Rules
- Call **create_group_insights** for each discrete insight — do not combine multiple observations into one call
- Each insight should be a focused, self-contained observation
- Lead with the most impactful finding
- Use specific numbers and percentages where available
- Compare individual performance against group averages
- Identify outliers and patterns across the group
- Do not output narrative text — all output must be valid tool calls', 'Group Prompt', 'Analytical insights agent for group-level analytics', true, '019c82b8-5da3-781a-886e-52460eaf4f89', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voices, model_id, prompt_id, instruction_ids) VALUES ('2026-02-22T00:20:46.593734+00:00', true, false, false, '019c82b8-5da3-7920-b0c5-40255a3f8dc2', 'Group', 'Analytical insights agent for group-level analytics', '{}', 0, 'none', '{8abd2bea-d252-4a7c-857c-475147ff6877,019522a0-0020-7000-8000-000000000009}', NULL, '{}', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '019c82b8-5da3-781a-886e-52460eaf4f89', '{019c82b8-5da3-7875-ba86-43b9dd06c067}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5da3-7ad9-8f28-3eaef24d5e84', 'Analytical insights agent for group-level analytics', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c82b8-5da3-7875-ba86-43b9dd06c067', '## Previous Insights

{% if artifacts.group.get.entries.insights is defined and artifacts.group.get.entries.insights and artifacts.group.get.entries.insights|length > 0 %}
The following insights were previously generated:
{% for insight in artifacts.group.get.entries.insights %}
- {{ insight.content }}
{% endfor %}
{% else %}
No previous insights have been generated yet.
{% endif %}

## Domain Data

{% if artifacts.group.get.entries.group_runs is defined and artifacts.group.get.entries.group_runs %}
### Group Runs
{{ artifacts.group.get.entries.group_runs | tojson }}
{% endif %}

{% if artifacts.group.get.entries.messages is defined and artifacts.group.get.entries.messages %}
### Messages
{{ artifacts.group.get.entries.messages | tojson }}
{% endif %}

{% if artifacts.group.get.entries.calls is defined and artifacts.group.get.entries.calls %}
### LLM Calls
{{ artifacts.group.get.entries.calls | tojson }}
{% endif %}

{% if artifacts.group.get.entries.runs is defined and artifacts.group.get.entries.runs %}
### Runs
{{ artifacts.group.get.entries.runs | tojson }}
{% endif %}

## Task

Analyze the group data above and generate focused insights about group averages, outlier detection, cohort comparisons, and group-level trends. Call **create_group_insights** once per discrete finding.', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5da3-7a07-b166-779f7d07e24c', 'Group', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-22T00:20:46.593734+00:00', '2026-02-22T00:20:46.593734+00:00', 'ab00000f-0000-0000-0000-00000000000f', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('ab00000f-0000-0000-0000-00000000000f', '019c82b8-5da3-7920-b0c5-40255a3f8dc2', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, active, created_at, generated, mcp)
SELECT 'ab00000f-0000-0000-0000-00000000000f', ar.model_id, true, '2026-02-22T00:20:46.593734+00:00', false, false
FROM public.agents_resource ar
WHERE ar.id = '019c82b8-5da3-7920-b0c5-40255a3f8dc2'
  AND ar.model_id IS NOT NULL
ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_reasoning_levels_junction
INSERT INTO public.agent_reasoning_levels_junction (agent_id, reasoning_level_id, active, created_at, generated, mcp)
SELECT 'ab00000f-0000-0000-0000-00000000000f', rlr.id, true, '2026-02-22T00:20:46.593734+00:00', false, false
FROM public.agents_resource ar
JOIN public.reasoning_levels_resource rlr
  ON rlr.reasoning_level = ar.reasoning
 AND rlr.active = true
WHERE ar.id = '019c82b8-5da3-7920-b0c5-40255a3f8dc2'
  AND ar.reasoning IS NOT NULL
ON CONFLICT (agent_id, reasoning_level_id) DO NOTHING;
-- agent_temperature_levels_junction
INSERT INTO public.agent_temperature_levels_junction (agent_id, temperature_level_id, active, created_at, generated, mcp)
SELECT 'ab00000f-0000-0000-0000-00000000000f', tlr.id, true, '2026-02-22T00:20:46.593734+00:00', false, false
FROM public.agents_resource ar
JOIN public.temperature_levels_resource tlr
  ON tlr.temperature = ar.temperature
 AND tlr.active = true
WHERE ar.id = '019c82b8-5da3-7920-b0c5-40255a3f8dc2'
  AND ar.temperature IS NOT NULL
ON CONFLICT (agent_id, temperature_level_id) DO NOTHING;
-- agent_voices_junction
INSERT INTO public.agent_voices_junction (agent_id, voice_id, active, created_at, generated, mcp)

SELECT DISTINCT 'ab00000f-0000-0000-0000-00000000000f'::uuid, vr.id, true, '2026-02-22T00:20:46.593734+00:00'::timestamptz, false, false
FROM public.agents_resource ar
JOIN unnest(COALESCE(ar.voices, ARRAY[]::text[])) AS v(voice) ON true
JOIN public.voices_resource vr
  ON vr.voice = v.voice
 AND vr.active = true
WHERE ar.id = '019c82b8-5da3-7920-b0c5-40255a3f8dc2'
ON CONFLICT (agent_id, voice_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('ab00000f-0000-0000-0000-00000000000f', '019c82b8-5da3-7ad9-8f28-3eaef24d5e84', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('ab00000f-0000-0000-0000-00000000000f', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('ab00000f-0000-0000-0000-00000000000f', '019c82b8-5da3-7a07-b166-779f7d07e24c', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab00000f-0000-0000-0000-00000000000f', '019522a0-0020-7000-8000-000000000009', true, '2026-02-24T11:27:01.778199+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
