-- Module: Session
-- Category: agent
-- Description: Session system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-02-22T00:20:46.593734+00:00', 'You are an analytical insights agent for individual training sessions. You analyze chat-level and attempt-level detail including conversation quality, rubric adherence, time-on-task, and per-attempt scoring.

## Output Rules
- Call **create_session_insights** for each discrete insight — do not combine multiple observations into one call
- Each insight should be a focused, self-contained observation
- Lead with the most impactful finding
- Use specific scores, timing data, and rubric references where available
- Analyze conversation quality and learner engagement
- Compare across attempts within the session
- Do not output narrative text — all output must be valid tool calls', 'Session Prompt', 'Analytical insights agent for individual training session analytics', true, '019c82b8-5da0-7f61-8721-41d670ec0be0', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voices, model_id, prompt_id, instruction_ids) VALUES ('2026-02-22T00:20:46.593734+00:00', true, false, false, '019c82b8-5da1-709c-ad48-dc0a2ec99a49', 'Session', 'Analytical insights agent for individual training session analytics', '{}', 0, 'none', '{8abd2bea-d252-4a7c-857c-475147ff6877,019522a0-0020-7000-8000-000000000008}', NULL, '{}', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '019c82b8-5da0-7f61-8721-41d670ec0be0', '{019c82b8-5da0-7fbf-aeb1-122ca8ebd0c9}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5da1-71d9-8081-b0c5ab77da95', 'Analytical insights agent for individual training session analytics', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c82b8-5da0-7fbf-aeb1-122ca8ebd0c9', '## Previous Insights

{% if artifacts.session.get.entries.insights is defined and artifacts.session.get.entries.insights and artifacts.session.get.entries.insights|length > 0 %}
The following insights were previously generated:
{% for insight in artifacts.session.get.entries.insights %}
- {{ insight.content }}
{% endfor %}
{% else %}
No previous insights have been generated yet.
{% endif %}

## Domain Data

{% if artifacts.session.get.entries.groups is defined and artifacts.session.get.entries.groups %}
### Groups
{{ artifacts.session.get.entries.groups | tojson }}
{% endif %}

{% if artifacts.session.get.entries.audits is defined and artifacts.session.get.entries.audits %}
### Audit Trail
{{ artifacts.session.get.entries.audits | tojson }}
{% endif %}

{% if artifacts.session.get.entries.runs is defined and artifacts.session.get.entries.runs %}
### Runs
{{ artifacts.session.get.entries.runs | tojson }}
{% endif %}

## Task

Analyze this training session data and generate focused insights about conversation quality, rubric adherence, time-on-task, and per-attempt scoring. Call **create_session_insights** once per discrete finding.', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5da1-717e-9295-dc7bf795a749', 'Session', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-22T00:20:46.593734+00:00', '2026-02-22T00:20:46.593734+00:00', 'ab00000b-0000-0000-0000-00000000000b', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('ab00000b-0000-0000-0000-00000000000b', '019c82b8-5da1-709c-ad48-dc0a2ec99a49', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, active, created_at, generated, mcp)
SELECT 'ab00000b-0000-0000-0000-00000000000b', ar.model_id, true, '2026-02-22T00:20:46.593734+00:00', false, false
FROM public.agents_resource ar
WHERE ar.id = '019c82b8-5da1-709c-ad48-dc0a2ec99a49'
  AND ar.model_id IS NOT NULL
ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_reasoning_levels_junction
INSERT INTO public.agent_reasoning_levels_junction (agent_id, reasoning_level_id, active, created_at, generated, mcp)
SELECT 'ab00000b-0000-0000-0000-00000000000b', rlr.id, true, '2026-02-22T00:20:46.593734+00:00', false, false
FROM public.agents_resource ar
JOIN public.reasoning_levels_resource rlr
  ON rlr.reasoning_level = ar.reasoning
 AND rlr.active = true
WHERE ar.id = '019c82b8-5da1-709c-ad48-dc0a2ec99a49'
  AND ar.reasoning IS NOT NULL
ON CONFLICT (agent_id, reasoning_level_id) DO NOTHING;
-- agent_temperature_levels_junction
INSERT INTO public.agent_temperature_levels_junction (agent_id, temperature_level_id, active, created_at, generated, mcp)
SELECT 'ab00000b-0000-0000-0000-00000000000b', tlr.id, true, '2026-02-22T00:20:46.593734+00:00', false, false
FROM public.agents_resource ar
JOIN public.temperature_levels_resource tlr
  ON tlr.temperature = ar.temperature
 AND tlr.active = true
WHERE ar.id = '019c82b8-5da1-709c-ad48-dc0a2ec99a49'
  AND ar.temperature IS NOT NULL
ON CONFLICT (agent_id, temperature_level_id) DO NOTHING;
-- agent_voices_junction
INSERT INTO public.agent_voices_junction (agent_id, voice_id, active, created_at, generated, mcp)

SELECT DISTINCT 'ab00000b-0000-0000-0000-00000000000b'::uuid, vr.id, true, '2026-02-22T00:20:46.593734+00:00'::timestamptz, false, false
FROM public.agents_resource ar
JOIN unnest(COALESCE(ar.voices, ARRAY[]::text[])) AS v(voice) ON true
JOIN public.voices_resource vr
  ON vr.voice = v.voice
 AND vr.active = true
WHERE ar.id = '019c82b8-5da1-709c-ad48-dc0a2ec99a49'
ON CONFLICT (agent_id, voice_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('ab00000b-0000-0000-0000-00000000000b', '019c82b8-5da1-71d9-8081-b0c5ab77da95', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, created_at, generated, mcp, active) VALUES ('ab00000b-0000-0000-0000-00000000000b', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('ab00000b-0000-0000-0000-00000000000b', '019c82b8-5da1-717e-9295-dc7bf795a749', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab00000b-0000-0000-0000-00000000000b', '019522a0-0020-7000-8000-000000000008', true, '2026-02-24T11:27:01.778199+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
