"""Unified endpoints for artifacts and resources."""

import inspect
from typing import Any, cast

from fastapi import Request, Response
from mcp.server.fastmcp import FastMCP

# Static enumeration of artifacts and resources with descriptions
# Artifacts use singular names (matching database table names: persona_artifact, scenario_artifact, etc.)
ARTIFACTS = [
    "persona",
    "scenario",
    "simulation",
    "document",
    "department",
    "cohort",
    "eval",
    "rubric",
    "setting",
    "agent",
    "model",
    "provider",
    "parameter",
    "field",
    "profile",
    "auth",
    "tool",
]

RESOURCES = [
    "agents",
    "analyses",
    "audios",
    "auths",
    "cohorts",
    "colors",
    "conditional_parameters",
    "contents",
    "conversations",
    "debug_info",
    "departments",
    "descriptions",
    "documents",
    "emails",
    "endpoints",
    "evals",
    "examples",
    "feedbacks",
    "fields",
    "flags",
    "group_positions",
    "groups",
    "groups_rubric_grade_agents",
    "hints",
    "html",
    "icons",
    "images",
    "improvements",
    "instructions",
    "items",
    "keys",
    "modalities",
    "models",
    "names",
    "objectives",
    "options",
    "parameters",
    "personas",
    "points",
    "pricing",
    "problem_statements",
    "profiles",
    "prompts",
    "protocols",
    "providers",
    "qualities",
    "questions",
    "reasoning_levels",
    "request_limits",
    "responses",
    "rubrics",
    "run_positions",
    "runs",
    "runs_rubric_grade_agents",
    "scenario_flags",
    "scenario_positions",
    "scenario_rubric_grade_agents",
    "scenarios",
    "schema_field_items",
    "schema_fields",
    "schemas",
    "settings",
    "simulation_scenario_flags",
    "simulations",
    "slugs",
    "standard_groups",
    "strengths",
    "temperature_levels",
    "template_array_items",
    "template_values",
    "templates",
    "texts",
    "thresholds",
    "times",
    "tools",
    "values",
    "videos",
    "voices",
]

# Artifact descriptions (one-sentence)
# Keys use singular names (matching database table names)
ARTIFACT_DESCRIPTIONS: dict[str, str] = {
    "persona": "AI characters used in scenarios to represent different roles or perspectives",
    "scenario": "Practice scenarios that students interact with for learning",
    "simulation": "Interactive simulation sessions for practice and assessment",
    "document": "Document resources used in scenarios and learning materials",
    "department": "Organizational departments for grouping users and resources",
    "cohort": "Student cohorts for organizing groups of learners",
    "eval": "Evaluation configurations for assessing student performance",
    "rubric": "Grading rubrics for structured assessment criteria",
    "setting": "System settings for configuration and preferences",
    "agent": "AI agents that perform various tasks and operations",
    "model": "AI models used for generation and inference",
    "provider": "AI providers that supply models and services",
    "parameter": "Configuration parameters for customizing behavior",
    "field": "Custom fields for extending artifact schemas",
    "profile": "User profiles containing account and preference information",
    "auth": "Authentication configurations for user access control",
    "tool": "Tools for extending agent capabilities",
}

# Resource descriptions (one-sentence)
RESOURCE_DESCRIPTIONS: dict[str, str] = {
    "names": "Name resources for various artifacts",
    "colors": "Color resources for UI elements and visual representation",
    "flags": "Boolean flag resources for enabling/disabling features",
    "descriptions": "Description resources providing detailed information",
    "examples": "Example resources demonstrating usage patterns",
    "icons": "Icon resources for UI visual representation",
    "points": "Point resources for scoring and evaluation",
    "thresholds": "Threshold resources for defining limits and boundaries",
    "contents": "Content resources containing text or media",
    "html": "HTML content resources for rich text formatting",
    "hints": "Hint resources providing guidance and tips",
    "images": "Image resources for visual content",
    "videos": "Video resources for multimedia content",
    "objectives": "Objective resources defining learning goals",
    "options": "Option resources for choices and selections",
    "problem_statements": "Problem statement resources describing challenges",
    "prompts": "Prompt resources for AI generation inputs",
    "questions": "Question resources for assessments and quizzes",
    "responses": "Response resources for answers and feedback",
    "analyses": "Analysis resources containing evaluation results",
    "instructions": "Instruction resources providing guidance and directions",
    "improvements": "Improvement resources suggesting enhancements",
    "strengths": "Strength resources highlighting positive aspects",
    "feedbacks": "Feedback resources containing evaluation comments",
    "conversations": "Conversation resources for dialogue content",
    "debug_info": "Debug info resources containing diagnostic information",
    "schemas": "Schema resources defining data structures",
    "schema_fields": "Schema field resources for structured data",
    "schema_field_items": "Schema field item resources for nested structures",
    "templates": "Template resources for reusable content patterns",
    "template_array_items": "Template array item resources for list structures",
    "template_values": "Template value resources for variable substitution",
    "standard_groups": "Standard group resources for organizing criteria",
    "times": "Time resources for duration and scheduling",
    "agents": "Agent resources for AI agent configurations",
    "analyses": "Analysis resources containing evaluation results",
    "audios": "Audio resources for sound content",
    "auths": "Authentication resource configurations",
    "cohorts": "Cohort resources for student groups",
    "conditional_parameters": "Conditional parameter resources for dynamic configurations",
    "departments": "Department resources for organizational structure",
    "documents": "Document resources for file and content management",
    "emails": "Email resources for communication",
    "endpoints": "Endpoint resources for API configurations",
    "evals": "Evaluation resources for assessment configurations",
    "fields": "Field resources for custom data fields",
    "group_positions": "Group position resources for ordering",
    "groups": "Group resources for organizing runs and sessions",
    "groups_rubric_grade_agents": "Groups rubric grade agent resources for grading configurations",
    "items": "Item resources for list elements",
    "keys": "Key resources for API authentication",
    "modalities": "Modality resources for interaction types",
    "models": "Model resources for AI model configurations",
    "parameters": "Parameter resources for configuration settings",
    "personas": "Persona resources for AI character definitions",
    "pricing": "Pricing resources for cost configurations",
    "profiles": "Profile resources for user profiles",
    "protocols": "Protocol resources for communication standards",
    "providers": "Provider resources for AI service providers",
    "qualities": "Quality resources for content quality settings",
    "reasoning_levels": "Reasoning level resources for AI reasoning configurations",
    "request_limits": "Request limit resources for rate limiting",
    "rubrics": "Rubric resources for grading criteria",
    "run_positions": "Run position resources for ordering runs",
    "runs": "Run resources for execution tracking",
    "runs_rubric_grade_agents": "Runs rubric grade agent resources for run grading",
    "scenario_flags": "Scenario flag resources for scenario configurations",
    "scenario_positions": "Scenario position resources for ordering scenarios",
    "scenario_rubric_grade_agents": "Scenario rubric grade agent resources for scenario grading",
    "scenarios": "Scenario resources for practice scenarios",
    "settings": "Setting resources for system configuration",
    "simulation_scenario_flags": "Simulation scenario flag resources for simulation configurations",
    "simulations": "Simulation resources for interactive sessions",
    "slugs": "Slug resources for URL-friendly identifiers",
    "temperature_levels": "Temperature level resources for AI model temperature settings",
    "texts": "Text resources for text content",
    "tools": "Tool resources for tool configurations",
    "values": "Value resources for configuration values",
    "voices": "Voice resources for voice configurations",
}

