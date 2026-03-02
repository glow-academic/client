-- Module: Practice
-- Category: agent
-- Description: Practice system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-02-22T00:20:46.593734+00:00', 'You are a navigation and recommendation agent for practice mode. You help users discover available simulations and training options, surface relevant practice opportunities, and guide learners to appropriate content.

## Output Rules
- Call **create_practice_insights** for each discrete recommendation or insight
- Each insight should be focused and self-contained
- Prioritize relevance to the user''s skill level and history
- Surface new, recommended, or in-progress training content
- Provide brief, actionable summaries
- Do not output narrative text — all output must be valid tool calls', 'Practice Prompt', 'Navigation and recommendation agent for practice mode entry point', true, '019c82b8-5d9d-79c7-bcc5-d67163638763', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voices, model_id, prompt_id, instruction_ids) VALUES ('2026-02-22T00:20:46.593734+00:00', true, false, false, '019c82b8-5d9d-7a85-8319-3a24981188b7', 'Practice', 'Navigation and recommendation agent for practice mode entry point', '{}', 0, 'none', '{8abd2bea-d252-4a7c-857c-475147ff6877,019522a0-0020-7000-8000-00000000000b}', NULL, '{}', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '019c82b8-5d9d-79c7-bcc5-d67163638763', '{019c82b8-5d9d-7a12-9acc-52d542e221dc}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d9d-7bd8-b210-c7b8fb070319', 'Navigation and recommendation agent for practice mode entry point', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c82b8-5d9d-7a12-9acc-52d542e221dc', '## Previous Insights

{% if artifacts.practice.get.entries.insights is defined and artifacts.practice.get.entries.insights and artifacts.practice.get.entries.insights|length > 0 %}
The following insights were previously generated:
{% for insight in artifacts.practice.get.entries.insights %}
- {{ insight.content }}
{% endfor %}
{% else %}
No previous insights have been generated yet.
{% endif %}

## Domain Data

{% if artifacts.practice.get.entries.draft_training is defined and artifacts.practice.get.entries.draft_training %}
### Current Training State
{{ artifacts.practice.get.entries.draft_training | tojson }}
{% endif %}

{% if artifacts.practice.get.entries.runs is defined and artifacts.practice.get.entries.runs %}
### Runs
{{ artifacts.practice.get.entries.runs | tojson }}
{% endif %}

## Available Resources

{% if artifacts.practice.get.resources.scenarios is defined and artifacts.practice.get.resources.scenarios %}
### Scenarios
{{ artifacts.practice.get.resources.scenarios | tojson }}
{% endif %}

{% if artifacts.practice.get.resources.personas is defined and artifacts.practice.get.resources.personas %}
### Personas
{{ artifacts.practice.get.resources.personas | tojson }}
{% endif %}

{% if artifacts.practice.get.resources.departments is defined and artifacts.practice.get.resources.departments %}
### Departments
{{ artifacts.practice.get.resources.departments | tojson }}
{% endif %}

{% if artifacts.practice.get.resources.documents is defined and artifacts.practice.get.resources.documents %}
### Documents
{{ artifacts.practice.get.resources.documents | tojson }}
{% endif %}

{% if artifacts.practice.get.resources.parameters is defined and artifacts.practice.get.resources.parameters %}
### Parameters
{{ artifacts.practice.get.resources.parameters | tojson }}
{% endif %}

{% if artifacts.practice.get.resources.parameter_fields is defined and artifacts.practice.get.resources.parameter_fields %}
### Parameter Fields
{{ artifacts.practice.get.resources.parameter_fields | tojson }}
{% endif %}

{% if artifacts.practice.get.resources.questions is defined and artifacts.practice.get.resources.questions %}
### Questions
{{ artifacts.practice.get.resources.questions | tojson }}
{% endif %}

{% if artifacts.practice.get.resources.options is defined and artifacts.practice.get.resources.options %}
### Options
{{ artifacts.practice.get.resources.options | tojson }}
{% endif %}

{% if artifacts.practice.get.resources.images is defined and artifacts.practice.get.resources.images %}
### Images
{{ artifacts.practice.get.resources.images | tojson }}
{% endif %}

