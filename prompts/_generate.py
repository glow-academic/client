"""Generate system prompt and instruction template files for all 34 artifacts."""

import os

PROMPTS_DIR = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------------------
# Artifact definitions: (name, category, resources, description)
# ---------------------------------------------------------------------------

CRUD_ARTIFACTS = {
    "agent": {
        "resources": [
            ("names", "name (name text)"),
            ("descriptions", "description (description text)"),
            ("models", "model reference (model_id)"),
            ("prompts", "system prompt (system_prompt text)"),
            ("instructions", "instruction template (template text)"),
            ("flags", "flag setting (flag value)"),
            ("departments", "department assignment (department_id)"),
            ("tools", "tool binding (tool_id)"),
            ("temperature_levels", "temperature level (level)"),
            ("reasoning_levels", "reasoning level (level)"),
            ("voices", "voice setting (voice)"),
        ],
        "desc": "AI agents with models, prompts, instructions, and tool bindings",
    },
    "auth": {
        "resources": [
            ("names", "name (name text)"),
            ("descriptions", "description (description text)"),
            ("flags", "flag setting (flag value)"),
            ("protocols", "auth protocol (protocol type)"),
            ("slugs", "URL slug (slug text)"),
            ("items", "auth item (item configuration)"),
        ],
        "desc": "authentication configurations with protocols and items",
    },
    "persona": {
        "resources": [
            ("names", "name (name text)"),
            ("descriptions", "description (description text)"),
            ("colors", "color (name, description, hex_code)"),
            ("icons", "icon (name, value)"),
            ("instructions", "behavioral instruction (template text)"),
            ("flags", "flag setting (flag value)"),
            ("examples", "example behavior (example text)"),
            ("parameter_fields", "parameter field link (field_id, parameter_id)"),
            ("departments", "department assignment (department_id)"),
            ("parameters", "parameter binding (parameter_id)"),
        ],
        "desc": "personas for AI-powered simulations and interactions",
    },
    "scenario": {
        "resources": [
            ("names", "name (name text)"),
            ("descriptions", "description (description text)"),
            ("problem_statements", "problem statement (statement text)"),
            ("objectives", "objective (objective text)"),
            ("scenario_flags", "scenario flag (flag value)"),
            ("images", "image (image reference)"),
            ("videos", "video (video reference)"),
            ("questions", "question (question text)"),
            ("departments", "department assignment (department_id)"),
            ("parameter_fields", "parameter field link (field_id, parameter_id)"),
            ("personas", "persona binding (persona_id)"),
            ("documents", "document reference (document_id)"),
            ("parameters", "parameter binding (parameter_id)"),
        ],
        "desc": "training scenarios with problem statements, objectives, and persona assignments",
    },
    "simulation": {
        "resources": [
            ("names", "name (name text)"),
            ("descriptions", "description (description text)"),
            ("departments", "department assignment (department_id)"),
            ("flags", "flag setting (flag value)"),
            ("scenarios", "scenario binding (scenario_id)"),
            ("scenario_flags", "scenario flag override (flag value)"),
            ("scenario_personas", "scenario persona override (persona_id)"),
            ("scenario_positions", "scenario ordering (position)"),
            ("scenario_rubrics", "scenario rubric binding (rubric_id)"),
            ("scenario_time_limits", "scenario time limit (minutes)"),
        ],
        "desc": "simulation configurations with scenario orderings, rubrics, and time limits",
    },
    "cohort": {
        "resources": [
            ("names", "name (name text)"),
            ("descriptions", "description (description text)"),
            ("flags", "flag setting (flag value)"),
            ("departments", "department assignment (department_id)"),
            ("simulations", "simulation binding (simulation_id)"),
            ("simulation_positions", "simulation ordering (position)"),
        ],
        "desc": "cohorts grouping simulations for training programs",
    },
    "document": {
        "resources": [
            ("names", "name (name text)"),
            ("descriptions", "description (description text)"),
            ("flags", "flag setting (flag value)"),
            ("departments", "department assignment (department_id)"),
            ("fields", "field binding (field_id)"),
            ("uploads", "file upload (upload reference)"),
            ("images", "image (image reference)"),
            ("texts", "text content (text body)"),
        ],
        "desc": "documents with uploads, images, and structured text content",
    },
    "profile": {
        "resources": [
            ("names", "name (name text)"),
            ("flags", "flag setting (flag value)"),
            ("request_limits", "request limit (limit value)"),
            ("departments", "department assignment (department_id)"),
            ("emails", "email address (email text)"),
            ("cohorts", "cohort assignment (cohort_id)"),
        ],
        "desc": "user profiles with department assignments and cohort enrollments",
    },
    "parameter": {
        "resources": [
            ("names", "name (name text)"),
            ("descriptions", "description (description text)"),
            ("flags", "flag setting (flag value)"),
            ("departments", "department assignment (department_id)"),
            ("fields", "field binding (field_id)"),
        ],
        "desc": "parameters with associated fields for dynamic configuration",
    },
    "field": {
        "resources": [
            ("names", "name (name text)"),
            ("descriptions", "description (description text)"),
            ("flags", "flag setting (flag value)"),
            ("departments", "department assignment (department_id)"),
            ("conditional_parameters", "conditional parameter rule (parameter_id, condition)"),
        ],
        "desc": "fields with conditional parameter logic for dynamic forms",
    },
    "model": {
        "resources": [
            ("names", "name (name text)"),
            ("descriptions", "description (description text)"),
            ("values", "model value/identifier (value text)"),
            ("providers", "provider binding (provider_id)"),
            ("flags", "flag setting (flag value)"),
            ("departments", "department assignment (department_id)"),
            ("modalities", "modality (modality type)"),
            ("temperature_levels", "temperature level (level)"),
            ("pricing", "pricing tier (pricing configuration)"),
            ("reasoning_levels", "reasoning level (level)"),
            ("qualities", "quality tier (quality level)"),
            ("voices", "voice setting (voice)"),
        ],
        "desc": "AI model configurations with providers, modalities, and pricing",
    },
    "tool": {
        "resources": [
            ("names", "name (name text)"),
            ("descriptions", "description (description text)"),
            ("args", "argument definition (name, type, description)"),
            ("arg_positions", "argument ordering (position)"),
            ("args_outputs", "argument output mapping (output configuration)"),
            ("flags", "flag setting (flag value)"),
        ],
        "desc": "tool definitions with arguments, ordering, and output mappings",
    },
    "department": {
        "resources": [
            ("names", "name (name text)"),
            ("descriptions", "description (description text)"),
            ("flags", "flag setting (flag value)"),
            ("settings", "department setting (setting configuration)"),
        ],
        "desc": "organizational departments with settings",
    },
    "provider": {
        "resources": [
            ("names", "name (name text)"),
            ("descriptions", "description (description text)"),
            ("flags", "flag setting (flag value)"),
            ("departments", "department assignment (department_id)"),
            ("values", "provider value/identifier (value text)"),
            ("endpoints", "API endpoint (endpoint URL)"),
        ],
        "desc": "AI provider configurations with endpoints and credentials",
    },
    "rubric": {
        "resources": [
            ("names", "name (name text)"),
            ("descriptions", "description (description text)"),
            ("departments", "department assignment (department_id)"),
            ("flags", "flag setting (flag value)"),
            ("points", "point value (points number)"),
            ("pass_points", "passing threshold (pass_points number)"),
            ("standard_groups", "standard group (group configuration)"),
            ("standards", "standard (standard definition)"),
        ],
        "desc": "grading rubrics with standards, point values, and passing thresholds",
    },
    "eval": {
        "resources": [
            ("names", "name (name text)"),
            ("descriptions", "description (description text)"),
            ("flags", "flag setting (flag value)"),
            ("departments", "department assignment (department_id)"),
            ("agents", "agent binding (agent_id)"),
            ("run_positions", "run ordering (position)"),
            ("group_positions", "group ordering (position)"),
            ("run_rubrics", "run rubric binding (rubric_id)"),
            ("group_rubrics", "group rubric binding (rubric_id)"),
            ("rubrics", "rubric binding (rubric_id)"),
        ],
        "desc": "evaluation configurations with agent assignments, runs, groups, and rubric bindings",
    },
    "setting": {
        "resources": [
            ("names", "name (name text)"),
            ("descriptions", "description (description text)"),
            ("colors", "color (name, hex_code)"),
            ("flags", "flag setting (flag value)"),
            ("departments", "department assignment (department_id)"),
            ("profiles", "profile binding (profile_id)"),
            ("auths", "auth binding (auth_id)"),
            ("provider_keys", "provider API key (key configuration)"),
            ("auth_item_keys", "auth item key (key configuration)"),
            ("roles", "role assignment (role type)"),
        ],
        "desc": "system settings with auth, provider keys, roles, and department assignments",
    },
}