# Combined list
ALL_ITEMS = ARTIFACTS + RESOURCES

# Helper function to route save operations to create or update based on ID presence
# Only used for scenarios and profile which don't have unified save.py yet
def create_save_handler(create_func: Any, update_func: Any, id_field_name: str) -> Any:
    """Create a unified save handler that routes to create or update based on ID.
    
    Args:
        create_func: Function to call for create operations
        update_func: Function to call for update operations
        id_field_name: Name of the ID field to check (e.g., "scenario_id", "profile_id")
    """
    async def save_handler(request: Any, http_request: Any, response: Any, conn: Any) -> Any:
        # Check if ID field exists and is not None
        request_dict = request.model_dump() if hasattr(request, "model_dump") else dict(request)
        has_id = request_dict.get(id_field_name) is not None
        
        if has_id:
            return await update_func(request, http_request, response, conn)
        else:
            return await create_func(request, http_request, response, conn)
    
    return save_handler


# Static imports for all artifact handlers
try:
    from app.api.v4.artifacts.persona.delete import delete_persona
    from app.api.v4.artifacts.persona.duplicate import duplicate_persona
    from app.api.v4.artifacts.persona.get import get_persona
    from app.api.v4.artifacts.persona.list import get_personas_list
    from app.api.v4.artifacts.persona.save import save_persona

    PERSONAS_HANDLERS = {
        "get": get_persona,
        "save": save_persona,
        "list": get_personas_list,
        "duplicate": duplicate_persona,
        "delete": delete_persona,
    }
except ImportError:
    PERSONAS_HANDLERS = {}

# Scenarios handlers (uses unified get.py and save.py)
try:
    from app.api.v4.artifacts.scenario.delete import delete_scenario
    from app.api.v4.artifacts.scenario.duplicate import duplicate_scenario
    from app.api.v4.artifacts.scenario.get import get_scenario
    from app.api.v4.artifacts.scenario.list import get_scenarios_list
    from app.api.v4.artifacts.scenario.save import save_scenario

    SCENARIOS_HANDLERS = {
        "get": get_scenario,
        "save": save_scenario,
        "list": get_scenarios_list,
        "duplicate": duplicate_scenario,
        "delete": delete_scenario,
    }
except ImportError:
    SCENARIOS_HANDLERS = {}

# Simulations handlers
try:
    from app.api.v4.artifacts.simulation.delete import delete_simulation
    from app.api.v4.artifacts.simulation.duplicate import duplicate_simulation
    from app.api.v4.artifacts.simulation.get import get_simulation
    from app.api.v4.artifacts.simulation.list import get_simulations_list
    from app.api.v4.artifacts.simulation.save import save_simulation

    SIMULATIONS_HANDLERS = {
        "get": get_simulation,
        "save": save_simulation,
        "list": get_simulations_list,
        "duplicate": duplicate_simulation,
        "delete": delete_simulation,
    }
except ImportError:
    SIMULATIONS_HANDLERS = {}

# Documents handlers (uses unified save.py)
try:
    from app.api.v4.artifacts.document.delete import delete_document
    from app.api.v4.artifacts.document.get import get_document
    from app.api.v4.artifacts.document.list import get_documents_list
    from app.api.v4.artifacts.document.save import save_document

    DOCUMENTS_HANDLERS = {
        "get": get_document,
        "save": save_document,
        "list": get_documents_list,
        "duplicate": None,  # Documents doesn't have duplicate
        "delete": delete_document,
    }
except ImportError:
    DOCUMENTS_HANDLERS = {}

# Departments handlers
try:
    from app.api.v4.artifacts.department.delete import delete_department
    from app.api.v4.artifacts.department.duplicate import duplicate_department
    from app.api.v4.artifacts.department.get import get_department
    from app.api.v4.artifacts.department.list import get_departments_list
    from app.api.v4.artifacts.department.save import save_department

    DEPARTMENTS_HANDLERS = {
        "get": get_department,
        "save": save_department,
        "list": get_departments_list,
        "duplicate": duplicate_department,
        "delete": delete_department,
    }
except ImportError:
    DEPARTMENTS_HANDLERS = {}

# Cohorts handlers
try:
    from app.api.v4.artifacts.cohort.delete import delete_cohort
    from app.api.v4.artifacts.cohort.duplicate import duplicate_cohort
    from app.api.v4.artifacts.cohort.get import get_cohort
    from app.api.v4.artifacts.cohort.list import get_cohorts_list
    from app.api.v4.artifacts.cohort.save import save_cohort

    COHORTS_HANDLERS = {
        "get": get_cohort,
        "save": save_cohort,
        "list": get_cohorts_list,
        "duplicate": duplicate_cohort,
        "delete": delete_cohort,
    }
except ImportError:
    COHORTS_HANDLERS = {}

# Evals handlers (uses unified save.py)
try:
    from app.api.v4.artifacts.eval.delete import delete_eval
    from app.api.v4.artifacts.eval.get import get_eval
    from app.api.v4.artifacts.eval.list import get_evals_list
    from app.api.v4.artifacts.eval.save import save_eval

    EVALS_HANDLERS = {
        "get": get_eval,
        "save": save_eval,
        "list": get_evals_list,
        "duplicate": None,  # Evals doesn't have duplicate
        "delete": delete_eval,
    }
except ImportError:
    EVALS_HANDLERS = {}

