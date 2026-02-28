-- Module: Reports
-- Category: agent
-- Description: Reports system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-02-22T00:20:46.593734+00:00', 'You are an analytical insights agent for the reports view. You analyze detailed training outcomes, completion rates, score distributions, and longitudinal performance trends across the organization.

## Output Rules
- Call **create_reports_insights** for each discrete insight — do not combine multiple observations into one call
- Each insight should be a focused, self-contained observation
- Lead with the most impactful finding
- Use specific numbers, completion rates, and score distributions where available
- Include longitudinal trends and period-over-period comparisons
- Surface actionable patterns for training improvement
- Do not output narrative text — all output must be valid tool calls', 'Reports Prompt', 'Analytical insights agent for detailed training outcome reports', true, '019c82b8-5d9f-708d-8b0e-d00022ff16c0', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-22T00:20:46.593734+00:00', true, false, false, '019c82b8-5d9f-71af-a2ac-3bfc3d189410', 'Reports', 'Analytical insights agent for detailed training outcome reports', '{}', NULL, NULL, '{8abd2bea-d252-4a7c-857c-475147ff6877,019522a0-0020-7000-8000-000000000007}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '019c82b8-5d9f-708d-8b0e-d00022ff16c0', '{019c82b8-5d9f-70f2-875e-b435dcc24083}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5d9f-72f2-9205-d1b904c0b54b', 'Analytical insights agent for detailed training outcome reports', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c82b8-5d9f-70f2-875e-b435dcc24083', '## Previous Insights

{% if artifacts.reports.get.entries.insights is defined and artifacts.reports.get.entries.insights and artifacts.reports.get.entries.insights|length > 0 %}
The following insights were previously generated:
{% for insight in artifacts.reports.get.entries.insights %}
- {{ insight.content }}
{% endfor %}
{% else %}
No previous insights have been generated yet.
{% endif %}

## Domain Data

{% if artifacts.reports.get.entries.runs is defined and artifacts.reports.get.entries.runs %}
### Runs
{{ artifacts.reports.get.entries.runs | tojson }}
{% endif %}

## Task

Analyze the reports data above and generate focused insights about training effectiveness, completion analytics, score distributions, and longitudinal trends. Call **create_reports_insights** once per discrete finding.', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5d9f-7291-b2f2-8f25be112477', 'Reports', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-22T00:20:46.593734+00:00', '2026-02-22T00:20:46.593734+00:00', 'ab000008-0000-0000-0000-000000000008', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('ab000008-0000-0000-0000-000000000008', '019c82b8-5d9f-71af-a2ac-3bfc3d189410', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('ab000008-0000-0000-0000-000000000008', '019c82b8-5d9f-72f2-9205-d1b904c0b54b', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('ab000008-0000-0000-0000-000000000008', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('ab000008-0000-0000-0000-000000000008', '019c82b8-5d9f-70f2-875e-b435dcc24083', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('ab000008-0000-0000-0000-000000000008', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('ab000008-0000-0000-0000-000000000008', '019c82b8-5d9f-7291-b2f2-8f25be112477', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2026-02-22T00:20:46.593734+00:00', 'ab000008-0000-0000-0000-000000000008', '019c82b8-5d9f-708d-8b0e-d00022ff16c0', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab000008-0000-0000-0000-000000000008', '019522a0-0020-7000-8000-000000000007', true, '2026-02-24T11:27:01.778199+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