ANALYTICAL_ARTIFACTS = {
    "dashboard": {
        "desc": "high-level organizational dashboard with KPIs, trends, and departmental breakdowns",
        "focus": "key performance indicators, usage trends, department comparisons, and executive summaries",
    },
    "reports": {
        "desc": "detailed analytical reports on training outcomes, completion rates, and performance metrics",
        "focus": "training effectiveness, completion analytics, score distributions, and longitudinal trends",
    },
    "activity": {
        "desc": "real-time and recent activity monitoring across the platform",
        "focus": "recent actions, active sessions, error patterns, and usage spikes",
    },
    "pricing": {
        "desc": "cost analytics for AI model usage, token consumption, and billing breakdowns",
        "focus": "cost per session, model cost comparisons, department spend, and budget projections",
    },
    "health": {
        "desc": "system health monitoring including API latency, error rates, and infrastructure status",
        "focus": "uptime metrics, error rates, latency percentiles, and degradation alerts",
    },
    "leaderboard": {
        "desc": "performance rankings across profiles, departments, and training programs",
        "focus": "score rankings, improvement trajectories, top performers, and competitive analysis",
    },
    "record": {
        "desc": "individual training record detail with session history and performance progression",
        "focus": "session timeline, score trends, rubric breakdowns, and improvement areas per individual",
    },
    "session": {
        "desc": "individual training session analytics with chat-level and attempt-level detail",
        "focus": "conversation quality, rubric adherence, time-on-task, and per-attempt scoring",
    },
    "group": {
        "desc": "group-level analytics aggregating sessions within a training run or cohort group",
        "focus": "group averages, outlier detection, cohort comparisons, and group-level trends",
    },
}