# Rubrics handlers (uses unified save.py)
try:
    from app.api.v4.artifacts.rubric.delete import delete_rubric
    from app.api.v4.artifacts.rubric.duplicate import duplicate_rubric
    from app.api.v4.artifacts.rubric.get import get_rubric
    from app.api.v4.artifacts.rubric.list import get_rubrics_list
    from app.api.v4.artifacts.rubric.save import save_rubric

    RUBRICS_HANDLERS = {
        "get": get_rubric,
        "save": save_rubric,
        "list": get_rubrics_list,
        "duplicate": duplicate_rubric,
        "delete": delete_rubric,
    }
except ImportError:
    RUBRICS_HANDLERS = {}

# Agents handlers (uses unified save.py)
try:
    from app.api.v4.artifacts.agent.delete import delete_agent
    from app.api.v4.artifacts.agent.duplicate import duplicate_agent
    from app.api.v4.artifacts.agent.get import get_agent
    from app.api.v4.artifacts.agent.list import list_agents
    from app.api.v4.artifacts.agent.save import save_agent

    AGENTS_HANDLERS = {
        "get": get_agent,
        "save": save_agent,
        "list": list_agents,
        "duplicate": duplicate_agent,
        "delete": delete_agent,
    }
except ImportError:
    AGENTS_HANDLERS = {}

# Models handlers (uses unified save.py)
try:
    from app.api.v4.artifacts.model.delete import delete_model
    from app.api.v4.artifacts.model.duplicate import duplicate_model
    from app.api.v4.artifacts.model.get import get_model
    from app.api.v4.artifacts.model.list import get_models_list
    from app.api.v4.artifacts.model.save import save_model

    MODELS_HANDLERS = {
        "get": get_model,
        "save": save_model,
        "list": get_models_list,
        "duplicate": duplicate_model,
        "delete": delete_model,
    }
except ImportError:
    MODELS_HANDLERS = {}

# Providers handlers
try:
    from app.api.v4.artifacts.provider.delete import delete_provider
    from app.api.v4.artifacts.provider.get import get_provider
    from app.api.v4.artifacts.provider.list import get_providers_list
    from app.api.v4.artifacts.provider.save import save_provider

    PROVIDERS_HANDLERS = {
        "get": get_provider,
        "save": save_provider,
        "list": get_providers_list,
        "duplicate": None,  # Providers doesn't have duplicate
        "delete": delete_provider,
    }
except ImportError:
    PROVIDERS_HANDLERS = {}

# Parameters handlers (uses unified save.py)
try:
    from app.api.v4.artifacts.parameter.delete import delete_parameter
    from app.api.v4.artifacts.parameter.duplicate import duplicate_parameter
    from app.api.v4.artifacts.parameter.get import get_parameter
    from app.api.v4.artifacts.parameter.list import get_parameters_list
    from app.api.v4.artifacts.parameter.save import save_parameter

    PARAMETERS_HANDLERS = {
        "get": get_parameter,
        "save": save_parameter,
        "list": get_parameters_list,
        "duplicate": duplicate_parameter,
        "delete": delete_parameter,
    }
except ImportError:
    PARAMETERS_HANDLERS = {}

# Fields handlers
try:
    from app.api.v4.artifacts.field.delete import delete_field
    from app.api.v4.artifacts.field.duplicate import duplicate_field
    from app.api.v4.artifacts.field.get import get_field
    from app.api.v4.artifacts.field.list import get_fields_list
    from app.api.v4.artifacts.field.save import save_field

    FIELDS_HANDLERS = {
        "get": get_field,
        "save": save_field,
        "list": get_fields_list,
        "duplicate": duplicate_field,
        "delete": delete_field,
    }
except ImportError:
    FIELDS_HANDLERS = {}

# Profile handlers (uses unified get.py and save.py)
try:
    from app.api.v4.artifacts.profile.delete import delete_profile
    from app.api.v4.artifacts.profile.get import get_profile
    from app.api.v4.artifacts.profile.save import save_profile

    PROFILE_HANDLERS = {
        "get": get_profile,
        "save": save_profile,
        "list": None,  # Profile doesn't have list (staff list is separate)
        "duplicate": None,  # Profile doesn't have duplicate
        "delete": delete_profile,
    }
except ImportError:
    PROFILE_HANDLERS = {}

# Auth handlers (uses unified save.py)
try:
    from app.api.v4.artifacts.auth.delete import delete_auth
    from app.api.v4.artifacts.auth.duplicate import duplicate_auth
    from app.api.v4.artifacts.auth.get import get_auth
    from app.api.v4.artifacts.auth.list import get_auth_list
    from app.api.v4.artifacts.auth.save import save_auth

    AUTH_HANDLERS = {
        "get": get_auth,
        "save": save_auth,
        "list": get_auth_list,
        "duplicate": duplicate_auth,
        "delete": delete_auth,
    }
except ImportError:
    AUTH_HANDLERS = {}

# Tools handlers
try:
    from app.api.v4.artifacts.tool.delete import delete_tool
    from app.api.v4.artifacts.tool.duplicate import duplicate_tool
    from app.api.v4.artifacts.tool.get import get_tool
    from app.api.v4.artifacts.tool.list import get_tools_list
    from app.api.v4.artifacts.tool.save import save_tool

    TOOLS_HANDLERS = {
        "get": get_tool,
        "save": save_tool,
        "list": get_tools_list,
        "duplicate": duplicate_tool,
        "delete": delete_tool,
    }
except ImportError:
    TOOLS_HANDLERS = {}

# Keys handlers (no CRUD endpoints found, skipping for now)
KEYS_HANDLERS: dict[str, Any] = {}

# Analytics handlers
try:
    from app.api.v4.analytics.activity.get import get_activity_bundle
    from app.api.v4.analytics.activity.list import get_activity_list
    from app.api.v4.analytics.benchmark.get import get_benchmark_overview
    from app.api.v4.analytics.dashboard.get import get_dashboard
    from app.api.v4.analytics.health.get import get_health
    from app.api.v4.analytics.home.get import get_home_overview
    from app.api.v4.analytics.leaderboard.get import get_leaderboard
    from app.api.v4.analytics.practice.get import get_practice_overview
    from app.api.v4.analytics.pricing.get import get_pricing
    from app.api.v4.analytics.reports.get import \
        get_reports  # Single profile report (merged overview + history)
    from app.api.v4.analytics.reports.list import \
        get_reports as get_reports_list  # List for multiple profiles

    ANALYTICS_HANDLERS = {
        "home": get_home_overview,
        "dashboard": get_dashboard,
        "practice": get_practice_overview,
        "leaderboard": get_leaderboard,
        "reports": get_reports_list,  # List for multiple profiles
        "report": get_reports,  # Single profile report (merged overview + history)
        "activity": get_activity_bundle,
        "pricing": get_pricing,
        "health": get_health,
        "benchmark": get_benchmark_overview,
    }
