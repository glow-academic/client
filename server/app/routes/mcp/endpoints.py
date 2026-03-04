"""Unified endpoints for artifacts, resources, and entries.

Uses explicit handler registries with lazy imports — no filesystem scanning,
no dynamic discovery, no circular imports.
"""

import inspect
import os
from typing import Any, cast

from fastapi import Response
from mcp.server.fastmcp import FastMCP

ORIGIN = os.getenv("ORIGIN", "http://localhost:3000")

# ============================================================================
# Lazy Import Cache
# ============================================================================

_handler_cache: dict[str, Any] = {}


def _get_handler(module_path: str, func_name: str) -> Any:
    """Import and cache a handler function.

    Safe because app is fully loaded when MCP tools run (at call time, not load time).
    """
    key = f"{module_path}.{func_name}"
    if key not in _handler_cache:
        import importlib

        mod = importlib.import_module(module_path)
        _handler_cache[key] = getattr(mod, func_name)
    return _handler_cache[key]


# ============================================================================
# Artifact Registry — 29 artifacts
# ============================================================================
# Each artifact maps operation → (module_path, function_name).
# Docs handlers are sync functions returning dicts (called without await).

ARTIFACT_REGISTRY: dict[str, dict[str, tuple[str, str]]] = {
    "activity": {
        "get": ("app.routes.v5.api.main.activity.get", "get_activity"),
        "docs": ("app.routes.v5.api.main.activity.docs", "get_activity_docs_static"),
        "refresh": ("app.routes.v5.api.main.activity.refresh", "activity_refresh"),
    },
    # "agent": {
    #     "get": ("app.routes.v5.api.main.agent.get", "get_agent"),
    #     "list": ("app.routes.v5.api.main.agent.list", "get_agent_list"),
    #     "save": ("app.routes.v5.api.main.agent.save", "save_agent"),
    #     "delete": ("app.routes.v5.api.main.agent.delete", "delete_agent"),
    #     "duplicate": ("app.routes.v5.api.main.agent.duplicate", "duplicate_agent"),
    #     "draft": ("app.routes.v5.api.main.agent.draft", "patch_agent_draft"),
    #     "docs": ("app.routes.v5.api.main.agent.docs", "get_agents_docs"),
    # },
    "attempt": {
        "get": ("app.routes.v5.api.main.attempt.get", "attempt_get"),
        "docs": ("app.routes.v5.api.main.attempt.docs", "get_attempts_docs"),
    },
    # "auth": {
    #     "get": ("app.routes.v5.api.main.auth.get", "get_auth"),
    #     "list": ("app.routes.v5.api.main.auth.list", "get_auth_list"),
    #     "save": ("app.routes.v5.api.main.auth.save", "save_auth"),
    #     "delete": ("app.routes.v5.api.main.auth.delete", "delete_auth"),
    #     "duplicate": ("app.routes.v5.api.main.auth.duplicate", "duplicate_auth"),
    #     "draft": ("app.routes.v5.api.main.auth.draft", "patch_auth_draft"),
    #     "docs": ("app.routes.v5.api.main.auth.docs", "get_auths_docs"),
    # },
    "benchmark": {
        "get": ("app.routes.v5.api.main.benchmark.get", "benchmark_bundle_get"),
        "refresh": ("app.routes.v5.api.main.benchmark.refresh", "benchmark_refresh"),
        "docs": ("app.routes.v5.api.main.benchmark.docs", "get_benchmarks_docs"),
    },
    "cohort": {
        "get": ("app.routes.v5.api.main.cohort.get", "get_cohort"),
        "list": ("app.routes.v5.api.main.cohort.list", "get_cohort_list"),
        "save": ("app.routes.v5.api.main.cohort.save", "save_cohort"),
        "delete": ("app.routes.v5.api.main.cohort.delete", "delete_cohort"),
        "duplicate": ("app.routes.v5.api.main.cohort.duplicate", "duplicate_cohort"),
        "draft": ("app.routes.v5.api.main.cohort.draft", "patch_cohort_draft"),
        "docs": ("app.routes.v5.api.main.cohort.docs", "get_cohorts_docs"),
    },
    "dashboard": {
        "get": ("app.routes.v5.api.main.dashboard.get", "get_dashboard"),
        "header": ("app.routes.v5.api.main.dashboard.header", "get_dashboard_header"),
        "footer": ("app.routes.v5.api.main.dashboard.footer", "get_dashboard_footer"),
        "primary": (
            "app.routes.v5.api.main.dashboard.primary",
            "get_dashboard_primary",
        ),
        "secondary": (
            "app.routes.v5.api.main.dashboard.secondary",
            "get_dashboard_secondary",
        ),
        "refresh": ("app.routes.v5.api.main.dashboard.refresh", "dashboard_refresh"),
        "docs": ("app.routes.v5.api.main.dashboard.docs", "get_dashboard_docs_static"),
    },
    # "department": {
    #     "get": ("app.routes.v5.api.main.department.get", "get_department"),
    #     "list": ("app.routes.v5.api.main.department.list", "get_department_list"),
    #     "save": ("app.routes.v5.api.main.department.save", "save_department"),
    #     "delete": ("app.routes.v5.api.main.department.delete", "delete_department"),
    #     "duplicate": (
    #         "app.routes.v5.api.main.department.duplicate",
    #         "duplicate_department",
    #     ),
    #     "draft": ("app.routes.v5.api.main.department.draft", "patch_department_draft"),
    #     "docs": ("app.routes.v5.api.main.department.docs", "get_departments_docs"),
    # },
    # "document": {
    #     "get": ("app.routes.v5.api.main.document.get", "get_document"),
    #     "list": ("app.routes.v5.api.main.document.list", "get_document_list"),
    #     "save": ("app.routes.v5.api.main.document.save", "save_document"),
    #     "delete": ("app.routes.v5.api.main.document.delete", "delete_document"),
    #     "duplicate": ("app.routes.v5.api.main.document.duplicate", "duplicate_document"),
    #     "draft": ("app.routes.v5.api.main.document.draft", "patch_document_draft"),
    #     "docs": ("app.routes.v5.api.main.document.docs", "get_documents_docs"),
    # },
    # "eval": {
    #     "get": ("app.routes.v5.api.main.eval.get", "get_eval"),
    #     "list": ("app.routes.v5.api.main.eval.list", "get_eval_list"),
    #     "save": ("app.routes.v5.api.main.eval.save", "save_eval"),
    #     "delete": ("app.routes.v5.api.main.eval.delete", "delete_eval"),
    #     "duplicate": ("app.routes.v5.api.main.eval.duplicate", "duplicate_eval"),
    #     "draft": ("app.routes.v5.api.main.eval.draft", "patch_eval_draft"),
    #     "docs": ("app.routes.v5.api.main.eval.docs", "get_evals_docs"),
    # },
    # "field": {
    #     "get": ("app.routes.v5.api.main.field.get", "get_field"),
    #     "list": ("app.routes.v5.api.main.field.list", "get_field_list"),
    #     "save": ("app.routes.v5.api.main.field.save", "save_field"),
    #     "delete": ("app.routes.v5.api.main.field.delete", "delete_field"),
    #     "duplicate": ("app.routes.v5.api.main.field.duplicate", "duplicate_field"),
    #     "draft": ("app.routes.v5.api.main.field.draft", "patch_field_draft"),
    #     "docs": ("app.routes.v5.api.main.field.docs", "get_fields_docs"),
    # },
    "group": {
        "get": ("app.routes.v5.api.main.group.get", "get_group"),
        "docs": ("app.routes.v5.api.main.group.docs", "get_groups_docs"),
    },
    # "health": {
    #     "get": ("app.routes.v5.api.main.health.get", "get_health"),
    #     "refresh": ("app.routes.v5.api.main.health.refresh", "health_refresh"),
    #     "docs": ("app.routes.v5.api.main.health.docs", "get_health_docs_static"),
    # },
    "leaderboard": {
        "get": ("app.routes.v5.api.main.leaderboard.get", "get_leaderboard"),
        "refresh": (
            "app.routes.v5.api.main.leaderboard.refresh",
            "leaderboard_refresh",
        ),
        "docs": (
            "app.routes.v5.api.main.leaderboard.docs",
            "get_leaderboard_docs_static",
        ),
    },
    # "model": {
    #     "get": ("app.routes.v5.api.main.model.get", "get_model"),
    #     "list": ("app.routes.v5.api.main.model.list", "get_model_list"),
    #     "save": ("app.routes.v5.api.main.model.save", "save_model"),
    #     "delete": ("app.routes.v5.api.main.model.delete", "delete_model"),
    #     "duplicate": ("app.routes.v5.api.main.model.duplicate", "duplicate_model"),
    #     "draft": ("app.routes.v5.api.main.model.draft", "patch_model_draft"),
    #     "docs": ("app.routes.v5.api.main.model.docs", "get_models_docs"),
    # },
    # "parameter": {
    #     "get": ("app.routes.v5.api.main.parameter.get", "get_parameter"),
    #     "list": ("app.routes.v5.api.main.parameter.list", "get_parameter_list"),
    #     "save": ("app.routes.v5.api.main.parameter.save", "save_parameter"),
    #     "delete": ("app.routes.v5.api.main.parameter.delete", "delete_parameter"),
    #     "duplicate": (
    #         "app.routes.v5.api.main.parameter.duplicate",
    #         "duplicate_parameter",
    #     ),
    #     "draft": ("app.routes.v5.api.main.parameter.draft", "patch_parameter_draft"),
    #     "docs": ("app.routes.v5.api.main.parameter.docs", "get_parameters_docs"),
    # },
    "persona": {
        "get": ("app.routes.v5.api.main.persona.get", "get_persona"),
        "list": ("app.routes.v5.api.main.persona.list", "get_persona_list"),
        "save": ("app.routes.v5.api.main.persona.save", "save_persona"),
        "delete": ("app.routes.v5.api.main.persona.delete", "delete_persona"),
        "duplicate": ("app.routes.v5.api.main.persona.duplicate", "duplicate_persona"),
        "draft": ("app.routes.v5.api.main.persona.draft", "patch_persona_draft"),
        "docs": ("app.routes.v5.api.main.persona.docs", "get_personas_docs"),
    },
    "pricing": {
        "get": ("app.routes.v5.api.main.pricing.get", "get_pricing"),
        "refresh": ("app.routes.v5.api.main.pricing.refresh", "pricing_refresh"),
        "docs": ("app.routes.v5.api.main.pricing.docs", "get_pricing_docs_static"),
    },
    # "profile": {
    #     "get": ("app.routes.v5.api.main.profile.get", "get_profile"),
    #     "list": ("app.routes.v5.api.main.profile.list", "get_profile_list"),
    #     "save": ("app.routes.v5.api.main.profile.save", "save_profile"),
    #     "delete": ("app.routes.v5.api.main.profile.delete", "delete_profile"),
    #     "duplicate": ("app.routes.v5.api.main.profile.duplicate", "duplicate_profile"),
    #     "draft": ("app.routes.v5.api.main.profile.draft", "patch_profile_draft"),
    #     "docs": ("app.routes.v5.api.main.profile.docs", "get_profiles_docs"),
    # },
    # "provider": {
    #     "get": ("app.routes.v5.api.main.provider.get", "get_provider"),
    #     "list": ("app.routes.v5.api.main.provider.list", "get_provider_list"),
    #     "save": ("app.routes.v5.api.main.provider.save", "save_provider"),
    #     "delete": ("app.routes.v5.api.main.provider.delete", "delete_provider"),
    #     "duplicate": ("app.routes.v5.api.main.provider.duplicate", "duplicate_provider"),
    #     "draft": ("app.routes.v5.api.main.provider.draft", "patch_provider_draft"),
    #     "docs": ("app.routes.v5.api.main.provider.docs", "get_providers_docs"),
    # },
    "reports": {
        "get": ("app.routes.v5.api.main.reports.get", "get_reports"),
        "refresh": ("app.routes.v5.api.main.reports.refresh", "reports_refresh"),
        "docs": ("app.routes.v5.api.main.reports.docs", "get_reports_docs_static"),
    },
    # "rubric": {
    #     "get": ("app.routes.v5.api.main.rubric.get", "get_rubric"),
    #     "list": ("app.routes.v5.api.main.rubric.list", "get_rubric_list"),
    #     "save": ("app.routes.v5.api.main.rubric.save", "save_rubric"),
    #     "delete": ("app.routes.v5.api.main.rubric.delete", "delete_rubric"),
    #     "duplicate": ("app.routes.v5.api.main.rubric.duplicate", "duplicate_rubric"),
    #     "draft": ("app.routes.v5.api.main.rubric.draft", "patch_rubric_draft"),
    #     "docs": ("app.routes.v5.api.main.rubric.docs", "get_rubrics_docs"),
    # },
    "scenario": {
        "get": ("app.routes.v5.api.main.scenario.get", "get_scenario"),
        "list": ("app.routes.v5.api.main.scenario.list", "get_scenario_list"),
        "save": ("app.routes.v5.api.main.scenario.save", "save_scenario"),
        "delete": ("app.routes.v5.api.main.scenario.delete", "delete_scenario"),
        "duplicate": (
            "app.routes.v5.api.main.scenario.duplicate",
            "duplicate_scenario",
        ),
        "draft": ("app.routes.v5.api.main.scenario.draft", "patch_scenario_draft"),
        "docs": ("app.routes.v5.api.main.scenario.docs", "get_scenarios_docs"),
    },
    "session": {
        "get": ("app.routes.v5.api.main.session.get", "get_session"),
        "docs": ("app.routes.v5.api.main.session.docs", "get_sessions_docs"),
    },
    # "setting": {
    #     "get": ("app.routes.v5.api.main.setting.get", "get_setting"),
    #     "list": ("app.routes.v5.api.main.setting.list", "get_setting_list"),
    #     "save": ("app.routes.v5.api.main.setting.save", "save_setting"),
    #     "delete": ("app.routes.v5.api.main.setting.delete", "delete_setting"),
    #     "duplicate": ("app.routes.v5.api.main.setting.duplicate", "duplicate_setting"),
    #     "draft": ("app.routes.v5.api.main.setting.draft", "patch_setting_draft"),
    #     "docs": ("app.routes.v5.api.main.setting.docs", "get_settings_docs"),
    # },
    "simulation": {
        "get": ("app.routes.v5.api.main.simulation.get", "get_simulation"),
        "list": ("app.routes.v5.api.main.simulation.list", "get_simulation_list"),
        "save": ("app.routes.v5.api.main.simulation.save", "save_simulation"),
        "delete": ("app.routes.v5.api.main.simulation.delete", "delete_simulation"),
        "duplicate": (
            "app.routes.v5.api.main.simulation.duplicate",
            "duplicate_simulation",
        ),
        "draft": ("app.routes.v5.api.main.simulation.draft", "patch_simulation_draft"),
        "docs": ("app.routes.v5.api.main.simulation.docs", "get_simulations_docs"),
    },
    # "test": {
    #     "get": ("app.routes.v5.api.main.test.get", "get_test_artifact"),
    #     "docs": ("app.routes.v5.api.main.test.docs", "get_tests_docs"),
    # },
    # "tool": {
    #     "get": ("app.routes.v5.api.main.tool.get", "get_tool"),
    #     "list": ("app.routes.v5.api.main.tool.list", "get_tool_list"),
    #     "save": ("app.routes.v5.api.main.tool.save", "save_tool"),
    #     "delete": ("app.routes.v5.api.main.tool.delete", "delete_tool"),
    #     "duplicate": ("app.routes.v5.api.main.tool.duplicate", "duplicate_tool"),
    #     "draft": ("app.routes.v5.api.main.tool.draft", "patch_tool_draft"),
    #     "docs": ("app.routes.v5.api.main.tool.docs", "get_tools_docs"),
    # },
    "chat": {
        "get": ("app.routes.v5.api.main.chat.get", "chat_bundle_get"),
        "list": ("app.routes.v5.api.main.chat.list", "chat_get"),
        "draft": ("app.routes.v5.api.main.chat.draft", "patch_chat_draft"),
        "refresh": ("app.routes.v5.api.main.chat.refresh", "chat_refresh"),
        "docs": ("app.routes.v5.api.main.chat.docs", "get_chat_docs_static"),
    },
}