TRAINING_ARTIFACTS = {
    "chat": {
        "resources": [
            ("departments", "department context"),
            ("personas", "persona in conversation"),
            ("documents", "reference document"),
            ("parameter_fields", "parameter field value"),
            ("scenarios", "active scenario"),
            ("parameters", "parameter binding"),
            ("fields", "field value"),
            ("questions", "scenario question"),
            ("options", "response option"),
            ("videos", "video reference"),
            ("images", "image reference"),
            ("templates", "response template"),
            ("problem_statements", "problem statement"),
            ("objectives", "learning objective"),
        ],
        "desc": "live training chat sessions where the AI acts as a persona in a scenario-driven conversation",
    },
    "benchmark": {
        "resources": [
            ("departments", "department context"),
            ("models", "model under test"),
            ("prompts", "system prompt"),
            ("instructions", "instruction template"),
            ("voices", "voice setting"),
            ("temperature_levels", "temperature level"),
            ("reasoning_levels", "reasoning level"),
            ("tools", "tool binding"),
            ("keys", "API key"),
        ],
        "desc": "benchmark execution running evaluations across model configurations",
    },
    "invocation": {
        "resources": [
            ("departments", "department context"),
            ("models", "model under test"),
            ("prompts", "system prompt"),
            ("instructions", "instruction template"),
            ("voices", "voice setting"),
            ("temperature_levels", "temperature level"),
            ("reasoning_levels", "reasoning level"),
            ("tools", "tool binding"),
            ("keys", "API key"),
        ],
        "desc": "individual benchmark invocation within a test suite",
    },
    "home": {
        "resources": [],
        "desc": "home page overview for the current user showing available training and recent activity",
    },
    "practice": {
        "resources": [],
        "desc": "practice mode entry point showing available simulations and training options",
    },
    "attempt-chat": {
        "resources": [
            ("user_messages", "user message in conversation"),
            ("assistant_messages", "assistant response"),
            ("contents", "content block"),
            ("hints", "hint for the user"),
        ],
        "desc": "the conversational portion of a training attempt — the AI acts as the persona conducting the training dialogue",
    },
    "attempt-grade": {
        "resources": [
            ("feedbacks", "feedback comment"),
            ("strengths", "identified strength"),
            ("improvements", "improvement suggestion"),
            ("analyses", "analytical observation"),
            ("highlights", "notable moment highlight"),
            ("replacements", "suggested replacement phrase"),
        ],
        "desc": "the grading/evaluation portion of a training attempt — analyzing performance and providing structured feedback",
    },
    "test": {
        "resources": [
            ("grades", "grade assignment"),
            ("feedbacks", "feedback comment"),
        ],
        "desc": "benchmark test grading — evaluating model outputs against rubric standards",
    },
}


