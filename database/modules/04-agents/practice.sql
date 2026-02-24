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
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-22T00:20:46.593734+00:00', true, false, false, '019c82b8-5d9d-7a85-8319-3a24981188b7', 'Practice', 'Navigation and recommendation agent for practice mode entry point', '{}', NULL, NULL, '{8abd2bea-d252-4a7c-857c-475147ff6877}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '019c82b8-5d9d-79c7-bcc5-d67163638763', '{019c82b8-5d9d-7a12-9acc-52d542e221dc}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d9d-7bd8-b210-c7b8fb070319', 'Navigation and recommendation agent for practice mode entry point', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c82b8-5d9d-7a12-9acc-52d542e221dc', '## Previous Insights

{% if entries.insights is defined and entries.insights and entries.insights|length > 0 %}
The following insights were previously generated:
{% for insight in entries.insights %}
- {{ insight.content }}
{% endfor %}
{% else %}
No previous insights have been generated yet.
{% endif %}

## Domain Data

{% if entries.draft_training is defined and entries.draft_training %}
### Current Training State
{{ entries.draft_training | tojson }}
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

{% if resources.departments is defined and resources.departments %}
### Departments
{{ resources.departments | tojson }}
{% endif %}

{% if resources.documents is defined and resources.documents %}
### Documents
{{ resources.documents | tojson }}
{% endif %}

{% if resources.parameters is defined and resources.parameters %}
### Parameters
{{ resources.parameters | tojson }}
{% endif %}

{% if resources.parameter_fields is defined and resources.parameter_fields %}
### Parameter Fields
{{ resources.parameter_fields | tojson }}
{% endif %}

{% if resources.questions is defined and resources.questions %}
### Questions
{{ resources.questions | tojson }}
{% endif %}

{% if resources.options is defined and resources.options %}
### Options
{{ resources.options | tojson }}
{% endif %}

{% if resources.images is defined and resources.images %}
### Images
{{ resources.images | tojson }}
{% endif %}

{% if resources.videos is defined and resources.videos %}
### Videos
{{ resources.videos | tojson }}
{% endif %}

{% if resources.problem_statements is defined and resources.problem_statements %}
### Problem Statements
{{ resources.problem_statements | tojson }}
{% endif %}

{% if resources.objectives is defined and resources.objectives %}
### Objectives
{{ resources.objectives | tojson }}
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
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('ab000006-0000-0000-0000-000000000006', '019c82b8-5d9d-7bd8-b210-c7b8fb070319', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('ab000006-0000-0000-0000-000000000006', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('ab000006-0000-0000-0000-000000000006', '019c82b8-5d9d-7a12-9acc-52d542e221dc', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('ab000006-0000-0000-0000-000000000006', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('ab000006-0000-0000-0000-000000000006', '019c82b8-5d9d-7b76-ba29-0e193b324b7f', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2026-02-22T00:20:46.593734+00:00', 'ab000006-0000-0000-0000-000000000006', '019c82b8-5d9d-79c7-bcc5-d67163638763', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000006-0000-0000-0000-000000000006', '018f0002-0001-7000-8000-000000000008', true, '2026-02-23T17:36:15.969225+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