# ============================================================================
# Resource Registry — 75 resources
# ============================================================================
# Resources follow a regular naming pattern: get_{name}, search_{name},
# create_{name}, get_{name}_docs. Built from explicit name lists.

_ALL_RESOURCES = [
    "agents",
    "arg_positions",
    "args",
    "args_outputs",
    "auth_item_keys",
    "auths",
    "cohorts",
    "colors",
    "conditional_parameters",
    "departments",
    "descriptions",
    "documents",
    "emails",
    "endpoints",
    "entries",
    "evals",
    "examples",
    "fields",
    "flags",
    "group_positions",
    "group_rubrics",
    "groups",
    "icons",
    "images",
    "instructions",
    "items",
    "keys",
    "modalities",
    "models",
    "names",
    "objectives",
    "operations",
    "options",
    "parameter_fields",
    "parameters",
    "personas",
    "points",
    "pricing",
    "problem_statements",
    "profiles",
    "prompts",
    "protocols",
    "provider_keys",
    "providers",
    "qualities",
    "questions",
    "reasoning_levels",
    "request_limits",
    "resources",
    "roles",
    "rubrics",
    "run_positions",
    "run_rubrics",
    "runs",
    "scenario_flags",
    "scenario_positions",
    "scenario_rubrics",
    "scenario_time_limits",
    "scenarios",
    "settings",
    "simulation_positions",
    "simulations",
    "slugs",
    "standard_groups",
    "standards",
    "temperature_levels",
    "texts",
    "thresholds",
    "tools",
    "uploads",
    "values",
    "videos",
    "voices",
]