def write_crud_system(name: str, info: dict) -> str:
    resources = info["resources"]
    desc = info["desc"]

    create_tools = "\n".join(
        f"- **create_{r[0]}**: Create a new {r[1]}" for r in resources
    )
    use_tools = "\n".join(
        f"- **use_{r[0]}**: Use an existing {r[0]} by its ID" for r in resources
    )

    resource_names = ", ".join(r[0] for r in resources)

    return f"""You are a {name} generation agent responsible for creating and managing {desc}.

## Your Role

Generate or update only the requested resource_types for a {name} artifact:
{resource_names}.

You have access to two types of tools that achieve the same result — choose ONE based on whether the resource exists:

### Create Tools (for NEW resources)
Use these when you need to create NEW resource data that does not exist yet:
{create_tools}

### Use Tools (for EXISTING resources)
Use these when you want to use resources that ALREADY EXIST in the available context:
{use_tools}

## Important: Either Create OR Use

For each resource type, you have two options that achieve the same outcome:
1. **Create** a new resource if one does not exist
2. **Use** an existing resource if a suitable one is already available

You only need to do ONE of these operations per resource — not both. Check the available resources first, then decide whether to create new or use existing.

## Guidelines

### Resource Quality
- Create clear, descriptive names that identify the {name}
- Provide detailed descriptions explaining the {name}'s role and characteristics
- Ensure consistency across all {name} elements
- Review available resources in the context FIRST before creating new ones
- Use existing resources when suitable ones are already available (avoids duplicates)
- Create new resources only when nothing suitable exists

### Best Practices
- Operate only on requested resource_types
- Prefer using existing suitable resources before creating new ones
- Do not invent IDs — use IDs provided in context
- Keep outputs deterministic, concise, and production-safe
- Return only valid tool calls and arguments
- Do not output narrative text
"""


def write_crud_instructions(name: str, info: dict) -> str:
    resources = info["resources"]
    draft_key = f"draft_{name}"

    # Build current form state section
    form_blocks = []
    for r_name, _ in resources:
        display = r_name.replace("_", " ").title()
        # Different display logic per resource type
        if r_name == "names":
            value_expr = "name.name"
        elif r_name == "descriptions":
            value_expr = "desc.description[:100]"
            iter_var = "desc"
        elif r_name == "colors":
            value_expr = "color.name ~ ' (' ~ color.hex_code ~ ')'"
            iter_var = "color"
        elif r_name == "icons":
            value_expr = "icon.name ~ ' (' ~ icon.value ~ ')'"
            iter_var = "icon"
        elif r_name == "instructions":
            value_expr = "inst.template[:80]"
            iter_var = "inst"
        elif r_name == "examples":
            value_expr = "ex.example[:50]"
            iter_var = "ex"
        else:
            value_expr = f"item.name"
            iter_var = "item"

        if r_name == "names":
            iter_var = "name"
        elif r_name == "descriptions":
            iter_var = "desc"
        elif r_name not in ("colors", "icons", "instructions", "examples"):
            iter_var = "item"

        form_blocks.append(
            f"""{{% if {r_name} and {r_name}|length > 0 %}}
**Current {display}:** {{% for {iter_var} in {r_name} %}}{{{{ {value_expr} }}}}{{% if not loop.last %}}, {{% endif %}}{{% endfor %}}
{{% elif draft and draft.{r_name.rstrip('s') if not r_name.endswith('ss') else r_name}_ids and draft.{r_name.rstrip('s') if not r_name.endswith('ss') else r_name}_ids|length > 0 %}}
**Current {display} IDs:** {{% for id in draft.{r_name.rstrip('s') if not r_name.endswith('ss') else r_name}_ids %}}{{{{ id }}}}{{% if not loop.last %}}, {{% endif %}}{{% endfor %}}
{{% else %}}
**Current {display}:** (not selected)
{{% endif %}}"""
        )

    # Build available resources section
    available_blocks = []
    for r_name, _ in resources:
        display = r_name.replace("_", " ").title()
        if r_name == "names":
            line = f"- id: {{{{ item.id }}}} | name: {{{{ item.name }}}}"
        elif r_name == "descriptions":
            line = f"- id: {{{{ item.id }}}} | description: {{{{ item.description[:100] }}}}{{% if item.description|length > 100 %}}...{{% endif %}}"
        elif r_name == "colors":
            line = f"- id: {{{{ item.id }}}} | name: {{{{ item.name }}}} | hex_code: {{{{ item.hex_code }}}}"
        elif r_name == "icons":
            line = f"- id: {{{{ item.id }}}} | name: {{{{ item.name }}}} | value: {{{{ item.value }}}}"
        elif r_name == "instructions":
            line = f"- id: {{{{ item.id }}}} | template: {{{{ item.template[:80] }}}}{{% if item.template|length > 80 %}}...{{% endif %}}"
        elif r_name == "examples":
            line = f"- id: {{{{ item.id }}}} | example: {{{{ item.example[:80] }}}}{{% if item.example|length > 80 %}}...{{% endif %}}"
        else:
            line = f"- id: {{{{ item.id }}}} | name: {{{{ item.name }}}}{{% if item.description %}} | {{{{ item.description[:50] }}}}{{% endif %}}"

        available_blocks.append(
            f"""{{% if {r_name} and {r_name}|length > 0 %}}
### Available {display}
{{% for item in {r_name} %}}
{line}
{{% endfor %}}
{{% endif %}}"""
        )

    form_state = "\n\n".join(form_blocks)
    available_resources = "\n\n".join(available_blocks)

    return f"""## Current Form State

The user is currently editing a {name} with the following selections:

{{% set draft = views.{draft_key} if views and views.{draft_key} else None %}}

{form_state}

---

## Available Context Resources

You have access to the following existing resources. Either **use_*** an existing resource OR **create_*** a new one — you only need to do ONE.

{available_resources}

## Tool Usage (Either/Or)

For each resource, choose ONE approach:
- **use_*** tools: When a suitable resource ALREADY EXISTS above (pass the existing id)
- **create_*** tools: When you need to generate NEW content (nothing suitable exists)

You do NOT need to both create and use — pick one based on whether a suitable resource exists.
"""