except ImportError:
    ANALYTICS_HANDLERS = {}

# Groups handlers
try:
    from app.api.v4.analytics.pricing.list import get_pricing_list
    from app.api.v4.artifacts.group import get_group

    GROUPS_HANDLERS = {
        "list": get_pricing_list,
        "get": get_group,
    }
except ImportError:
    GROUPS_HANDLERS = {}

# Attempts handlers
try:
    from app.api.v4.analytics.dashboard.list import get_dashboard_history
    from app.api.v4.analytics.home.list import get_home_history
    from app.api.v4.analytics.practice.list import get_practice_history
    from app.api.v4.attempts.archive import bulk_archive_attempts
    from app.api.v4.attempts.benchmark.get import get_eval_attempt_full
    from app.api.v4.attempts.simulation.get import get_attempt_full

    ATTEMPTS_HANDLERS = {
        "list_home": get_home_history,
        "list_dashboard": get_dashboard_history,
        "list_practice": get_practice_history,
        "list_benchmark": None,  # TODO: Will be implemented when benchmark/history endpoint is created
        "get_simulation": get_attempt_full,
        "get_eval": get_eval_attempt_full,
        "archive": bulk_archive_attempts,  # Currently supports simulation only, will support benchmark/eval later
    }
except ImportError:
    ATTEMPTS_HANDLERS = {}

# Settings handlers (embedded in artifacts)
try:
    from app.api.v4.artifacts.setting.list import list_settings
    from app.api.v4.artifacts.setting.update import update_settings

    SETTINGS_HANDLERS = {
        "get": list_settings,
        "save": update_settings,
    }
except ImportError:
    SETTINGS_HANDLERS = {}

# Feedback handlers (for debug/report problem)
try:
    from app.api.v4.feedback.create import create_feedback

    FEEDBACK_HANDLER: Any = create_feedback
except ImportError:
    FEEDBACK_HANDLER: Any = None

# Resource handlers (for create_resource tool)
RESOURCE_HANDLERS: dict[str, Any] = {}
try:
    from app.api.v4.resources.agents import \
        create_agent as create_agent_resource
    from app.api.v4.resources.analyses import create_analyses
    from app.api.v4.resources.audios import create_audio
    from app.api.v4.resources.auths import create_auths
    from app.api.v4.resources.cohorts import create_cohort
    from app.api.v4.resources.colors import create_color
    from app.api.v4.resources.conditional_parameters import \
        create_conditional_parameters
    from app.api.v4.resources.contents import create_contents
    from app.api.v4.resources.conversations import create_conversation
    from app.api.v4.resources.debug_info import create_debug_info
    from app.api.v4.resources.departments import create_department
    from app.api.v4.resources.descriptions import create_description
    from app.api.v4.resources.documents import create_document
    from app.api.v4.resources.emails import create_emails
    from app.api.v4.resources.endpoints import create_endpoints
    from app.api.v4.resources.evals import create_eval
    from app.api.v4.resources.examples import create_example
    from app.api.v4.resources.feedbacks import create_feedbacks
    from app.api.v4.resources.fields import create_field
    from app.api.v4.resources.flags import create_flag
    from app.api.v4.resources.group_positions import create_group_positions
    from app.api.v4.resources.groups import create_groups
    from app.api.v4.resources.groups_rubric_grade_agents import \
        create_groups_rubric_grade_agents
    from app.api.v4.resources.hints import create_hint
    from app.api.v4.resources.html import create_html
    from app.api.v4.resources.icons import create_icon
    from app.api.v4.resources.images import create_image
    from app.api.v4.resources.improvements import create_improvement
    from app.api.v4.resources.instructions import create_instruction
    from app.api.v4.resources.items import create_items
    from app.api.v4.resources.keys import create_key
    from app.api.v4.resources.modalities import create_modalities
    from app.api.v4.resources.models import \
        create_model as create_model_resource
    from app.api.v4.resources.names import create_name
    from app.api.v4.resources.objectives import create_objective
    from app.api.v4.resources.options import create_option
    from app.api.v4.resources.parameters import \
        create_parameter as create_parameter_resource
    from app.api.v4.resources.personas import create_persona
    from app.api.v4.resources.points import create_point
    from app.api.v4.resources.pricing import create_pricing
    from app.api.v4.resources.problem_statements import \
        create_problem_statement
    from app.api.v4.resources.profiles import \
        create_profile as create_profile_resource
    from app.api.v4.resources.prompts import create_prompt
    from app.api.v4.resources.protocols import create_protocols
    from app.api.v4.resources.providers import create_providers
    from app.api.v4.resources.qualities import create_qualities
    from app.api.v4.resources.questions import create_questions
    from app.api.v4.resources.reasoning_levels import create_reasoning_levels
    from app.api.v4.resources.request_limits import create_request_limits
    from app.api.v4.resources.responses import create_response
    from app.api.v4.resources.rubrics import \
        create_rubric as create_rubric_resource
    from app.api.v4.resources.run_positions import create_run_positions
    from app.api.v4.resources.runs import create_runs
    from app.api.v4.resources.runs_rubric_grade_agents import \
        create_runs_rubric_grade_agents
    from app.api.v4.resources.scenario_flags import create_scenario_flags
    from app.api.v4.resources.scenario_positions import \
        create_scenario_position
    from app.api.v4.resources.scenario_rubric_grade_agents import \
        create_scenario_rubric_grade_agent
    from app.api.v4.resources.scenarios import \
        create_scenario as create_scenario_resource
    from app.api.v4.resources.schema_field_items import \
        create_schema_field_item
    from app.api.v4.resources.schema_fields import create_schema_field
    from app.api.v4.resources.schemas import create_schema
    from app.api.v4.resources.settings import create_setting
    from app.api.v4.resources.simulation_scenario_flags import \
        create_simulation_scenario_flag
    from app.api.v4.resources.simulations import create_simulation
    from app.api.v4.resources.slugs import create_slugs
    from app.api.v4.resources.standard_groups import create_standard_group
    from app.api.v4.resources.strengths import create_strength
    from app.api.v4.resources.temperature_levels import \
        create_temperature_levels
    from app.api.v4.resources.template_array_items import \
        create_template_array_item
    from app.api.v4.resources.template_values import create_template_value
    from app.api.v4.resources.templates import create_template
    from app.api.v4.resources.texts import create_texts
    from app.api.v4.resources.thresholds import create_threshold
    from app.api.v4.resources.times import create_time
    from app.api.v4.resources.tools import create_tools
    from app.api.v4.resources.values import create_values
    from app.api.v4.resources.videos import create_video
    from app.api.v4.resources.voices import create_voices

    RESOURCE_HANDLERS = {
        "agents": create_agent_resource,
        "analyses": create_analyses,
        "audios": create_audio,
        "auths": create_auths,
        "cohorts": create_cohort,
        "colors": create_color,
        "conditional_parameters": create_conditional_parameters,
        "contents": create_contents,
        "conversations": create_conversation,
        "debug_info": create_debug_info,
        "departments": create_department,
        "descriptions": create_description,
        "documents": create_document,
        "emails": create_emails,
        "endpoints": create_endpoints,
        "evals": create_eval,
        "examples": create_example,
        "feedbacks": create_feedbacks,
        "fields": create_field,
        "flags": create_flag,
        "group_positions": create_group_positions,
        "groups": create_groups,
        "groups_rubric_grade_agents": create_groups_rubric_grade_agents,
        "hints": create_hint,
        "html": create_html,
        "icons": create_icon,
        "images": create_image,
        "improvements": create_improvement,
        "instructions": create_instruction,
        "items": create_items,
        "keys": create_key,
        "modalities": create_modalities,
        "models": create_model_resource,
        "names": create_name,
        "objectives": create_objective,
        "options": create_option,
        "parameters": create_parameter_resource,
        "personas": create_persona,
        "points": create_point,
        "pricing": create_pricing,
        "problem_statements": create_problem_statement,
        "profiles": create_profile_resource,
        "prompts": create_prompt,
        "protocols": create_protocols,
        "providers": create_providers,
        "qualities": create_qualities,
        "questions": create_questions,
        "reasoning_levels": create_reasoning_levels,
        "request_limits": create_request_limits,
        "responses": create_response,
        "rubrics": create_rubric_resource,
        "run_positions": create_run_positions,
        "runs": create_runs,
        "runs_rubric_grade_agents": create_runs_rubric_grade_agents,
        "scenario_flags": create_scenario_flags,
        "scenario_positions": create_scenario_position,
        "scenario_rubric_grade_agents": create_scenario_rubric_grade_agent,
        "scenarios": create_scenario_resource,
        "schema_field_items": create_schema_field_item,
        "schema_fields": create_schema_field,
        "schemas": create_schema,
        "settings": create_setting,
        "simulation_scenario_flags": create_simulation_scenario_flag,
        "simulations": create_simulation,
        "slugs": create_slugs,
        "standard_groups": create_standard_group,
        "strengths": create_strength,
        "temperature_levels": create_temperature_levels,
        "template_array_items": create_template_array_item,
        "template_values": create_template_value,
        "templates": create_template,
        "texts": create_texts,
        "thresholds": create_threshold,
        "times": create_time,
        "tools": create_tools,
        "values": create_values,
        "videos": create_video,
        "voices": create_voices,
    }