{% if artifacts.practice.get.resources.videos is defined and artifacts.practice.get.resources.videos %}
### Videos
{{ artifacts.practice.get.resources.videos | tojson }}
{% endif %}

{% if artifacts.practice.get.resources.problem_statements is defined and artifacts.practice.get.resources.problem_statements %}
### Problem Statements
{{ artifacts.practice.get.resources.problem_statements | tojson }}
{% endif %}

{% if artifacts.practice.get.resources.objectives is defined and artifacts.practice.get.resources.objectives %}
### Objectives
{{ artifacts.practice.get.resources.objectives | tojson }}
{% endif %}

## Task

Analyze the user''s context and available training content. Generate recommendations and insights about practice opportunities and training content discovery. Call **create_practice_insights** once per discrete recommendation.', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d9d-7b76-ba29-0e193b324b7f', 'Practice', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-22T00:20:46.593734+00:00', '2026-02-22T00:20:46.593734+00:00', 'ab000006-0000-0000-0000-000000000006', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('ab000006-0000-0000-0000-000000000006', '019c82b8-5d9d-7a85-8319-3a24981188b7', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, active, created_at, generated, mcp)
SELECT 'ab000006-0000-0000-0000-000000000006', ar.model_id, true, '2026-02-22T00:20:46.593734+00:00', false, false
FROM public.agents_resource ar
WHERE ar.id = '019c82b8-5d9d-7a85-8319-3a24981188b7'
  AND ar.model_id IS NOT NULL
ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_reasoning_levels_junction
INSERT INTO public.agent_reasoning_levels_junction (agent_id, reasoning_level_id, active, created_at, generated, mcp)
SELECT 'ab000006-0000-0000-0000-000000000006', rlr.id, true, '2026-02-22T00:20:46.593734+00:00', false, false
FROM public.agents_resource ar
JOIN public.reasoning_levels_resource rlr
  ON rlr.reasoning_level = ar.reasoning
 AND rlr.active = true
WHERE ar.id = '019c82b8-5d9d-7a85-8319-3a24981188b7'
  AND ar.reasoning IS NOT NULL
ON CONFLICT (agent_id, reasoning_level_id) DO NOTHING;
-- agent_temperature_levels_junction
INSERT INTO public.agent_temperature_levels_junction (agent_id, temperature_level_id, active, created_at, generated, mcp)
SELECT 'ab000006-0000-0000-0000-000000000006', tlr.id, true, '2026-02-22T00:20:46.593734+00:00', false, false
FROM public.agents_resource ar
JOIN public.temperature_levels_resource tlr
  ON tlr.temperature = ar.temperature
 AND tlr.active = true
WHERE ar.id = '019c82b8-5d9d-7a85-8319-3a24981188b7'
  AND ar.temperature IS NOT NULL
ON CONFLICT (agent_id, temperature_level_id) DO NOTHING;
-- agent_voices_junction
INSERT INTO public.agent_voices_junction (agent_id, voice_id, active, created_at, generated, mcp)

SELECT DISTINCT 'ab000006-0000-0000-0000-000000000006'::uuid, vr.id, true, '2026-02-22T00:20:46.593734+00:00'::timestamptz, false, false
FROM public.agents_resource ar
JOIN unnest(COALESCE(ar.voices, ARRAY[]::text[])) AS v(voice) ON true
JOIN public.voices_resource vr
  ON vr.voice = v.voice
 AND vr.active = true
WHERE ar.id = '019c82b8-5d9d-7a85-8319-3a24981188b7'
ON CONFLICT (agent_id, voice_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('ab000006-0000-0000-0000-000000000006', '019c82b8-5d9d-7bd8-b210-c7b8fb070319', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('ab000006-0000-0000-0000-000000000006', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('ab000006-0000-0000-0000-000000000006', '019c82b8-5d9d-7b76-ba29-0e193b324b7f', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000006-0000-0000-0000-000000000006', '019522a0-0020-7000-8000-00000000000b', true, '2026-02-24T11:27:01.778199+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