def write_analytical_system(name: str, info: dict) -> str:
    desc = info["desc"]
    focus = info["focus"]

    return f"""You are an analytical insights agent for the {name} view, providing intelligent analysis of {desc}.

## Your Role

You analyze data and produce structured, actionable insights. You receive contextual data about {focus} and must synthesize it into clear analysis.

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

- Lead with the most important finding
- Use specific numbers and percentages, not vague qualifiers
- Keep insights concise — one clear observation per insight
- Include context (e.g., "up 15% vs last month" not just "15%")
- Flag items that need immediate attention separately from trends
- Do not output narrative prose — produce structured insight entries

## Tone

- Professional and data-driven
- Confident when data supports the claim, hedged when uncertain
- Focus on "so what?" — why does this data point matter?
"""


def write_analytical_instructions(name: str, info: dict) -> str:
    desc = info["desc"]
    focus = info["focus"]

    return f"""## Data Context

You are analyzing the **{name}** view which provides {desc}.

{{% set draft = views.draft_{name} if views and views.draft_{name} else None %}}

{{% if draft %}}
### Current View State

{{% if draft.filters %}}
**Active Filters:** {{{{ draft.filters | tojson }}}}
{{% endif %}}

{{% if draft.date_range %}}
**Date Range:** {{{{ draft.date_range.start }}}} to {{{{ draft.date_range.end }}}}
{{% endif %}}

{{% if draft.department_ids and draft.department_ids|length > 0 %}}
**Selected Departments:** {{% for id in draft.department_ids %}}{{{{ id }}}}{{% if not loop.last %}}, {{% endif %}}{{% endfor %}}
{{% endif %}}
{{% endif %}}

### Available Data

{{% if departments and departments|length > 0 %}}
#### Departments in Scope
{{% for dept in departments %}}
- id: {{{{ dept.id }}}} | name: {{{{ dept.name }}}}{{% if dept.description %}} | {{{{ dept.description[:50] }}}}{{% endif %}}
{{% endfor %}}
{{% endif %}}

{{% if names and names|length > 0 %}}
#### Named Entities
{{% for name in names %}}
- id: {{{{ name.id }}}} | name: {{{{ name.name }}}}
{{% endfor %}}
{{% endif %}}

{{% if flags and flags|length > 0 %}}
#### Active Flags
{{% for flag in flags %}}
- id: {{{{ flag.id }}}} | key: {{{{ flag.key }}}}{{% if flag.label %}} | {{{{ flag.label }}}}{{% endif %}}
{{% endfor %}}
{{% endif %}}

## Analysis Focus

Produce insights focused on: {focus}.

Structure each insight as a discrete observation with:
1. **What** — the data point or pattern
2. **Why it matters** — business impact or significance
3. **Recommendation** — what action to take (if applicable)
"""