_RESOURCES_WITH_CREATE = {
    "arg_positions",
    "args",
    "args_outputs",
    "auth_item_keys",
    "colors",
    "descriptions",
    "emails",
    "endpoints",
    "examples",
    "group_positions",
    "group_rubrics",
    "images",
    "instructions",
    "items",
    "keys",
    "names",
    "objectives",
    "options",
    "parameter_fields",
    "points",
    "pricing",
    "problem_statements",
    "prompts",
    "protocols",
    "provider_keys",
    "questions",
    "request_limits",
    "run_positions",
    "run_rubrics",
    "scenario_positions",
    "scenario_rubrics",
    "scenario_time_limits",
    "simulation_positions",
    "slugs",
    "standard_groups",
    "texts",
    "uploads",
    "values",
    "videos",
    "voices",
}

RESOURCE_REGISTRY: dict[str, dict[str, tuple[str, str]]] = {}
for _name in _ALL_RESOURCES:
    _entry: dict[str, tuple[str, str]] = {
        "get": (f"app.routes.v5.api.resources.{_name}.get", f"get_{_name}"),
        "search": (f"app.routes.v5.api.resources.{_name}.search", f"search_{_name}"),
        "docs": (f"app.routes.v5.api.resources.{_name}.docs", f"get_{_name}_docs"),
    }
    if _name in _RESOURCES_WITH_CREATE:
        _entry["create"] = (
            f"app.routes.v5.api.resources.{_name}.create",
            f"create_{_name}",
        )
    RESOURCE_REGISTRY[_name] = _entry

# ============================================================================
# Entry Registry — 101 entries
# ============================================================================
# Entries follow a regular naming pattern: get_{name}_entries, search_{name}_entries,
# create_{name}_entry. Built from explicit name list (excludes 'chat' which has
# no router endpoints).

_ALL_ENTRIES = [
    "activity",
    "activity_insights",
    "agent_drafts",
    "args_outputs_values",
    "args_values",
    "attempt",
    "attempt_analysis",
    "attempt_archive",
    "attempt_chat",
    "attempt_completion",
    "attempt_content",
    "attempt_feedback",
    "attempt_grade",
    "attempt_highlight",
    "attempt_hint",
    "attempt_improvement",
    "attempt_insights",
    "attempt_message",
    "attempt_message_tree",
    "attempt_replacement",
    "attempt_strength",
    "audios",
    "audits",
    "auth_drafts",
    "benchmark",
    "benchmark_insights",
    "calls",
    "certificates",
    "cohort_drafts",
    "conversations",
    "conversations_completions",
    "dashboard_insights",
    "debug_info",
    "department_drafts",
    "document_drafts",
    "emulations",
    "eval_drafts",
    "field_drafts",
    "grants",
    "groups",
    "health",
    "health_insights",
    "highlights",
    "home",
    "home_insights",
    "home_training",
    "images",
    "leaderboard_insights",
    "logins",
    "messages",
    "messages_completions",
    "metrics",
    "model_drafts",
    "attempt_mutes",
    "parameter_drafts",
    "persona",
    "persona_drafts",
    "practice",
    "practice_insights",
    "practice_training",
    "pricing_insights",
    "problems",
    "profile_drafts",
    "provider_drafts",
    "record_insights",
    "replacements",
    "reports",
    "reports_insights",
    "resolves",
    "attempt_responses",
    "rubric_drafts",
    "run_pricing",
    "runs",
    "scenario_drafts",
    "sessions",
    "setting_drafts",
    "simulation_drafts",
    "suite",
    "suite_department",
    "suite_drafts",
    "test",
    "test_archive",
    "test_completion",
    "test_feedback",
    "test_grade",
    "test_insights",
    "test_invocation",
    "test_stop",
    "tests",
    "texts",
    "tokens",
    "tool_drafts",
    "training",
    "training_department",
    "training_drafts",
    "uploads",
    "uploads_completions",
    "videos",
]

_ENTRIES_WITH_CREATE_ROUTE = {
    "problems",
    "resolves",
    "attempt_archive",
    "test_archive",
    "uploads",
}

ENTRY_REGISTRY: dict[str, dict[str, tuple[str, str]]] = {}
for _name in _ALL_ENTRIES:
    _entry: dict[str, tuple[str, str]] = {
        "get": (f"app.routes.v5.api.entries.{_name}.get", f"get_{_name}_entries"),
        "search": (
            f"app.routes.v5.api.entries.{_name}.search",
            f"search_{_name}_entries",
        ),
    }
    if _name in _ENTRIES_WITH_CREATE_ROUTE:
        _entry["create"] = (
            f"app.routes.v5.api.entries.{_name}.create",
            f"create_{_name}_entry",
        )
    ENTRY_REGISTRY[_name] = _entry

# ============================================================================
# Derived Lists
# ============================================================================

ARTIFACTS = sorted(ARTIFACT_REGISTRY.keys())
RESOURCES = sorted(RESOURCE_REGISTRY.keys())
ENTRIES = sorted(ENTRY_REGISTRY.keys())
ALL_ITEMS = ARTIFACTS + RESOURCES + ENTRIES

# ============================================================================
# Helper Functions
# ============================================================================


def pluralize_artifact(artifact_name: str) -> str:
    """Pluralize artifact name.

    Args:
        artifact_name: Singular artifact name (e.g., "agent", "persona")

    Returns:
        Pluralized artifact name (e.g., "agents", "personas")
    """
    if artifact_name.endswith("y"):
        return artifact_name[:-1] + "ies"
    elif artifact_name.endswith(("s", "x", "z", "ch", "sh")):
        return artifact_name + "es"
    else:
        return artifact_name + "s"