except ImportError:
    RESOURCE_HANDLERS = {}

# Import artifact documentation functions
# Maps singular artifact names (MCP/database) to docs functions
# Docs functions are imported from artifact endpoints
ARTIFACT_DOCS: dict[str, Any] = {}
try:
    from app.api.v4.artifacts.persona.docs import get_personas_docs
    ARTIFACT_DOCS["persona"] = get_personas_docs
except ImportError:
    pass
try:
    from app.api.v4.artifacts.scenario.docs import get_scenarios_docs
    ARTIFACT_DOCS["scenario"] = get_scenarios_docs
except ImportError:
    pass
try:
    from app.api.v4.artifacts.simulation.docs import get_simulations_docs
    ARTIFACT_DOCS["simulation"] = get_simulations_docs
except ImportError:
    pass
try:
    from app.api.v4.artifacts.document.docs import get_documents_docs
    ARTIFACT_DOCS["document"] = get_documents_docs
except ImportError:
    pass
try:
    from app.api.v4.artifacts.department.docs import get_departments_docs
    ARTIFACT_DOCS["department"] = get_departments_docs
except ImportError:
    pass
try:
    from app.api.v4.artifacts.cohort.docs import get_cohorts_docs
    ARTIFACT_DOCS["cohort"] = get_cohorts_docs
except ImportError:
    pass
try:
    from app.api.v4.artifacts.eval.docs import get_evals_docs
    ARTIFACT_DOCS["eval"] = get_evals_docs
except ImportError:
    pass
try:
    from app.api.v4.artifacts.rubric.docs import get_rubrics_docs
    ARTIFACT_DOCS["rubric"] = get_rubrics_docs
except ImportError:
    pass
try:
    from app.api.v4.artifacts.setting.docs import get_settings_docs
    ARTIFACT_DOCS["setting"] = get_settings_docs
except ImportError:
    pass
try:
    from app.api.v4.artifacts.agent.docs import get_agents_docs
    ARTIFACT_DOCS["agent"] = get_agents_docs
except ImportError:
    pass
try:
    from app.api.v4.artifacts.model.docs import get_models_docs
    ARTIFACT_DOCS["model"] = get_models_docs
except ImportError:
    pass
try:
    from app.api.v4.artifacts.provider.docs import get_providers_docs
    ARTIFACT_DOCS["provider"] = get_providers_docs
except ImportError:
    pass
try:
    from app.api.v4.artifacts.parameter.docs import get_parameters_docs
    ARTIFACT_DOCS["parameter"] = get_parameters_docs
except ImportError:
    pass
try:
    from app.api.v4.artifacts.field.docs import get_fields_docs
    ARTIFACT_DOCS["field"] = get_fields_docs
except ImportError:
    pass
try:
    from app.api.v4.artifacts.profile.docs import get_profiles_docs
    ARTIFACT_DOCS["profile"] = get_profiles_docs
except ImportError:
    pass
try:
    from app.api.v4.artifacts.auth.docs import get_auths_docs
    ARTIFACT_DOCS["auth"] = get_auths_docs
except ImportError:
    pass
try:
    from app.api.v4.artifacts.tool.docs import get_tools_docs
    ARTIFACT_DOCS["tool"] = get_tools_docs
except ImportError:
    pass


# Import root GLOW documentation
try:
    from app.api.v4.docs import get_glow_docs as _get_glow_docs

    def get_glow_docs() -> dict[str, Any]:
        """Wrapper for root GLOW docs."""
        return _get_glow_docs()
except ImportError:

    def get_glow_docs() -> dict[str, Any]:
        """Fallback when root docs not available."""
        return {"error": "Root GLOW documentation not available."}