def write_training_system(name: str, info: dict) -> str:
    desc = info["desc"]
    resources = info.get("resources", [])

    if name == "chat":
        return f"""You are a training conversation agent facilitating {desc}.

## Your Role

You are conducting a live training session. You embody the persona assigned to this scenario and engage the user in realistic, scenario-driven dialogue. Your goal is to create an authentic training experience that tests and develops the user's skills.

## Conversation Guidelines

- Stay in character as the assigned persona throughout the conversation
- Follow the scenario's problem statement and objectives
- Respond naturally while steering toward learning objectives
- Adjust difficulty based on user performance
- Use the scenario's questions and options to guide the conversation when appropriate
- Reference documents and materials when relevant to the scenario

## Context Resources

You have access to the following context that shapes your behavior:
- **Persona**: Your character, personality, and behavioral instructions
- **Scenario**: The situation, problem statement, and learning objectives
- **Documents**: Reference materials relevant to the scenario
- **Parameters/Fields**: Dynamic configuration values for this session
- **Questions/Options**: Structured prompts and response options

## Output

- Respond conversationally as the persona
- Do not break character or reference the system
- Do not reveal scenario objectives to the user
"""

    if name == "attempt-chat":
        return f"""You are the conversational AI for {desc}.

## Your Role

You are conducting the training dialogue as the assigned persona. You must:
- Embody the persona's character, tone, and behavioral patterns
- Follow the scenario context and objectives
- Engage naturally in conversation
- Create a realistic training experience

## Conversation Behavior

- Stay in character at all times
- Respond to user messages naturally and contextually
- Guide the conversation toward learning objectives without being obvious
- Provide hints when the user is struggling (if configured)
- Generate content blocks that enrich the conversation when appropriate

## Output

Generate responses as the persona. Use the available tools:
- **create_assistant_messages**: Generate your in-character response
- **create_contents**: Generate supplementary content blocks
- **create_hints**: Provide guidance when the user needs help
"""

    if name == "attempt-grade":
        return f"""You are a grading and evaluation agent for {desc}.

## Your Role

You analyze a completed training conversation and produce structured evaluation feedback. You assess the user's performance against the rubric standards and provide actionable feedback.

## Evaluation Framework

### Assessment Areas
- **Strengths**: What the user did well — specific, evidence-based observations
- **Improvements**: Where the user can improve — constructive, actionable suggestions
- **Analysis**: Deeper analytical observations about patterns in the conversation
- **Highlights**: Notable moments (positive or negative) worth calling out
- **Replacements**: Specific phrases the user said that could be improved, with suggested alternatives

## Grading Guidelines

- Base all feedback on observable evidence from the conversation
- Reference specific moments or quotes when possible
- Be constructive — frame improvements as opportunities, not failures
- Provide specific, actionable replacement suggestions
- Consider the scenario context and difficulty level

## Output

Generate structured feedback using the available tools:
- **create_feedbacks**: Overall feedback comments
- **create_strengths**: Identified strengths with evidence
- **create_improvements**: Specific improvement suggestions
- **create_analyses**: Analytical observations
- **create_highlights**: Notable conversation moments
- **create_replacements**: Suggested phrase improvements
"""

    if name == "test":
        return f"""You are a benchmark test grading agent for {desc}.

## Your Role

You evaluate model outputs against rubric standards and assign grades. You provide objective, criteria-based feedback on model performance.

## Grading Guidelines

- Evaluate strictly against the rubric criteria
- Assign grades based on evidence in the model output
- Provide specific feedback referencing rubric standards
- Be consistent and objective across evaluations
- Note edge cases or ambiguous assessments

## Output

Generate evaluations using the available tools:
- **create_grades**: Assign grade values based on rubric criteria
- **create_feedbacks**: Provide specific feedback referencing standards
"""

    if name in ("benchmark", "invocation"):
        return f"""You are a benchmark execution agent for {desc}.

## Your Role

You execute benchmark evaluations using the configured model, prompt, and tool settings. You run the evaluation scenario and produce structured results.

## Execution Guidelines

- Use the configured model and prompt settings exactly as specified
- Apply instruction templates as developer messages
- Respect temperature and reasoning level settings
- Execute with the provided tool bindings
- Record all outputs for grading

## Context

You operate within the benchmark framework, executing evaluations that will later be graded against rubric standards. Focus on faithful execution of the configured scenario.
"""

    if name in ("home", "practice"):
        return f"""You are a navigation and recommendation agent for {desc}.

## Your Role

You help users discover and navigate available training content. You provide personalized recommendations based on the user's history, department, and current progress.

## Guidelines

- Suggest relevant training based on user context
- Highlight new or updated content
- Surface incomplete or in-progress sessions
- Provide brief, actionable summaries
"""

    # Fallback
    return f"""You are a generation agent for {desc}.

## Your Role

Generate or update the requested resources. Follow the standard create/use pattern for available resource types.
"""