def _suggest_item_name(name: str) -> str | None:
    """Suggest the correct artifact/resource/entry name based on common mistakes."""
    if name in ALL_ITEMS:
        return None

    plural_to_singular = {pluralize_artifact(a): a for a in ARTIFACTS}
    if name in plural_to_singular:
        return plural_to_singular[name]

    if name.endswith("s") and name[:-1] in ARTIFACTS:
        return name[:-1]

    if f"{name}s" in RESOURCES:
        return f"{name}s"

    # Check entries (try with/without _entries suffix, singular/plural)
    if name in ENTRY_REGISTRY:
        return name

    return None


def _resolve_related_names(name: str) -> dict[str, str]:
    """Resolve a name to all related registry keys across artifact/resource/entry.

    Given any form (singular or plural), finds the canonical key in each
    registry where the concept exists.

    Returns:
        Dict mapping registry label → registry key, e.g.
        {"artifact": "scenario", "resource": "scenarios"}
    """
    result: dict[str, str] = {}

    # Direct matches
    if name in ARTIFACT_REGISTRY:
        result["artifact"] = name
    if name in RESOURCE_REGISTRY:
        result["resource"] = name
    if name in ENTRY_REGISTRY:
        result["entry"] = name

    # Singular → plural: check resource registry with pluralized form
    if "resource" not in result and name in ARTIFACT_REGISTRY:
        plural = pluralize_artifact(name)
        if plural in RESOURCE_REGISTRY:
            result["resource"] = plural

    # Plural → singular: check artifact registry with de-pluralized form
    if "artifact" not in result:
        singular = None
        _plural_to_singular = {pluralize_artifact(a): a for a in ARTIFACTS}
        if name in _plural_to_singular:
            singular = _plural_to_singular[name]
        elif name.endswith("s") and name[:-1] in ARTIFACT_REGISTRY:
            singular = name[:-1]
        if singular:
            result["artifact"] = singular

    # Singular → plural: check entry registry
    if "entry" not in result:
        plural = pluralize_artifact(name)
        if plural in ENTRY_REGISTRY:
            result["entry"] = plural

    # Plural → singular: check entry registry
    if "entry" not in result:
        if name.endswith("s") and name[:-1] in ENTRY_REGISTRY:
            result["entry"] = name[:-1]
        _plural_to_singular = {pluralize_artifact(a): a for a in ARTIFACTS}
        if name in _plural_to_singular and _plural_to_singular[name] in ENTRY_REGISTRY:
            result["entry"] = _plural_to_singular[name]

    # Resource plural → entry (e.g., "groups" resource, "groups" entry)
    # Already handled by direct match above

    return result


def is_artifact(name: str) -> bool:
    """Check if name is an artifact."""
    return name in ARTIFACT_REGISTRY


def is_resource(name: str) -> bool:
    """Check if name is a resource."""
    return name in RESOURCE_REGISTRY


def is_entry(name: str) -> bool:
    """Check if name is an entry."""
    return name in ENTRY_REGISTRY


def get_available_operations(name: str) -> list[str]:
    """Get list of available operations for an item."""
    if name in ARTIFACT_REGISTRY:
        return list(ARTIFACT_REGISTRY[name].keys())
    if name in RESOURCE_REGISTRY:
        return list(RESOURCE_REGISTRY[name].keys())
    if name in ENTRY_REGISTRY:
        return list(ENTRY_REGISTRY[name].keys())
    return []


def get_artifact_description(artifact_name: str) -> str:
    """Get artifact description from handler docstring."""
    if artifact_name in ARTIFACT_REGISTRY and "get" in ARTIFACT_REGISTRY[artifact_name]:
        try:
            handler = _get_handler(*ARTIFACT_REGISTRY[artifact_name]["get"])
            doc = getattr(handler, "__doc__", None)
            if doc and isinstance(doc, str):
                parts = doc.split(".")
                if parts:
                    return parts[0].strip()
        except Exception:
            pass
    return f"{artifact_name.title()} artifact"


def get_resource_description(resource_name: str) -> str:
    """Get resource description from handler docstring."""
    if resource_name in RESOURCE_REGISTRY:
        # Try create handler first, then get handler
        for op in ("create", "get"):
            if op in RESOURCE_REGISTRY[resource_name]:
                try:
                    handler = _get_handler(*RESOURCE_REGISTRY[resource_name][op])
                    doc = getattr(handler, "__doc__", None)
                    if doc and isinstance(doc, str):
                        parts = doc.split(".")
                        if parts:
                            return parts[0].strip()
                except Exception:
                    pass
    return f"{resource_name.title()} resource"


def get_entry_description(entry_name: str) -> str:
    """Get entry description from handler docstring."""
    if entry_name in ENTRY_REGISTRY:
        # Try create handler first, then get handler
        for op in ("create", "get"):
            if op in ENTRY_REGISTRY[entry_name]:
                try:
                    handler = _get_handler(*ENTRY_REGISTRY[entry_name][op])
                    doc = getattr(handler, "__doc__", None)
                    if doc and isinstance(doc, str):
                        parts = doc.split(".")
                        if parts:
                            return parts[0].strip()
                except Exception:
                    pass
    return f"{entry_name.replace('_', ' ').title()} entry"


def get_request_model_from_handler(handler: Any) -> Any | None:
    """Extract request model from handler function annotations."""
    try:
        sig = inspect.signature(handler)
        params = list(sig.parameters.values())
        if params and len(params) > 0:
            first_param = params[0]
            if first_param.annotation != inspect.Parameter.empty:
                return first_param.annotation
    except Exception:
        pass
    return None


def get_payload_schema(name: str, operation: str = "get") -> dict[str, Any]:
    """Get payload schema for artifact/resource/entry operations.

    Note: The 'mcp' field is automatically filtered out as it's auto-injected.
    """
    # Find handler in registries
    handler: Any | None = None
    if name in ARTIFACT_REGISTRY and operation in ARTIFACT_REGISTRY[name]:
        handler = _get_handler(*ARTIFACT_REGISTRY[name][operation])
    elif name in RESOURCE_REGISTRY and operation in RESOURCE_REGISTRY[name]:
        handler = _get_handler(*RESOURCE_REGISTRY[name][operation])
    elif name in ENTRY_REGISTRY and operation in ENTRY_REGISTRY[name]:
        handler = _get_handler(*ENTRY_REGISTRY[name][operation])
    else:
        suggestion = _suggest_item_name(name)
        response: dict[str, Any] = {
            "error": f"'{name}' is not a valid item or operation '{operation}' not available."
        }
        if suggestion:
            response["suggestion"] = suggestion
        return response

    if handler:
        try:
            request_type = get_request_model_from_handler(handler)
            if request_type and hasattr(request_type, "model_json_schema"):
                schema: dict[str, Any] = request_type.model_json_schema()  # type: ignore[assignment]
                # Filter out 'mcp' field
                if "properties" in schema and "mcp" in schema["properties"]:
                    schema = schema.copy()
                    schema["properties"] = schema["properties"].copy()
                    del schema["properties"]["mcp"]
                    if "required" in schema and "mcp" in schema["required"]:
                        schema["required"] = [
                            r for r in schema["required"] if r != "mcp"
                        ]
                return schema
        except Exception:
            pass

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


def format_example_payload(artifact_name: str, operation: str) -> str:
    """Format example payload for documentation."""
    artifact_id_field = f"{artifact_name}_id"
    examples = {
        "get": f'{{"{artifact_id_field}": "123e4567-e89b-12d3-a456-426614174000"}}',
        "save": f'{{"name": "My {artifact_name.title()}", "description": "...", ...}}',
        "list": "{}",
        "duplicate": f'{{"{artifact_id_field}": "123e4567-e89b-12d3-a456-426614174000", "name": "Copy"}}',
        "delete": f'{{"{artifact_id_field}": "123e4567-e89b-12d3-a456-426614174000"}}',
        "draft": f'{{"name": "Draft {artifact_name.title()}", ...}}',
    }
    return examples.get(operation, "{}")


