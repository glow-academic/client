-- Module: Dashboard
-- Category: agent
-- Description: Dashboard system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-02-22T00:20:46.593734+00:00', 'You are an analytical insights agent for the dashboard view. You analyze high-level organizational KPIs, usage trends, department comparisons, and executive summaries.

## Output Rules
- Call **create_dashboard_insights** for each discrete insight — do not combine multiple observations into one call
- Each insight should be a focused, self-contained observation
- Lead with the most impactful finding
- Use specific numbers and percentages where available
- Include comparative context (e.g., "15% increase vs last period" not just "15%")
- Highlight cross-department patterns and organizational trends
- Do not output narrative text — all output must be valid tool calls', 'Dashboard Prompt', 'Analytical insights agent for high-level organizational KPIs and trends', true, '019c82b8-5d9e-74ad-b6c3-6902661c88c7', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-22T00:20:46.593734+00:00', true, false, false, '019c82b8-5d9e-75d2-9cf7-e0f91bb0fb38', 'Dashboard', 'Analytical insights agent for high-level organizational KPIs and trends', '{}', NULL, NULL, '{8abd2bea-d252-4a7c-857c-475147ff6877,019522a0-0020-7000-8000-000000000002}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '019c82b8-5d9e-74ad-b6c3-6902661c88c7', '{019c82b8-5d9e-7511-a124-6b571e673d57}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d9e-7881-8420-7617df0cea24', 'Analytical insights agent for high-level organizational KPIs and trends', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c82b8-5d9e-7511-a124-6b571e673d57', '## Previous Insights

{% if entries.insights is defined and entries.insights and entries.insights|length > 0 %}
The following insights were previously generated:
{% for insight in entries.insights %}
- {{ insight.content }}
{% endfor %}
{% else %}
No previous insights have been generated yet.
{% endif %}

## Domain Data

{% if entries.runs is defined and entries.runs %}
### Runs
{{ entries.runs | tojson }}
{% endif %}

## Task

Analyze the dashboard data above and generate focused insights about key performance indicators, usage trends, department comparisons, and executive-level summaries. Call **create_dashboard_insights** once per discrete finding.', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d9e-76c0-ac29-37d85a0dddd8', 'Dashboard', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-22T00:20:46.593734+00:00', '2026-02-22T00:20:46.593734+00:00', 'ab000007-0000-0000-0000-000000000007', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('ab000007-0000-0000-0000-000000000007', '019c82b8-5d9e-75d2-9cf7-e0f91bb0fb38', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('ab000007-0000-0000-0000-000000000007', '019c82b8-5d9e-7881-8420-7617df0cea24', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('ab000007-0000-0000-0000-000000000007', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('ab000007-0000-0000-0000-000000000007', '019c82b8-5d9e-7511-a124-6b571e673d57', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('ab000007-0000-0000-0000-000000000007', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('ab000007-0000-0000-0000-000000000007', '019c82b8-5d9e-76c0-ac29-37d85a0dddd8', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2026-02-22T00:20:46.593734+00:00', 'ab000007-0000-0000-0000-000000000007', '019c82b8-5d9e-74ad-b6c3-6902661c88c7', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000007-0000-0000-0000-000000000007', '019522a0-0020-7000-8000-000000000002', true, '2026-02-24T11:27:01.778199+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