# Mapping from singular artifact names (MCP/database) to plural API endpoint names
# This allows MCP to use singular names matching the database while API uses plural
ARTIFACT_TO_API_NAME: dict[str, str] = {
    "persona": "personas",
    "scenario": "scenarios",
    "simulation": "simulations",
    "document": "documents",
    "department": "departments",
    "cohort": "cohorts",
    "eval": "evals",
    "rubric": "rubrics",
    "setting": "settings",
    "agent": "agents",
    "model": "models",
    "provider": "providers",
    "parameter": "parameters",
    "field": "fields",
    "profile": "profile",  # Already singular in API
    "auth": "auth",  # Already singular in API
    "tool": "tools",
}

# Handler mapping - maps singular artifact name (MCP/database) to available operations
# Handlers are imported from plural API endpoints but mapped by singular names
HANDLERS: dict[str, dict[str, Any]] = {
    "persona": PERSONAS_HANDLERS,
    "scenario": SCENARIOS_HANDLERS,
    "simulation": SIMULATIONS_HANDLERS,
    "document": DOCUMENTS_HANDLERS,
    "department": DEPARTMENTS_HANDLERS,
    "cohort": COHORTS_HANDLERS,
    "eval": EVALS_HANDLERS,
    "rubric": RUBRICS_HANDLERS,
    "setting": SETTINGS_HANDLERS,
    "agent": AGENTS_HANDLERS,
    "model": MODELS_HANDLERS,
    "provider": PROVIDERS_HANDLERS,
    "parameter": PARAMETERS_HANDLERS,
    "field": FIELDS_HANDLERS,
    "profile": PROFILE_HANDLERS,
    "auth": AUTH_HANDLERS,
    "tool": TOOLS_HANDLERS,
}


def is_artifact(name: str) -> bool:
    """Check if name is an artifact."""
    return name in ARTIFACTS


def is_resource(name: str) -> bool:
    """Check if name is a resource."""
    return name in RESOURCES


def get_available_operations(name: str) -> list[str]:
    """Get list of available operations for an item."""
    if name not in HANDLERS:
        return []
    return list(HANDLERS[name].keys())


def get_payload_schema(name: str) -> dict[str, Any]:
    """Get payload schema for artifact/resource operations."""
    if name not in ALL_ITEMS:
        return {"error": f"'{name}' is not a valid artifact or resource."}

    # Try to get schema from handler if available
    if name in HANDLERS and "get" in HANDLERS[name]:
        try:
            handler = HANDLERS[name]["get"]
            # Try to get request model from handler
            if hasattr(handler, "__annotations__"):
                annotations = handler.__annotations__
                if "request" in annotations:
                    request_type = annotations["request"]
                    if hasattr(request_type, "model_json_schema"):
                        schema: dict[str, Any] = request_type.model_json_schema()  # type: ignore[assignment]
                        return schema
        except Exception:
            pass

    # Return generic schema
    return {
        "type": "object",
        "properties": {
            "name": {"type": "string", "description": f"The {name} identifier"},
            "payload": {
                "type": "object",
                "description": f"Payload for {name} operation",
            },
        },
        "required": ["name"],
    }


async def call_handler(
    name: str, operation: str, payload: dict[str, Any], profile_id: str
) -> dict[str, Any]:
    """Call a handler function with the given payload."""
    if name not in HANDLERS:
        return {
            "error": f"TODO: '{name}' does not have handlers implemented yet.",
            "status": "not_implemented",
        }

    if operation not in HANDLERS[name]:
        return {
            "error": f"TODO: Operation '{operation}' not available for '{name}'.",
            "status": "not_implemented",
        }

    handler = HANDLERS[name][operation]
    if handler is None:
        return {
            "error": f"Handler for {name}.{operation} is not implemented yet.",
            "status": "not_implemented",
        }

    # Call the handler using call_endpoint_handler which properly sets up Request/Response/DB context
    return await call_endpoint_handler(handler, payload, profile_id)


def get_request_model_from_handler(handler: Any) -> Any | None:
    """Extract request model from handler function annotations.
    
    Args:
        handler: The handler function
        
    Returns:
        Request model class or None if not found
    """
    try:
        sig = inspect.signature(handler)
        params = list(sig.parameters.values())
        if params and len(params) > 0:
            # First parameter is usually the request model
            first_param = params[0]
            if first_param.annotation != inspect.Parameter.empty:
                return first_param.annotation
    except Exception:
        pass
    
    return None


async def call_endpoint_handler(
    handler: Any,
    payload: dict[str, Any],
    profile_id: str,
) -> dict[str, Any]:
    """Call an endpoint handler with proper Request/Response/DB context.
    
    Args:
        handler: The handler function to call
        payload: The payload dictionary (will be passed as request body)
        profile_id: The profile ID to use
        
    Returns:
        Dictionary with response data or error information
    """
    from app.main import get_db
    from starlette.requests import Request as StarletteRequest
    
    try:
        # Get request model from handler
        request_model = get_request_model_from_handler(handler)
        if not request_model:
            return {
                "error": "Could not determine request model from handler",
                "status": "error",
            }
        
        # Create Request object with proper scope
        scope = {
            "type": "http",
            "method": "POST",
            "path": "/api/v4/mcp",
            "headers": [],
            "query_string": b"",
            "server": ("localhost", 8000),
        }
        http_request = StarletteRequest(scope)
        
        # Set profile_id in request state
        http_request.state.profile_id = profile_id
        http_request.state.mcp = True
        
        # Create Response object
        http_response = Response()
        
        # Get database connection (get_db is an async generator)
        async for conn in get_db():
            # Parse payload into request model
            api_request = request_model(**payload)
            
            # Call handler
            result = await handler(
                request=api_request,
                http_request=http_request,
                response=http_response,
                conn=conn,
            )
            
            # Convert result to dict
            if hasattr(result, "model_dump"):
                result_dict = result.model_dump(mode="json")
                return cast(dict[str, Any], result_dict)
            elif hasattr(result, "dict"):
                result_dict = result.dict()
                return cast(dict[str, Any], result_dict)
            else:
                return cast(dict[str, Any], {"data": result})
        
        # This should never happen (get_db always yields), but satisfy type checker
        return {
            "error": "Database connection not available",
            "status": "error",
        }
                
    except Exception as e:
        return {
            "error": str(e),
            "status": "error",
            "type": type(e).__name__,
        }