# ============================================================================
# Handler Call Functions
# ============================================================================


async def call_handler(
    name: str, operation: str, payload: dict[str, Any]
) -> dict[str, Any]:
    """Call an artifact handler function with the given payload.

    profile_id is automatically extracted from MCP request context.
    """
    from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

    profile_id = get_mcp_profile_id()

    if name not in ARTIFACT_REGISTRY:
        suggestion = _suggest_item_name(name)
        return {
            "error": f"'{name}' does not have handlers implemented yet.",
            "status": "not_implemented",
            "available_artifacts": ARTIFACTS,
            "note": f"Available artifacts: {', '.join(ARTIFACTS)}",
            **({"suggestion": suggestion} if suggestion else {}),
        }

    ops = ARTIFACT_REGISTRY[name]
    if operation not in ops:
        available_operations = list(ops.keys())
        return {
            "error": f"Operation '{operation}' not available for '{name}'.",
            "status": "not_implemented",
            "available_operations": available_operations,
            "note": f"Available operations for '{name}': {', '.join(available_operations)}",
        }

    handler = _get_handler(*ops[operation])
    return await call_endpoint_handler(handler, payload, profile_id)


async def call_endpoint_handler(
    handler: Any,
    payload: dict[str, Any],
    profile_id: str,
) -> dict[str, Any]:
    """Call an endpoint handler with proper Request/Response/DB context."""
    from starlette.requests import Request as StarletteRequest

    from app.infra.globals import get_db

    try:
        request_model = get_request_model_from_handler(handler)
        if not request_model:
            return {
                "error": "Could not determine request model from handler",
                "status": "error",
            }

        scope = {
            "type": "http",
            "method": "POST",
            "path": "/api/v5/mcp",
            "headers": [],
            "query_string": b"",
            "server": ("localhost", 8000),
        }
        http_request = StarletteRequest(scope)
        http_request.state.profile_id = profile_id
        http_request.state.mcp = True
        http_response = Response()

        # Auto-inject mcp: true if request model has mcp field
        if (
            hasattr(request_model, "model_fields")
            and "mcp" in request_model.model_fields
        ):
            payload = {**payload, "mcp": True}

        async for conn in get_db():
            api_request = request_model(**payload)
            result = await handler(
                request=api_request,
                http_request=http_request,
                response=http_response,
                conn=conn,
            )
            if hasattr(result, "model_dump"):
                result_dict = result.model_dump(mode="json")
                return cast(dict[str, Any], result_dict)
            elif hasattr(result, "dict"):
                result_dict = result.dict()
                return cast(dict[str, Any], result_dict)
            else:
                return cast(dict[str, Any], {"data": result})

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


# ============================================================================
# MCP Tool Registration
# ============================================================================


