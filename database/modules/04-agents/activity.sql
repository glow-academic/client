-- Module: Activity
-- Category: agent
-- Description: Activity system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-02-22T00:20:46.593734+00:00', 'You are an analytical insights agent for the activity view. You analyze real-time and recent platform activity including sessions, logins, audit trails, errors, and usage patterns.

## Output Rules
- Call **create_activity_insights** for each discrete insight — do not combine multiple observations into one call
- Each insight should be a focused, self-contained observation
- Lead with the most impactful finding
- Use specific numbers and percentages where available
- Include comparative context (e.g., "15% increase vs last period" not just "15%")
- Flag items needing immediate attention separately from trends
- Do not output narrative text — all output must be valid tool calls', 'Activity Prompt', 'Analytical insights agent for real-time activity monitoring', true, '019c82b8-5da0-7534-8c4f-986a06726c09', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-22T00:20:46.593734+00:00', true, false, false, '019c82b8-5da0-7643-85e9-141ecd4b1235', 'Activity', 'Analytical insights agent for real-time activity monitoring', '{}', NULL, NULL, '{8abd2bea-d252-4a7c-857c-475147ff6877,019522a0-0020-7000-8000-000000000001}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '019c82b8-5da0-7534-8c4f-986a06726c09', '{019c82b8-5da0-7596-a925-85b2b098ea22}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5da0-7782-aa3d-0720ff17f14e', 'Analytical insights agent for real-time activity monitoring', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c82b8-5da0-7596-a925-85b2b098ea22', '## Previous Insights

{% if entries.insights is defined and entries.insights and entries.insights|length > 0 %}
The following insights were previously generated:
{% for insight in entries.insights %}
- {{ insight.content }}
{% endfor %}
{% else %}
No previous insights have been generated yet.
{% endif %}

## Domain Data

{% if entries.sessions is defined and entries.sessions %}
### Sessions
{{ entries.sessions | tojson }}
{% endif %}

{% if entries.activity is defined and entries.activity %}
### Activity
{{ entries.activity | tojson }}
{% endif %}

{% if entries.logins is defined and entries.logins %}
### Logins
{{ entries.logins | tojson }}
{% endif %}

{% if entries.audits is defined and entries.audits %}
### Audit Trail
{{ entries.audits | tojson }}
{% endif %}

{% if entries.problems is defined and entries.problems %}
### Problems
{{ entries.problems | tojson }}
{% endif %}

{% if entries.grants is defined and entries.grants %}
### Grants
{{ entries.grants | tojson }}
{% endif %}

{% if entries.runs is defined and entries.runs %}
### Runs
{{ entries.runs | tojson }}
{% endif %}

## Task

Analyze the activity data above and generate focused insights about recent actions, active sessions, error patterns, and usage spikes. Call **create_activity_insights** once per discrete finding.', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5da0-7724-8617-b89e19986ebe', 'Activity', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-22T00:20:46.593734+00:00', '2026-02-22T00:20:46.593734+00:00', 'ab00000a-0000-0000-0000-00000000000a', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('ab00000a-0000-0000-0000-00000000000a', '019c82b8-5da0-7643-85e9-141ecd4b1235', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('ab00000a-0000-0000-0000-00000000000a', '019c82b8-5da0-7782-aa3d-0720ff17f14e', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('ab00000a-0000-0000-0000-00000000000a', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('ab00000a-0000-0000-0000-00000000000a', '019c82b8-5da0-7596-a925-85b2b098ea22', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('ab00000a-0000-0000-0000-00000000000a', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('ab00000a-0000-0000-0000-00000000000a', '019c82b8-5da0-7724-8617-b89e19986ebe', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2026-02-22T00:20:46.593734+00:00', 'ab00000a-0000-0000-0000-00000000000a', '019c82b8-5da0-7534-8c4f-986a06726c09', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab00000a-0000-0000-0000-00000000000a', '019522a0-0020-7000-8000-000000000001', true, '2026-02-24T11:27:01.778199+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
