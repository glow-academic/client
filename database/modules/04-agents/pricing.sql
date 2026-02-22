-- Module: Pricing
-- Category: agent
-- Description: Pricing system agent
-- ============================================================


-- Resource rows
INSERT INTO public.prompts_resource (created_at, system_prompt, name, description, active, id, generated, mcp) VALUES ('2026-02-22T00:20:46.593734+00:00', 'You are an analytical insights agent for the pricing view, providing intelligent analysis of cost analytics for AI model usage, token consumption, and billing breakdowns.

## Your Role

You analyze data and produce structured, actionable insights. You receive contextual data about cost per session, model cost comparisons, department spend, and budget projections and must synthesize it into clear analysis.

## Tool

You have one primary tool:
- **create_insights**: Create an insight entry with your analysis. Call this tool once per discrete insight. Each insight should be a focused, self-contained observation.

## Analysis Framework

### 1. Pattern Recognition
- Identify trends (improving, declining, stable)
- Spot anomalies and outliers
- Detect seasonal or cyclical patterns

### 2. Comparative Analysis
- Compare across departments, time periods, or cohorts
- Benchmark against historical averages
- Highlight significant deviations

### 3. Actionable Recommendations
- Provide specific, implementable suggestions
- Prioritize by impact and feasibility
- Connect insights to operational decisions

## Output Guidelines

- Call **create_insights** for each discrete finding — do not combine multiple insights into one
- Lead with the most important finding
- Use specific numbers and percentages, not vague qualifiers
- Keep each insight concise — one clear observation per tool call
- Include context (e.g., "up 15% vs last month" not just "15%")
- Flag items that need immediate attention separately from trends

## Tone

- Professional and data-driven
- Confident when data supports the claim, hedged when uncertain
- Focus on "so what?" — why does this data point matter?
', 'Pricing Prompt', 'Analytical insights agent for cost analytics and billing breakdowns', true, '019c82b8-5da1-798a-b599-250d4a27343c', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.agents_resource (created_at, active, generated, mcp, id, name, description, department_ids, temperature, reasoning, tool_ids, quality, voice, model_id, prompt_id, instruction_ids) VALUES ('2026-02-22T00:20:46.593734+00:00', true, false, false, '019c82b8-5da1-7a99-9f13-ab3e41542df1', 'Pricing', 'Analytical insights agent for cost analytics and billing breakdowns', '{}', NULL, NULL, '{8abd2bea-d252-4a7c-857c-475147ff6877}', NULL, NULL, '019bb25e-e5ff-76f6-90d4-830670bb5d82', '019c82b8-5da1-798a-b599-250d4a27343c', '{019c82b8-5da1-79eb-83e0-106b51271885}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.descriptions_resource (id, description, created_at, active, generated, mcp) VALUES ('019c82b8-5da1-7bcc-973e-99c531dc1a2a', 'Analytical insights agent for cost analytics and billing breakdowns', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.instructions_resource (id, template, active, created_at, generated, mcp) VALUES ('019c82b8-5da1-79eb-83e0-106b51271885', '## Data Context

You are analyzing the **pricing** view which provides cost analytics for AI model usage, token consumption, and billing breakdowns.

{% set draft = views.draft_pricing if views and views.draft_pricing else None %}

{% if draft %}
### Current View State

{% if draft.filters is defined and draft.filters %}
**Active Filters:** {{ draft.filters | tojson }}
{% endif %}

{% if draft.date_range is defined and draft.date_range %}
**Date Range:** {{ draft.date_range.start }} to {{ draft.date_range.end }}
{% endif %}

{% if draft.department_ids is defined and draft.department_ids and draft.department_ids|length > 0 %}
**Selected Departments:** {% for id in draft.department_ids %}{{ id }}{% if not loop.last %}, {% endif %}{% endfor %}
{% endif %}
{% endif %}

### Available Data

{% if departments and departments|length > 0 %}
#### Departments in Scope
{% for dept in departments %}
- id: {{ dept.id }} | name: {{ dept.name }}{% if dept.description is defined and dept.description %} | {{ dept.description[:50] }}{% endif %}
{% endfor %}
{% endif %}

{% if names and names|length > 0 %}
#### Named Entities
{% for name in names %}
- id: {{ name.id }} | name: {{ name.name }}
{% endfor %}
{% endif %}

{% if descriptions and descriptions|length > 0 %}
#### Descriptions
{% for desc in descriptions %}
- id: {{ desc.id }} | {{ desc.description[:80] }}
{% endfor %}
{% endif %}

{% if flags and flags|length > 0 %}
#### Active Flags
{% for flag in flags %}
- id: {{ flag.id }} | {{ flag.key if flag.key is defined else flag.id }}{% if flag.label is defined and flag.label %} | {{ flag.label }}{% endif %}
{% endfor %}
{% endif %}

## Analysis Focus

Produce insights focused on: cost per session, model cost comparisons, department spend, and budget projections.

For each insight, call **create_insights** with a clear, structured observation:
1. **What** — the data point or pattern
2. **Why it matters** — business impact or significance
3. **Recommendation** — what action to take (if applicable)
', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.names_resource (id, name, created_at, active, generated, mcp) VALUES ('019c82b8-5da1-7b75-a0b2-8c4697ac76d1', 'Pricing', '2026-02-22T00:20:46.593734+00:00', true, false, false) ON CONFLICT (id) DO NOTHING;

-- Artifact
-- agent_artifact
INSERT INTO public.agent_artifact (created_at, updated_at, id, generated, mcp) VALUES ('2026-02-22T00:20:46.593734+00:00', '2026-02-22T00:20:46.593734+00:00', 'ab00000c-0000-0000-0000-00000000000c', false, false) ON CONFLICT (id) DO NOTHING;

-- Junctions
-- agent_agents_junction
INSERT INTO public.agent_agents_junction (agent_id, agents_id, active, created_at, generated, mcp) VALUES ('ab00000c-0000-0000-0000-00000000000c', '019c82b8-5da1-7a99-9f13-ab3e41542df1', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, agents_id) DO NOTHING;
-- agent_descriptions_junction
INSERT INTO public.agent_descriptions_junction (agent_id, description_id, created_at, generated, mcp, active) VALUES ('ab00000c-0000-0000-0000-00000000000c', '019c82b8-5da1-7bcc-973e-99c531dc1a2a', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, description_id) DO NOTHING;
-- agent_flags_junction
INSERT INTO public.agent_flags_junction (agent_id, flag_id, value, created_at, generated, mcp, active) VALUES ('ab00000c-0000-0000-0000-00000000000c', '019be334-bfc4-76ac-80d3-c8ba7618bc7a', true, '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, flag_id) DO NOTHING;
-- agent_instructions_junction
INSERT INTO public.agent_instructions_junction (agent_id, instruction_id, created_at, generated, mcp, active) VALUES ('ab00000c-0000-0000-0000-00000000000c', '019c82b8-5da1-79eb-83e0-106b51271885', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, instruction_id) DO NOTHING;
-- agent_models_junction
INSERT INTO public.agent_models_junction (agent_id, model_id, created_at, generated, mcp, active) VALUES ('ab00000c-0000-0000-0000-00000000000c', '019bb25e-e5ff-76f6-90d4-830670bb5d82', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, model_id) DO NOTHING;
-- agent_names_junction
INSERT INTO public.agent_names_junction (agent_id, name_id, created_at, generated, mcp, active) VALUES ('ab00000c-0000-0000-0000-00000000000c', '019c82b8-5da1-7b75-a0b2-8c4697ac76d1', '2026-02-22T00:20:46.593734+00:00', false, false, true) ON CONFLICT (agent_id, name_id) DO NOTHING;
-- agent_prompts_junction
INSERT INTO public.agent_prompts_junction (active, created_at, agent_id, prompt_id, generated, mcp) VALUES (true, '2026-02-22T00:20:46.593734+00:00', 'ab00000c-0000-0000-0000-00000000000c', '019c82b8-5da1-798a-b599-250d4a27343c', false, false) ON CONFLICT (agent_id, prompt_id) DO NOTHING;
-- agent_tools_junction
INSERT INTO public.agent_tools_junction (agent_id, tool_id, active, created_at, generated, mcp) VALUES ('ab00000c-0000-0000-0000-00000000000c', '8abd2bea-d252-4a7c-857c-475147ff6877', true, '2026-02-22T00:20:46.593734+00:00', false, false) ON CONFLICT (agent_id, tool_id) DO NOTHING;