def register_endpoints(server: FastMCP) -> None:
    """Register all MCP endpoints — 30 native-feeling tools."""

    # ==================================================================
    # Category 1: Top-Level Analytical / Special Tools (12 tools)
    # ==================================================================

    @server.tool()
    async def dashboard(
        start_date: str | None = None,
        end_date: str | None = None,
        cohort_ids: list[str] | None = None,
        simulation_ids: list[str] | None = None,
        department_ids: list[str] | None = None,
        roles: list[str] | None = None,
        simulation_filters: list[str] | None = None,
        target_profile_id: str | None = None,
        page_limit: int | None = None,
        page_offset: int | None = None,
        kwargs: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Get the dashboard with key metrics, charts, and summaries.

        Args:
            start_date: Start date filter (YYYY-MM-DD).
            end_date: End date filter (YYYY-MM-DD).
            cohort_ids: Filter by cohort IDs.
            simulation_ids: Filter by simulation IDs.
            department_ids: Filter by department IDs.
            roles: Filter by roles.
            simulation_filters: Additional simulation filter values.
            target_profile_id: View dashboard for a specific profile.
            page_limit: Number of results per page.
            page_offset: Pagination offset.
            kwargs: Additional parameters — use docs("dashboard") for full schema.
        """
        payload = {
            k: v
            for k, v in {
                "start_date": start_date,
                "end_date": end_date,
                "cohort_ids": cohort_ids,
                "simulation_ids": simulation_ids,
                "department_ids": department_ids,
                "roles": roles,
                "simulation_filters": simulation_filters,
                "target_profile_id": target_profile_id,
                "page_limit": page_limit,
                "page_offset": page_offset,
            }.items()
            if v is not None
        }
        if kwargs:
            payload.update(kwargs)
        return await call_handler("dashboard", "get", payload)

    # --- activity tool temporarily commented out ---
    # @server.tool()
    # async def activity(...) -> dict[str, Any]:
    #     """Get activity analytics — session counts, durations, and trends."""
    #     ...

    @server.tool()
    async def pricing(
        start_date: str | None = None,
        end_date: str | None = None,
        model_id: str | None = None,
        agent_id: str | None = None,
        page_limit: int | None = None,
        page_offset: int | None = None,
        kwargs: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Get pricing analytics — token costs, model usage, and spending trends.

        Args:
            start_date: Start date filter (YYYY-MM-DD).
            end_date: End date filter (YYYY-MM-DD).
            model_id: Filter by specific model.
            agent_id: Filter by specific agent.
            page_limit: Number of results per page.
            page_offset: Pagination offset.
            kwargs: Additional parameters — use docs("pricing") for full schema.
        """
        payload = {
            k: v
            for k, v in {
                "start_date": start_date,
                "end_date": end_date,
                "model_id": model_id,
                "agent_id": agent_id,
                "page_limit": page_limit,
                "page_offset": page_offset,
            }.items()
            if v is not None
        }
        if kwargs:
            payload.update(kwargs)
        return await call_handler("pricing", "get", payload)

    @server.tool()
    async def reports(
        start_date: str | None = None,
        end_date: str | None = None,
        cohort_ids: list[str] | None = None,
        simulation_ids: list[str] | None = None,
        department_ids: list[str] | None = None,
        roles: list[str] | None = None,
        target_profile_id: str | None = None,
        search: str | None = None,
        sort_by: str | None = None,
        sort_order: str | None = None,
        page_limit: int | None = None,
        page_offset: int | None = None,
        kwargs: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Get reports — detailed performance data, scores, and analytics per learner.

        Args:
            start_date: Start date filter (YYYY-MM-DD).
            end_date: End date filter (YYYY-MM-DD).
            cohort_ids: Filter by cohort IDs.
            simulation_ids: Filter by simulation IDs.
            department_ids: Filter by department IDs.
            roles: Filter by roles.
            target_profile_id: View report for a specific profile.
            search: Search query string.
            sort_by: Column to sort by.
            sort_order: Sort direction ("asc" or "desc").
            page_limit: Number of results per page.
            page_offset: Pagination offset.
            kwargs: Additional parameters — use docs("reports") for full schema.
        """
        payload = {
            k: v
            for k, v in {
                "start_date": start_date,
                "end_date": end_date,
                "cohort_ids": cohort_ids,
                "simulation_ids": simulation_ids,
                "department_ids": department_ids,
                "roles": roles,
                "target_profile_id": target_profile_id,
                "search": search,
                "sort_by": sort_by,
                "sort_order": sort_order,
                "page_limit": page_limit,
                "page_offset": page_offset,
            }.items()
            if v is not None
        }
        if kwargs:
            payload.update(kwargs)
        return await call_handler("reports", "get", payload)

    # --- health tool temporarily commented out ---
    # @server.tool()
    # async def health(...) -> dict[str, Any]:
    #     """Get system health metrics — uptime, error rates, and service status."""
    #     ...

    @server.tool()
    async def leaderboard(
        start_date: str | None = None,
        end_date: str | None = None,
        cohort_ids: list[str] | None = None,
        simulation_ids: list[str] | None = None,
        department_ids: list[str] | None = None,
        roles: list[str] | None = None,
        target_profile_id: str | None = None,
        search: str | None = None,
        sort_by: str | None = None,
        sort_order: str | None = None,
        page_limit: int | None = None,
        page_offset: int | None = None,
        kwargs: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Get leaderboard rankings — top performers by score, completion, and streaks.

        Args:
            start_date: Start date filter (YYYY-MM-DD).
            end_date: End date filter (YYYY-MM-DD).
            cohort_ids: Filter by cohort IDs.
            simulation_ids: Filter by simulation IDs.
            department_ids: Filter by department IDs.
            roles: Filter by roles.
            target_profile_id: View ranking for a specific profile.
            search: Search query string.
            sort_by: Column to sort by.
            sort_order: Sort direction ("asc" or "desc").
            page_limit: Number of results per page.
            page_offset: Pagination offset.
            kwargs: Additional parameters — use docs("leaderboard") for full schema.
        """
        payload = {
            k: v
            for k, v in {
                "start_date": start_date,
                "end_date": end_date,
                "cohort_ids": cohort_ids,
                "simulation_ids": simulation_ids,
                "department_ids": department_ids,
                "roles": roles,
                "target_profile_id": target_profile_id,
                "search": search,
                "sort_by": sort_by,
                "sort_order": sort_order,
                "page_limit": page_limit,
                "page_offset": page_offset,
            }.items()
            if v is not None
        }
        if kwargs:
            payload.update(kwargs)
        return await call_handler("leaderboard", "get", payload)

    # --- benchmark tool temporarily commented out ---
    # @server.tool()
    # async def benchmark(...) -> dict[str, Any]:
    #     """Get benchmark analytics — evaluation results and agent performance comparisons."""
    #     ...

    @server.tool()
    async def chat(
        chat_entry_id: str | None = None,
        draft_id: str | None = None,
    ) -> dict[str, Any]:
        """Get chat data — conversation messages for a training session or draft.

        Args:
            chat_entry_id: Training entry ID to fetch chat for.
            draft_id: Draft ID to fetch chat for.
        """
        payload = {
            k: v
            for k, v in {
                "chat_entry_id": chat_entry_id,
                "draft_id": draft_id,
            }.items()
            if v is not None
        }
        return await call_handler("chat", "get", payload)

    @server.tool()
    async def attempt(
        attempt_id: str,
    ) -> dict[str, Any]:
        """Get a single attempt — detailed results for one training attempt.

        Args:
            attempt_id: The attempt ID to fetch.
        """
        return await call_handler("attempt", "get", {"attempt_id": attempt_id})

    # --- session tool temporarily commented out (activity section) ---
    # @server.tool()
    # async def session(session_id: str, ...) -> dict[str, Any]:
    #     """Get a session — full session details with audit log."""
    #     ...

    @server.tool()
    async def group(
        group_id: str,
    ) -> dict[str, Any]:
        """Get a group — group details and members.

        Args:
            group_id: The group ID to fetch.
        """
        return await call_handler("group", "get", {"group_id": group_id})

    # --- invocation tool temporarily commented out ---
    # @server.tool()
    # async def invocation(test_id: str) -> dict[str, Any]:
    #     """Get a test invocation — detailed test execution results."""
    #     ...

    # ==================================================================
    # Category 2: CRUD Artifact Tools (6 tools)
    # ==================================================================

    _CRUD_ARTIFACTS = [
        # "agent",  # temporarily removed (intelligence)
        # "auth",  # temporarily removed
        "cohort",
        # "department",  # temporarily removed
        # "document",  # temporarily removed
        # "eval",  # temporarily removed
        # "field",  # temporarily removed
        # "model",  # temporarily removed
        # "parameter",  # temporarily removed
        "persona",
        # "profile",  # temporarily removed
        # "provider",  # temporarily removed
        # "rubric",  # temporarily removed
        "scenario",
        # "setting",  # temporarily removed
        "simulation",
        # "tool",  # temporarily removed
    ]

    @server.tool(
        description=(
            "Call this FIRST before creating or editing any artifact. "
            "Returns group_id (pass to create_resource), per-resource tool_id "
            "(pass to create_resource when available), and available resources "
            "to reuse (names, descriptions, personas, departments, flags, etc.). "
            "For a new artifact, call with no artifact_id. "
            "For an existing artifact, pass the artifact_id to get its current state."
        ),
    )
    async def get_artifact(
        artifact: str,
        artifact_id: str | None = None,
        draft_id: str | None = None,
        kwargs: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Get an artifact — call this first to load resources and context.

        Args:
            artifact: Artifact type — one of: agent, auth, cohort, department,
                document, eval, field, model, parameter, persona, profile,
                provider, rubric, scenario, setting, simulation, tool.
            artifact_id: The artifact's UUID. Omit for new artifact mode.
            draft_id: Optional draft ID to fetch draft version.
            kwargs: Additional parameters — use docs(artifact) for full schema.
        """
        payload: dict[str, Any] = {}
        if artifact_id is not None:
            payload[f"{artifact}_id"] = artifact_id
        if draft_id is not None:
            payload["draft_id"] = draft_id
        if kwargs:
            payload.update(kwargs)
        return await call_handler(artifact, "get", payload)

    @server.tool()
    async def list_artifact(
        artifact: str,
        kwargs: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """List artifacts with optional filters.

        Args:
            artifact: Artifact type — one of: agent, auth, cohort, department,
                document, eval, field, model, parameter, persona, profile,
                provider, rubric, scenario, setting, simulation, tool.
            kwargs: Filter/pagination parameters — use docs(artifact) for full schema.
        """
        payload: dict[str, Any] = kwargs or {}
        return await call_handler(artifact, "list", payload)

    @server.tool(
        description=(
            "Direct save (create or update) — use when the user wants to skip "
            "the draft review step. Include ALL resource IDs in the payload, not "
            "just changed ones. After saving, share the artifact link with the "
            f"user: {ORIGIN}/training/{{artifact}}s/{{artifact_id}}"
        ),
    )
    async def save_artifact(
        artifact: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """Save (create or update) an artifact directly.

        Args:
            artifact: Artifact type — one of: agent, auth, cohort, department,
                document, eval, field, model, parameter, persona, profile,
                provider, rubric, scenario, setting, simulation, tool.
            payload: Full save payload — use docs(artifact) for schema.
                Include ALL resource IDs, not just changed ones.
        """
        return await call_handler(artifact, "save", payload)

    @server.tool()
    async def delete_artifact(
        artifact: str,
        artifact_id: str,
    ) -> dict[str, Any]:
        """Delete an artifact.

        Args:
            artifact: Artifact type — one of: agent, auth, cohort, department,
                document, eval, field, model, parameter, persona, profile,
                provider, rubric, scenario, setting, simulation, tool.
            artifact_id: The artifact's UUID to delete.
        """
        return await call_handler(artifact, "delete", {f"{artifact}_id": artifact_id})

    @server.tool()
    async def duplicate_artifact(
        artifact: str,
        artifact_id: str,
        name: str | None = None,
    ) -> dict[str, Any]:
        """Duplicate an artifact.

        Args:
            artifact: Artifact type — one of: agent, auth, cohort, department,
                document, eval, field, model, parameter, persona, profile,
                provider, rubric, scenario, setting, simulation, tool.
            artifact_id: The artifact's UUID to duplicate.
            name: Optional name for the duplicate.
        """
        payload: dict[str, Any] = {f"{artifact}_id": artifact_id}
        if name is not None:
            payload["name"] = name
        return await call_handler(artifact, "duplicate", payload)

    @server.tool(
        description=(
            "Recommended way to create or edit an artifact. Creates a draft the "
            "user can review and edit in the UI before committing. Returns a "
            "draft_id. Share the draft link with the user: "
            f"{ORIGIN}/training/{{artifact}}s/new?draftId={{draft_id}}"
        ),
    )
    async def draft_artifact(
        artifact: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """Create or update a draft artifact (autosave).

        Args:
            artifact: Artifact type — one of: agent, auth, cohort, department,
                document, eval, field, model, parameter, persona, profile,
                provider, rubric, scenario, setting, simulation, tool.
            payload: Full draft payload — use docs(artifact) for schema.
        """
        return await call_handler(artifact, "draft", payload)

    # ==================================================================
    # Category 3: Resource Tools (3 tools)
    # ==================================================================

    @server.tool()
    async def get_resource(
        resource: str,
        ids: list[str],
    ) -> dict[str, Any]:
        """Get resources by IDs.

        Args:
            resource: Resource name (e.g., "names", "descriptions", "models", "prompts").
                Use discover_resources() to see all available resources.
            ids: List of resource UUIDs to fetch.
        """
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        profile_id = get_mcp_profile_id()

        if resource not in RESOURCE_REGISTRY:
            suggestion = _suggest_item_name(resource)
            result: dict[str, Any] = {"error": f"'{resource}' is not a valid resource."}
            if suggestion:
                result["suggestion"] = suggestion
            return result

        handler = _get_handler(*RESOURCE_REGISTRY[resource]["get"])

        # Auto-detect ids vs p_ids field name
        request_model = get_request_model_from_handler(handler)
        if (
            request_model
            and hasattr(request_model, "model_fields")
            and "p_ids" in request_model.model_fields
        ):
            payload: dict[str, Any] = {"p_ids": ids}
        else:
            payload = {"ids": ids}

        return await call_endpoint_handler(handler, payload, profile_id)

    @server.tool()
    async def search_resource(
        resource: str,
        query: str | None = None,
        limit: int = 20,
        offset: int = 0,
        kwargs: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Search resources by text query.

        Args:
            resource: Resource name (e.g., "names", "descriptions", "models").
                Use discover_resources() to see all available resources.
            query: Search text.
            limit: Max results to return (default 20).
            offset: Pagination offset (default 0).
            kwargs: Additional parameters — use docs(resource) for full schema.
        """
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        profile_id = get_mcp_profile_id()

        if resource not in RESOURCE_REGISTRY:
            suggestion = _suggest_item_name(resource)
            result: dict[str, Any] = {"error": f"'{resource}' is not a valid resource."}
            if suggestion:
                result["suggestion"] = suggestion
            return result

        payload: dict[str, Any] = {
            "limit_count": limit,
            "offset_count": offset,
        }
        if query is not None:
            payload["search"] = query
        if kwargs:
            payload.update(kwargs)

        handler = _get_handler(*RESOURCE_REGISTRY[resource]["search"])
        return await call_endpoint_handler(handler, payload, profile_id)

    @server.tool(
        description=(
            "Create a new resource. Pass group_id from the get_artifact() response "
            "so the resource is grouped with the current artifact context. "
            "Optionally pass tool_id if get_artifact() returned one for this "
            "resource type. Reuse existing resources from get_artifact() when "
            "possible — only create what's new."
        ),
    )
    async def create_resource(
        resource: str,
        payload: dict[str, Any],
        group_id: str | None = None,
        tool_id: str | None = None,
    ) -> dict[str, Any]:
        """Create a new resource.

        Args:
            resource: Resource name (e.g., "names", "descriptions", "flags").
                Use discover_resources() to see all available resources.
            payload: Full create payload — use docs(resource) for schema.
            group_id: Group ID from get_artifact() response.
            tool_id: Tool ID from get_artifact() response (if available for this resource type).
        """
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        profile_id = get_mcp_profile_id()

        if resource not in RESOURCE_REGISTRY:
            return {"error": f"'{resource}' is not a valid resource."}

        if "create" not in RESOURCE_REGISTRY[resource]:
            return {"error": f"Resource '{resource}' does not support create."}

        if group_id is not None or tool_id is not None:
            payload = {**payload}
            if group_id is not None:
                payload["group_id"] = group_id
            if tool_id is not None:
                payload["tool_id"] = tool_id

        handler = _get_handler(*RESOURCE_REGISTRY[resource]["create"])
        return await call_endpoint_handler(handler, payload, profile_id)

    # ==================================================================
    # Category 4: Entry Tools (3 tools)
    # ==================================================================

    @server.tool()
    async def get_entry(
        entry: str,
        ids: list[str] | None = None,
        kwargs: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Get entry data.

        Args:
            entry: Entry name (e.g., "activity", "attempt", "training", "sessions").
                Use discover_entries() to see all available entries.
            ids: Optional list of entry IDs.
            kwargs: Additional parameters — use docs(entry) for full schema.
        """
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        profile_id = get_mcp_profile_id()

        if entry not in ENTRY_REGISTRY:
            suggestion = _suggest_item_name(entry)
            result: dict[str, Any] = {"error": f"'{entry}' is not a valid entry."}
            if suggestion:
                result["suggestion"] = suggestion
            return result

        payload: dict[str, Any] = {}
        if ids is not None:
            payload["ids"] = ids
        if kwargs:
            payload.update(kwargs)

        handler = _get_handler(*ENTRY_REGISTRY[entry]["get"])
        return await call_endpoint_handler(handler, payload, profile_id)

    @server.tool()
    async def search_entry(
        entry: str,
        query: str | None = None,
        limit: int = 20,
        offset: int = 0,
        kwargs: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Search entries by text query.

        Args:
            entry: Entry name (e.g., "activity", "attempt", "training").
                Use discover_entries() to see all available entries.
            query: Search text.
            limit: Max results to return (default 20).
            offset: Pagination offset (default 0).
            kwargs: Additional parameters — use docs(entry) for full schema.
        """
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        profile_id = get_mcp_profile_id()

        if entry not in ENTRY_REGISTRY:
            suggestion = _suggest_item_name(entry)
            result: dict[str, Any] = {"error": f"'{entry}' is not a valid entry."}
            if suggestion:
                result["suggestion"] = suggestion
            return result

        payload: dict[str, Any] = {
            "limit_count": limit,
            "offset_count": offset,
        }
        if query is not None:
            payload["search"] = query
        if kwargs:
            payload.update(kwargs)

        handler = _get_handler(*ENTRY_REGISTRY[entry]["search"])
        return await call_endpoint_handler(handler, payload, profile_id)

    @server.tool()
    async def create_entry(
        entry: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """Create a new entry.

        Args:
            entry: Entry name (e.g., "activity", "attempt", "training").
                Use discover_entries() to see all available entries.
            payload: Full create payload — use docs(entry) for schema.
        """
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        profile_id = get_mcp_profile_id()

        if entry not in ENTRY_REGISTRY:
            return {"error": f"'{entry}' is not a valid entry."}

        if "create" not in ENTRY_REGISTRY[entry]:
            return {"error": f"Entry '{entry}' does not support create."}

        handler = _get_handler(*ENTRY_REGISTRY[entry]["create"])
        return await call_endpoint_handler(handler, payload, profile_id)

    # ==================================================================
    # Category 5: Utility Tools (5 tools)
    # ==================================================================

    @server.tool()
    def docs(name: str) -> dict[str, Any]:
        """Get documentation for any artifact, resource, or entry — or pass "glow" for general docs.

        Smart name resolution: "scenario" and "scenarios" both return the same
        merged docs from artifact + resource registries. Works with singular or
        plural forms.

        Args:
            name: Item name (e.g., "agent", "scenario", "scenarios", "names",
                "training") or "glow" for general documentation.
        """
        # General GLOW docs
        if name == "glow":
            try:
                handler = _get_handler("app.routes.v5.api.docs", "get_glow_docs")
                return handler()
            except Exception:
                return {"error": "Root GLOW documentation not available."}

        # Resolve name to all related registry keys
        related = _resolve_related_names(name)

        if not related:
            suggestion = _suggest_item_name(name)
            result: dict[str, Any] = {
                "error": f"'{name}' is not a valid artifact, resource, or entry."
            }
            if suggestion:
                result["suggestion"] = suggestion
            return result

        # Collect docs from all matching registries
        registry_map = {
            "artifact": ARTIFACT_REGISTRY,
            "resource": RESOURCE_REGISTRY,
            "entry": ENTRY_REGISTRY,
        }

        collected: dict[str, Any] = {}
        operations: dict[str, list[str]] = {}

        for label, key in related.items():
            registry = registry_map[label]
            if "docs" in registry[key]:
                try:
                    handler = _get_handler(*registry[key]["docs"])
                    collected[label] = handler()
                except Exception:
                    pass
            ops = [op for op in registry[key] if op != "docs"]
            if ops:
                operations[label] = ops

        if not collected:
            return {
                "error": f"Documentation not available for '{name}'.",
                "found_in": {
                    label: {"key": key, "operations": operations.get(label, [])}
                    for label, key in related.items()
                },
            }

        # If only one registry matched, return its docs directly
        if len(collected) == 1:
            label, doc = next(iter(collected.items()))
            key = related[label]
            result = cast(dict[str, Any], doc)
            # Add context about other registries if they exist but had no docs
            other = {
                lbl: {"key": k, "operations": operations.get(lbl, [])}
                for lbl, k in related.items()
                if lbl != label
            }
            if other:
                result = {**result, "also_available_as": other}
            return result

        # Multiple registries matched — return merged result
        result = {"name": name, "resolved": related}
        for label, doc in collected.items():
            result[f"{label}_docs"] = doc
        if operations:
            result["operations"] = operations
        return result

    _REFRESHABLE = {name for name, ops in ARTIFACT_REGISTRY.items() if "refresh" in ops}

    @server.tool()
    async def refresh(name: str) -> dict[str, Any]:
        """Refresh cached data / materialized views for an artifact.

        Args:
            name: Artifact name to refresh. Valid values: activity, benchmark,
                chat, dashboard, health, leaderboard, pricing, reports.
        """
        if name not in _REFRESHABLE:
            return {
                "error": f"'{name}' is not refreshable.",
                "refreshable": sorted(_REFRESHABLE),
            }
        return await call_handler(name, "refresh", {})

    @server.tool()
    def discover_artifacts() -> list[dict[str, str]]:
        """List all 29 available artifacts with descriptions."""
        return [
            {
                "name": artifact,
                "description": get_artifact_description(artifact),
            }
            for artifact in ARTIFACTS
        ]

    @server.tool()
    def discover_resources() -> list[dict[str, str]]:
        """List all 75 available resources with descriptions."""
        return [
            {
                "name": resource,
                "description": get_resource_description(resource),
            }
            for resource in RESOURCES
        ]

    @server.tool()
    def discover_entries() -> list[dict[str, str]]:
        """List all 101 available entries with descriptions."""
        return [
            {
                "name": entry,
                "description": get_entry_description(entry),
            }
            for entry in ENTRIES
        ]

    # ==================================================================
    # Category 6: Upload Tool (1 tool)
    # ==================================================================

    @server.tool()
    async def upload(
        filename: str,
        base64_data: str,
        mime_type: str | None = None,
        subfolder: str | None = None,
    ) -> dict[str, Any]:
        """Upload a file (image, document, video, audio).

        Args:
            filename: Original filename with extension (e.g., "photo.png").
            base64_data: Base64-encoded file contents.
            mime_type: MIME type (e.g., "image/png"). Auto-detected from extension if omitted.
            subfolder: Optional subfolder — "audio" or "video". Files go to default uploads folder if omitted.
        """
        import base64 as b64
        import os
        import uuid as uuid_mod

        from app.infra.globals import AUDIO_FOLDER, UPLOAD_FOLDER, VIDEO_FOLDER, get_db
        from app.sql.types import FinalizeUploadSqlParams, FinalizeUploadSqlRow
        from app.utils.cache.invalidate_tags import invalidate_tags
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id
        from app.utils.mime.get_content_type import get_content_type
        from app.utils.sql_helper import execute_sql_typed

        profile_id = get_mcp_profile_id()
        finalize_sql = "app/sql/queries/uploads/finalize_upload_complete.sql"

        try:
            file_bytes = b64.b64decode(base64_data)
        except Exception as e:
            return {"error": f"Invalid base64 data: {e}", "status": "error"}

        upload_uuid = uuid_mod.uuid4()
        _, ext = os.path.splitext(filename)
        if not ext:
            ext = ".bin"

        if subfolder == "audio":
            target_folder = AUDIO_FOLDER
            final_file_path = f"audio/{upload_uuid}{ext}"
        elif subfolder == "video":
            target_folder = VIDEO_FOLDER
            final_file_path = f"video/{upload_uuid}{ext}"
        else:
            target_folder = UPLOAD_FOLDER
            final_file_path = f"{upload_uuid}{ext}"

        final_full_path = target_folder / f"{upload_uuid}{ext}"

        with open(final_full_path, "wb") as f:
            f.write(file_bytes)

        content_type = mime_type or get_content_type(filename)
        file_size = len(file_bytes)

        try:
            params = FinalizeUploadSqlParams(
                upload_file_path=final_file_path,
                content_type=content_type,
                file_size=file_size,
                profile_id=uuid_mod.UUID(profile_id),
            )

            async for conn in get_db():
                result = cast(
                    FinalizeUploadSqlRow,
                    await execute_sql_typed(conn, finalize_sql, params=params),
                )

                if not result or not result.upload_id:
                    return {
                        "error": "Failed to create upload record",
                        "status": "error",
                    }

                await invalidate_tags(["entries", "uploads"], redis=get_redis_client())

                return {
                    "id": str(result.upload_id),
                    "status": "success",
                }

            return {"error": "Database connection not available", "status": "error"}
        except Exception as e:
            return {"error": str(e), "status": "error", "type": type(e).__name__}

    @server.tool()
    async def download(
        upload_id: str,
    ) -> dict[str, Any]:
        """Download a file by upload ID. Returns base64-encoded content + metadata.

        Args:
            upload_id: The UUID of the upload to download.
        """
        import base64 as b64
        import os
        import uuid as uuid_mod

        from app.infra.globals import AUDIO_FOLDER, IMAGE_FOLDER, UPLOAD_FOLDER, get_db
        from app.sql.types import GetUploadFileInfoSqlParams, GetUploadFileInfoSqlRow
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id
        from app.utils.mime.get_content_type import get_content_type
        from app.utils.sql_helper import execute_sql_typed

        profile_id = get_mcp_profile_id()
        download_sql = "app/sql/queries/uploads/get_upload_file_info_complete.sql"

        try:
            params = GetUploadFileInfoSqlParams(
                upload_id=uuid_mod.UUID(upload_id),
                profile_id=uuid_mod.UUID(profile_id),
            )

            async for conn in get_db():
                result = cast(
                    GetUploadFileInfoSqlRow,
                    await execute_sql_typed(conn, download_sql, params=params),
                )

                if not result or not result.upload_exists:
                    return {"error": "Upload not found", "status": "error"}

                stored_path = result.file_path or ""
                if stored_path.startswith("audio/"):
                    file_path = os.path.join(
                        AUDIO_FOLDER, os.path.basename(stored_path)
                    )
                elif stored_path.startswith("image/"):
                    file_path = os.path.join(
                        IMAGE_FOLDER, os.path.basename(stored_path)
                    )
                else:
                    file_path = os.path.join(UPLOAD_FOLDER, stored_path)

                if not os.path.exists(file_path):
                    return {"error": "Upload file not found on disk", "status": "error"}

                with open(file_path, "rb") as f:
                    file_bytes = f.read()

                content_type = get_content_type(
                    result.file_path or "", result.mime_type or ""
                )

                return {
                    "upload_id": str(result.upload_id),
                    "filename": os.path.basename(result.file_path or ""),
                    "mime_type": content_type,
                    "size": result.size,
                    "base64_data": b64.b64encode(file_bytes).decode("ascii"),
                    "status": "success",
                }

            return {"error": "Database connection not available", "status": "error"}
        except Exception as e:
            return {"error": str(e), "status": "error", "type": type(e).__name__}
