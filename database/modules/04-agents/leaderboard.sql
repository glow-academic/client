-- Module: Leaderboard
-- Category: agent
-- Description: Leaderboard system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-02-22T00:20:46.593734+00:00', 'You are an analytical insights agent for the leaderboard view. You analyze performance rankings across profiles, departments, and training programs to identify top performers, improvement trajectories, and competitive patterns.

## Output Rules
- Call **create_leaderboard_insights** for each discrete insight — do not combine multiple observations into one call
- Each insight should be a focused, self-contained observation
- Lead with the most impactful finding
- Use specific scores, rankings, and percentages where available
- Include comparative context (e.g., "ranked 3rd, up from 8th last month")
- Highlight both top performers and most-improved
- Do not output narrative text — all output must be valid tool calls', 'Leaderboard Prompt', 'Analytical insights agent for performance rankings', true, '019c82b8-5da2-7de5-b392-0e7c6779eff4', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voices, model_id, prompt_id, instruction_ids) VALUES ('2026-02-22T00:20:46.593734+00:00', true, false, false, '019c82b8-5da2-7ef3-b402-8117f8199299', 'Leaderboard', 'Analytical insights agent for performance rankings', '{}', 0, 'none', '{8abd2bea-d252-4a7c-857c-475147ff6877,019522a0-0020-7000-8000-000000000004}', NULL, '{}', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '019c82b8-5da2-7de5-b392-0e7c6779eff4', '{019c82b8-5da2-7e46-b851-7e32afd67f15}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5da3-702f-819f-8ec3d99c4b6f', 'Analytical insights agent for performance rankings', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c82b8-5da2-7e46-b851-7e32afd67f15', '## Previous Insights

{% if artifacts.leaderboard.get.entries.insights is defined and artifacts.leaderboard.get.entries.insights and artifacts.leaderboard.get.entries.insights|length > 0 %}
The following insights were previously generated:
{% for insight in artifacts.leaderboard.get.entries.insights %}
- {{ insight.content }}
{% endfor %}
{% else %}
No previous insights have been generated yet.
{% endif %}

## Domain Data

{% if artifacts.leaderboard.get.entries.runs is defined and artifacts.leaderboard.get.entries.runs %}
### Runs
{{ artifacts.leaderboard.get.entries.runs | tojson }}
{% endif %}

## Task

Analyze the leaderboard data above and generate focused insights about score rankings, improvement trajectories, top performers, and competitive analysis. Call **create_leaderboard_insights** once per discrete finding.', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5da2-7fcf-bb6d-6a8bd2fb4a05', 'Leaderboard', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-22T00:20:46.593734+00:00', '2026-02-22T00:20:46.593734+00:00', 'ab00000e-0000-0000-0000-00000000000e', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('ab00000e-0000-0000-0000-00000000000e', '019c82b8-5da2-7ef3-b402-8117f8199299', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, models_id, active, created_at, generated, mcp)
SELECT 'ab00000e-0000-0000-0000-00000000000e', ar.model_id, true, '2026-02-22T00:20:46.593734+00:00', false, false
FROM public.agents_resource ar
WHERE ar.id = '019c82b8-5da2-7ef3-b402-8117f8199299'
  AND ar.model_id IS NOT NULL
ON CONFLICT (agent_id, models_id) DO NOTHING;
-- agent_reasoning_levels_junction
INSERT INTO public.agent_reasoning_levels_junction (agent_id, reasoning_levels_id, active, created_at, generated, mcp)
SELECT 'ab00000e-0000-0000-0000-00000000000e', rlr.id, true, '2026-02-22T00:20:46.593734+00:00', false, false
FROM public.agents_resource ar
JOIN public.reasoning_levels_resource rlr
  ON rlr.reasoning_level = ar.reasoning
 AND rlr.active = true
WHERE ar.id = '019c82b8-5da2-7ef3-b402-8117f8199299'
  AND ar.reasoning IS NOT NULL
ON CONFLICT (agent_id, reasoning_levels_id) DO NOTHING;
-- agent_temperature_levels_junction
INSERT INTO public.agent_temperature_levels_junction (agent_id, temperature_levels_id, active, created_at, generated, mcp)
SELECT 'ab00000e-0000-0000-0000-00000000000e', tlr.id, true, '2026-02-22T00:20:46.593734+00:00', false, false
FROM public.agents_resource ar
JOIN public.temperature_levels_resource tlr
  ON tlr.temperature = ar.temperature
 AND tlr.active = true
WHERE ar.id = '019c82b8-5da2-7ef3-b402-8117f8199299'
  AND ar.temperature IS NOT NULL
ON CONFLICT (agent_id, temperature_levels_id) DO NOTHING;
-- agent_voices_junction
INSERT INTO public.agent_voices_junction (agent_id, voices_id, active, created_at, generated, mcp)

SELECT DISTINCT 'ab00000e-0000-0000-0000-00000000000e'::uuid, vr.id, true, '2026-02-22T00:20:46.593734+00:00'::timestamptz, false, false
FROM public.agents_resource ar
JOIN unnest(COALESCE(ar.voices, ARRAY[]::text[])) AS v(voice) ON true
JOIN public.voices_resource vr
  ON vr.voice = v.voice
 AND vr.active = true
WHERE ar.id = '019c82b8-5da2-7ef3-b402-8117f8199299'
ON CONFLICT (agent_id, voices_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, descriptions_id, created_at, generated, mcp, active) VALUES ('ab00000e-0000-0000-0000-00000000000e', '019c82b8-5da3-702f-819f-8ec3d99c4b6f', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, descriptions_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flags_id, created_at, generated, mcp, active) VALUES ('ab00000e-0000-0000-0000-00000000000e', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, flags_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, names_id, created_at, generated, mcp, active) VALUES ('ab00000e-0000-0000-0000-00000000000e', '019c82b8-5da2-7fcf-bb6d-6a8bd2fb4a05', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, names_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tools_id, active, created_at, generated, mcp) VALUES ('ab00000e-0000-0000-0000-00000000000e', '019522a0-0020-7000-8000-000000000004', true, '2026-02-24T11:27:01.778199+00:00', false, false) ON CONFLICT (agent_id, tools_id) DO NOTHING;