def write_training_instructions(name: str, info: dict) -> str:
    resources = info.get("resources", [])

    if not resources:
        return f"""## Context

{{% set draft = views.draft_{name.replace('-', '_')} if views and views.draft_{name.replace('-', '_')} else None %}}

{{% if draft %}}
### Current State
{{{{ draft | tojson }}}}
{{% endif %}}

No additional resource context is available for this artifact type.
"""

    # Build available resources section
    available_blocks = []
    for r_name, r_desc in resources:
        display = r_name.replace("_", " ").title()
        available_blocks.append(
            f"""{{% if {r_name} and {r_name}|length > 0 %}}
### Available {display}
{{% for item in {r_name} %}}
- id: {{{{ item.id }}}} | {{{{ item.name if item.name is defined else item.id }}}}
{{% endfor %}}
{{% endif %}}"""
        )

    available_resources = "\n\n".join(available_blocks)
    draft_key = f"draft_{name.replace('-', '_')}"

    return f"""## Context

{{% set draft = views.{draft_key} if views and views.{draft_key} else None %}}

{{% if draft %}}
### Current State
{{% if draft.scenario_name is defined %}}
**Scenario:** {{{{ draft.scenario_name }}}}
{{% endif %}}
{{% if draft.persona_name is defined %}}
**Persona:** {{{{ draft.persona_name }}}}
{{% endif %}}
{{% if draft.department_ids and draft.department_ids|length > 0 %}}
**Departments:** {{% for id in draft.department_ids %}}{{{{ id }}}}{{% if not loop.last %}}, {{% endif %}}{{% endfor %}}
{{% endif %}}
{{% endif %}}

### Available Resources

{available_resources}

## Tool Usage

For each resource type, use the appropriate **create_*** tool to generate new content based on the context above.
"""


def main():
    os.makedirs(PROMPTS_DIR, exist_ok=True)

    count = 0

    # CRUD artifacts
    for name, info in CRUD_ARTIFACTS.items():
        with open(os.path.join(PROMPTS_DIR, f"{name}.system.jinja"), "w") as f:
            f.write(write_crud_system(name, info))
        with open(os.path.join(PROMPTS_DIR, f"{name}.instructions.jinja"), "w") as f:
            f.write(write_crud_instructions(name, info))
        count += 1

    # Analytical artifacts
    for name, info in ANALYTICAL_ARTIFACTS.items():
        with open(os.path.join(PROMPTS_DIR, f"{name}.system.jinja"), "w") as f:
            f.write(write_analytical_system(name, info))
        with open(os.path.join(PROMPTS_DIR, f"{name}.instructions.jinja"), "w") as f:
            f.write(write_analytical_instructions(name, info))
        count += 1

    # Training/execution artifacts
    for name, info in TRAINING_ARTIFACTS.items():
        with open(os.path.join(PROMPTS_DIR, f"{name}.system.jinja"), "w") as f:
            f.write(write_training_system(name, info))
        with open(os.path.join(PROMPTS_DIR, f"{name}.instructions.jinja"), "w") as f:
            f.write(write_training_instructions(name, info))
        count += 1

    print(f"Generated {count} artifacts ({count * 2} files)")


if __name__ == "__main__":
    main()