def register_endpoints(server: FastMCP) -> None:
    """Register all MCP endpoints."""

    @server.tool()
    def artifacts() -> list[dict[str, str]]:
        """List all available artifacts with descriptions.

        Returns:
            List of dictionaries with 'name' and 'description' keys.
        """
        return [
            {
                "name": artifact,
                "description": ARTIFACT_DESCRIPTIONS.get(
                    artifact, "No description available"
                ),
            }
            for artifact in ARTIFACTS
        ]

    @server.tool()
    def resources() -> list[dict[str, str]]:
        """List all available resources with descriptions.

        Returns:
            List of dictionaries with 'name' and 'description' keys.
        """
        return [
            {
                "name": resource,
                "description": RESOURCE_DESCRIPTIONS.get(
                    resource, "No description available"
                ),
            }
            for resource in RESOURCES
        ]

    @server.tool()
    def docs_artifact(name: str) -> dict[str, Any]:
        """Get comprehensive documentation for an artifact.

        Args:
            name: The name of the artifact to get documentation for.

        Returns:
            Dictionary containing database schema, relationships, API routing,
            resources, frontend information, and GLOW context.
        """
        if name not in ARTIFACTS:
            return {"error": f"'{name}' is not a valid artifact."}

        if name not in ARTIFACT_DOCS:
            return {
                "error": f"Documentation not available for '{name}'",
                "note": "Documentation may not be implemented yet. Check if docs.py exists for this artifact.",
            }

        result = ARTIFACT_DOCS[name]()
        return cast(dict[str, Any], result)

    @server.tool()
    def docs() -> dict[str, Any]:
        """Get general GLOW documentation.

        Returns:
            Dictionary containing general information about GLOW, its architecture,
            concepts, and patterns.
        """
        if get_glow_docs is None:
            return {"error": "Root GLOW documentation not available."}
        return get_glow_docs()

    @server.tool()
    def payload_artifact(name: str) -> dict[str, Any]:  # type: ignore[return]
        """Get payload schema for an artifact.

        Args:
            name: The name of the artifact.

        Returns:
            JSON schema for the payload.
        """
        return get_payload_schema(name)

    @server.tool()
    def payload_resource(name: str) -> dict[str, Any]:  # type: ignore[return]
        """Get payload schema for a resource.

        Args:
            name: The name of the resource.

        Returns:
            JSON schema for the payload.
        """
        return get_payload_schema(name)

    @server.tool()
    async def get_artifact(
        name: str, payload: dict[str, Any], profile_id: str
    ) -> dict[str, Any]:
        """Get an artifact or resource by name.

        Args:
            name: The name of the artifact or resource.
            payload: The payload containing parameters for the get operation.
            profile_id: Profile ID for authentication.

        Returns:
            The artifact/resource data or error message.
        """
        return await call_handler(name, "get", payload, profile_id)

    @server.tool()
    async def save_artifact(
        name: str, payload: dict[str, Any], profile_id: str
    ) -> dict[str, Any]:
        """Save (create or update) an artifact or resource.

        Args:
            name: The name of the artifact or resource.
            payload: The payload containing data to save.
            profile_id: Profile ID for authentication.

        Returns:
            Success response or error message.
        """
        return await call_handler(name, "save", payload, profile_id)

    @server.tool()
    async def list_artifact(
        name: str, payload: dict[str, Any], profile_id: str
    ) -> dict[str, Any]:
        """List items for an artifact or resource.

        Args:
            name: The name of the artifact or resource.
            payload: The payload containing filter parameters.
            profile_id: Profile ID for authentication.

        Returns:
            List of items or error message.
        """
        return await call_handler(name, "list", payload, profile_id)

    @server.tool()
    async def duplicate_artifact(
        name: str, payload: dict[str, Any], profile_id: str
    ) -> dict[str, Any]:
        """Duplicate an artifact or resource.

        Args:
            name: The name of the artifact or resource.
            payload: The payload containing the item to duplicate.
            profile_id: Profile ID for authentication.

        Returns:
            Duplicated item data or error message.
        """
        return await call_handler(name, "duplicate", payload, profile_id)

    @server.tool()
    async def delete_artifact(
        name: str, payload: dict[str, Any], profile_id: str
    ) -> dict[str, Any]:
        """Delete an artifact or resource.

        Args:
            name: The name of the artifact or resource.
            payload: The payload containing the item to delete.
            profile_id: Profile ID for authentication.

        Returns:
            Success response or error message.
        """
        return await call_handler(name, "delete", payload, profile_id)

    # Resource-specific endpoints (create only)
    @server.tool()
    async def create_resource(
        name: str, payload: dict[str, Any], profile_id: str
    ) -> dict[str, Any]:
        """Create a resource.

        Args:
            name: The name of the resource.
            payload: The payload containing data to create the resource.
            profile_id: Profile ID for authentication.

        Returns:
            Success response or error message.
        """
        # Resources are create-only, not full CRUD
        if name not in RESOURCES:
            return {
                "error": f"'{name}' is not a valid resource.",
                "status": "invalid_resource",
            }

        if name not in RESOURCE_HANDLERS:
            return {
                "error": f"Resource '{name}' handler not implemented.",
                "status": "not_implemented",
            }

        handler = RESOURCE_HANDLERS[name]
        return await call_endpoint_handler(handler, payload, profile_id)

    # Analytics endpoints
    @server.tool()
    async def analytics(
        type: str, payload: dict[str, Any], profile_id: str
    ) -> dict[str, Any]:
        """Call analytics endpoint by type.

        Args:
            type: Analytics type (home, dashboard, practice, leaderboard, reports, report, activity, pricing, health, benchmark)
            payload: Request payload
            profile_id: Profile ID for authentication

        Returns:
            Analytics data or error message.
        """
        if type not in ANALYTICS_HANDLERS:
            return {
                "error": f"'{type}' is not a valid analytics type.",
                "status": "invalid_type",
                "valid_types": list(ANALYTICS_HANDLERS.keys()),
            }

        handler = ANALYTICS_HANDLERS[type]
        if handler is None:
            return {
                "error": f"Analytics type '{type}' is not implemented yet.",
                "status": "not_implemented",
            }

        return await call_endpoint_handler(handler, payload, profile_id)  # type: ignore[arg-type]

    @server.tool()
    def analytics_payload(type: str) -> dict[str, Any]:
        """Get payload schema for analytics endpoint type.

        Args:
            type: Analytics type (home, dashboard, practice, leaderboard, reports, report, activity, pricing, health, benchmark)

        Returns:
            JSON schema for the payload.
        """
        if type not in ANALYTICS_HANDLERS:
            return {
                "error": f"'{type}' is not a valid analytics type.",
                "status": "invalid_type",
                "valid_types": list(ANALYTICS_HANDLERS.keys()),
            }

        handler = ANALYTICS_HANDLERS[type]
        if handler is None:
            return {
                "error": f"Analytics type '{type}' is not implemented yet.",
                "status": "not_implemented",
            }

        request_model = get_request_model_from_handler(handler)  # type: ignore[arg-type]
        if request_model and hasattr(request_model, "model_json_schema"):
            schema = request_model.model_json_schema()
            return cast(dict[str, Any], schema)

        return {
            "type": "object",
            "properties": {
                "payload": {
                    "type": "object",
                    "description": f"Payload for {type} analytics endpoint",
                }
            },
        }

    # Groups endpoints (pricing)
    @server.tool()
    async def list_groups(
        payload: dict[str, Any], profile_id: str
    ) -> dict[str, Any]:
        """List pricing groups/runs.

        Args:
            payload: Request payload
            profile_id: Profile ID for authentication

        Returns:
            List of pricing groups/runs or error message.
        """
        if "list" not in GROUPS_HANDLERS:
            return {
                "error": "list_groups handler not available.",
                "status": "not_implemented",
            }

        handler = GROUPS_HANDLERS["list"]
        return await call_endpoint_handler(handler, payload, profile_id)

    @server.tool()
    async def get_group(
        payload: dict[str, Any], profile_id: str
    ) -> dict[str, Any]:
        """Get pricing group detail.

        Args:
            payload: Request payload (must include group_id)
            profile_id: Profile ID for authentication

        Returns:
            Pricing group detail or error message.
        """
        if "get" not in GROUPS_HANDLERS:
            return {
                "error": "get_group handler not available.",
                "status": "not_implemented",
            }

        handler = GROUPS_HANDLERS["get"]
        return await call_endpoint_handler(handler, payload, profile_id)

    # Attempts endpoints
    @server.tool()
    async def list_attempts(
        type: str, payload: dict[str, Any], profile_id: str
    ) -> dict[str, Any]:
        """List attempts by type.

        Args:
            type: Attempt type (home, dashboard, practice, benchmark)
            payload: Request payload
            profile_id: Profile ID for authentication

        Returns:
            List of attempts or error message.
        """
        type_map = {
            "home": "list_home",
            "dashboard": "list_dashboard",
            "practice": "list_practice",
            "benchmark": "list_benchmark",
        }

        operation = type_map.get(type)
        if not operation:
            return {
                "error": f"'{type}' is not a valid attempt type.",
                "status": "invalid_type",
                "valid_types": list(type_map.keys()),
            }

        if operation not in ATTEMPTS_HANDLERS:
            return {
                "error": f"list_attempts for type '{type}' is not available.",
                "status": "not_implemented",
            }

        handler = ATTEMPTS_HANDLERS[operation]
        if handler is None:
            return {
                "error": f"list_attempts for type '{type}' is not implemented yet.",
                "status": "not_implemented",
                "note": "Benchmark history endpoint will be created in the future.",
            }

        return await call_endpoint_handler(handler, payload, profile_id)

    @server.tool()
    async def get_attempt(
        type: str, attempt_id: str, payload: dict[str, Any], profile_id: str
    ) -> dict[str, Any]:
        """Get attempt by type and ID.

        Args:
            type: Attempt type (simulation, eval)
            attempt_id: Attempt ID
            payload: Request payload (will include attempt_id)
            profile_id: Profile ID for authentication

        Returns:
            Attempt data or error message.
        """
        type_map = {
            "simulation": "get_simulation",
            "eval": "get_eval",
        }

        operation = type_map.get(type)
        if not operation:
            return {
                "error": f"'{type}' is not a valid attempt type.",
                "status": "invalid_type",
                "valid_types": list(type_map.keys()),
            }

        if operation not in ATTEMPTS_HANDLERS:
            return {
                "error": f"get_attempt for type '{type}' is not available.",
                "status": "not_implemented",
            }

        handler = ATTEMPTS_HANDLERS[operation]

        # Add attempt_id to payload
        payload_with_id = {**payload, "attempt_id": attempt_id}
        return await call_endpoint_handler(handler, payload_with_id, profile_id)

    @server.tool()
    async def archive_attempts(
        type: str,
        archive: bool,
        ids: list[str],
        payload: dict[str, Any],
        profile_id: str,
    ) -> dict[str, Any]:
        """Archive or unarchive attempts.

        Args:
            type: Attempt type (simulation, benchmark, eval)
            archive: True to archive, False to unarchive
            ids: List of attempt IDs
            payload: Additional request payload
            profile_id: Profile ID for authentication

        Returns:
            Archive result or error message.
        """
        # Currently only simulation is supported
        if type != "simulation":
            return {
                "error": f"archive_attempts for type '{type}' is not implemented yet.",
                "status": "not_implemented",
                "note": "Will support benchmark and eval types in the future.",
            }

        if "archive" not in ATTEMPTS_HANDLERS:
            return {
                "error": "archive_attempts handler not available.",
                "status": "not_implemented",
            }

        handler = ATTEMPTS_HANDLERS["archive"]

        # Add archive parameters to payload
        payload_with_params = {
            **payload,
            "attempt_ids": ids,
            "archived": archive,
        }
        return await call_endpoint_handler(handler, payload_with_params, profile_id)


    # Debug/Report Problem endpoint
    @server.tool()
    async def debug(
        type: str, message: str, profile_id: str
    ) -> dict[str, Any]:
        """Report a problem or provide feedback (debug tool).

        Args:
            type: Problem type (feature, bug, question, other)
            message: Problem description or feedback message (max 1000 characters)
            profile_id: Profile ID for authentication

        Returns:
            Feedback creation result or error message.
        """
        if FEEDBACK_HANDLER is None:
            return {
                "error": "debug/report problem handler not available.",
                "status": "not_implemented",
            }

        # Validate type
        valid_types = ["feature", "bug", "question", "other"]
        if type not in valid_types:
            return {
                "error": f"Invalid feedback type: '{type}'",
                "status": "invalid_type",
                "valid_types": valid_types,
            }

        # Validate message
        if not message or not message.strip():
            return {
                "error": "Message is required",
                "status": "validation_error",
            }

        if len(message) > 1000:
            return {
                "error": "Message must be less than 1000 characters",
                "status": "validation_error",
            }

        # Create payload for feedback endpoint
        payload = {
            "type": type,
            "message": message.strip(),
        }

        return await call_endpoint_handler(FEEDBACK_HANDLER, payload, profile_id)
