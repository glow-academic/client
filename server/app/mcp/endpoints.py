"""Unified endpoints for artifacts, resources, and entries.

Uses explicit handler registries with lazy imports — no filesystem scanning,
no dynamic discovery, no circular imports.
"""

import inspect
from typing import Any, cast

from fastapi import Response
from mcp.server.fastmcp import FastMCP

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
        "get": ("app.api.v4.artifacts.activity.get", "get_activity"),
        "docs": ("app.api.v4.artifacts.activity.docs", "get_activity_docs_static"),
        "refresh": ("app.api.v4.artifacts.activity.refresh", "activity_refresh"),
    },
    "agent": {
        "get": ("app.api.v4.artifacts.agent.get", "get_agent"),
        "list": ("app.api.v4.artifacts.agent.list", "get_agent_list"),
        "save": ("app.api.v4.artifacts.agent.save", "save_agent"),
        "delete": ("app.api.v4.artifacts.agent.delete", "delete_agent"),
        "duplicate": ("app.api.v4.artifacts.agent.duplicate", "duplicate_agent"),
        "draft": ("app.api.v4.artifacts.agent.draft", "patch_agent_draft"),
        "docs": ("app.api.v4.artifacts.agent.docs", "get_agents_docs"),
    },
    "attempt": {
        "get": ("app.api.v4.artifacts.attempt.get", "attempt_get"),
        "list": ("app.api.v4.artifacts.attempt.list", "list_attempts"),
        "docs": ("app.api.v4.artifacts.attempt.docs", "get_attempts_docs"),
    },
    "auth": {
        "get": ("app.api.v4.artifacts.auth.get", "get_auth"),
        "list": ("app.api.v4.artifacts.auth.list", "get_auth_list"),
        "save": ("app.api.v4.artifacts.auth.save", "save_auth"),
        "delete": ("app.api.v4.artifacts.auth.delete", "delete_auth"),
        "duplicate": ("app.api.v4.artifacts.auth.duplicate", "duplicate_auth"),
        "draft": ("app.api.v4.artifacts.auth.draft", "patch_auth_draft"),
        "docs": ("app.api.v4.artifacts.auth.docs", "get_auths_docs"),
    },
    "benchmark": {
        "get": ("app.api.v4.artifacts.benchmark.get", "benchmark_bundle_get"),
        "list": ("app.api.v4.artifacts.benchmark.list", "list_benchmark"),
        "draft": ("app.api.v4.artifacts.benchmark.draft", "patch_benchmark_draft"),
        "refresh": ("app.api.v4.artifacts.benchmark.refresh", "benchmark_refresh"),
        "docs": ("app.api.v4.artifacts.benchmark.docs", "get_benchmarks_docs"),
    },
    "cohort": {
        "get": ("app.api.v4.artifacts.cohort.get", "get_cohort"),
        "list": ("app.api.v4.artifacts.cohort.list", "get_cohort_list"),
        "save": ("app.api.v4.artifacts.cohort.save", "save_cohort"),
        "delete": ("app.api.v4.artifacts.cohort.delete", "delete_cohort"),
        "duplicate": ("app.api.v4.artifacts.cohort.duplicate", "duplicate_cohort"),
        "draft": ("app.api.v4.artifacts.cohort.draft", "patch_cohort_draft"),
        "docs": ("app.api.v4.artifacts.cohort.docs", "get_cohorts_docs"),
    },
    "dashboard": {
        "header": ("app.api.v4.artifacts.dashboard.header", "get_dashboard_header"),
        "footer": ("app.api.v4.artifacts.dashboard.footer", "get_dashboard_footer"),
        "primary": ("app.api.v4.artifacts.dashboard.primary", "get_dashboard_primary"),
        "secondary": (
            "app.api.v4.artifacts.dashboard.secondary",
            "get_dashboard_secondary",
        ),
        "refresh": ("app.api.v4.artifacts.dashboard.refresh", "dashboard_refresh"),
        "docs": ("app.api.v4.artifacts.dashboard.docs", "get_dashboard_docs_static"),
    },
    "department": {
        "get": ("app.api.v4.artifacts.department.get", "get_department"),
        "list": ("app.api.v4.artifacts.department.list", "get_department_list"),
        "save": ("app.api.v4.artifacts.department.save", "save_department"),
        "delete": ("app.api.v4.artifacts.department.delete", "delete_department"),
        "duplicate": (
            "app.api.v4.artifacts.department.duplicate",
            "duplicate_department",
        ),
        "draft": ("app.api.v4.artifacts.department.draft", "patch_department_draft"),
        "docs": ("app.api.v4.artifacts.department.docs", "get_departments_docs"),
    },
    "document": {
        "get": ("app.api.v4.artifacts.document.get", "get_document"),
        "list": ("app.api.v4.artifacts.document.list", "get_document_list"),
        "save": ("app.api.v4.artifacts.document.save", "save_document"),
        "delete": ("app.api.v4.artifacts.document.delete", "delete_document"),
        "duplicate": ("app.api.v4.artifacts.document.duplicate", "duplicate_document"),
        "draft": ("app.api.v4.artifacts.document.draft", "patch_document_draft"),
        "docs": ("app.api.v4.artifacts.document.docs", "get_documents_docs"),
    },
    "eval": {
        "get": ("app.api.v4.artifacts.eval.get", "get_eval"),
        "list": ("app.api.v4.artifacts.eval.list", "get_eval_list"),
        "save": ("app.api.v4.artifacts.eval.save", "save_eval"),
        "delete": ("app.api.v4.artifacts.eval.delete", "delete_eval"),
        "duplicate": ("app.api.v4.artifacts.eval.duplicate", "duplicate_eval"),
        "draft": ("app.api.v4.artifacts.eval.draft", "patch_eval_draft"),
        "docs": ("app.api.v4.artifacts.eval.docs", "get_evals_docs"),
    },
    "field": {
        "get": ("app.api.v4.artifacts.field.get", "get_field"),
        "list": ("app.api.v4.artifacts.field.list", "get_field_list"),
        "save": ("app.api.v4.artifacts.field.save", "save_field"),
        "delete": ("app.api.v4.artifacts.field.delete", "delete_field"),
        "duplicate": ("app.api.v4.artifacts.field.duplicate", "duplicate_field"),
        "draft": ("app.api.v4.artifacts.field.draft", "patch_field_draft"),
        "docs": ("app.api.v4.artifacts.field.docs", "get_fields_docs"),
    },
    "group": {
        "get": ("app.api.v4.artifacts.group.get", "get_group"),
        "list": ("app.api.v4.artifacts.group.list", "list_groups"),
        "docs": ("app.api.v4.artifacts.group.docs", "get_groups_docs"),
    },
    "health": {
        "get": ("app.api.v4.artifacts.health.get", "get_health"),
        "refresh": ("app.api.v4.artifacts.health.refresh", "health_refresh"),
        "docs": ("app.api.v4.artifacts.health.docs", "get_health_docs_static"),
    },
    "leaderboard": {
        "get": ("app.api.v4.artifacts.leaderboard.get", "get_leaderboard"),
        "refresh": (
            "app.api.v4.artifacts.leaderboard.refresh",
            "leaderboard_refresh",
        ),
        "docs": (
            "app.api.v4.artifacts.leaderboard.docs",
            "get_leaderboard_docs_static",
        ),
    },
    "model": {
        "get": ("app.api.v4.artifacts.model.get", "get_model"),
        "list": ("app.api.v4.artifacts.model.list", "get_model_list"),
        "save": ("app.api.v4.artifacts.model.save", "save_model"),
        "delete": ("app.api.v4.artifacts.model.delete", "delete_model"),
        "duplicate": ("app.api.v4.artifacts.model.duplicate", "duplicate_model"),
        "draft": ("app.api.v4.artifacts.model.draft", "patch_model_draft"),
        "docs": ("app.api.v4.artifacts.model.docs", "get_models_docs"),
    },
    "parameter": {
        "get": ("app.api.v4.artifacts.parameter.get", "get_parameter"),
        "list": ("app.api.v4.artifacts.parameter.list", "get_parameter_list"),
        "save": ("app.api.v4.artifacts.parameter.save", "save_parameter"),
        "delete": ("app.api.v4.artifacts.parameter.delete", "delete_parameter"),
        "duplicate": (
            "app.api.v4.artifacts.parameter.duplicate",
            "duplicate_parameter",
        ),
        "draft": ("app.api.v4.artifacts.parameter.draft", "patch_parameter_draft"),
        "docs": ("app.api.v4.artifacts.parameter.docs", "get_parameters_docs"),
    },
    "persona": {
        "get": ("app.api.v4.artifacts.persona.get", "get_persona"),
        "list": ("app.api.v4.artifacts.persona.list", "get_persona_list"),
        "save": ("app.api.v4.artifacts.persona.save", "save_persona"),
        "delete": ("app.api.v4.artifacts.persona.delete", "delete_persona"),
        "duplicate": ("app.api.v4.artifacts.persona.duplicate", "duplicate_persona"),
        "draft": ("app.api.v4.artifacts.persona.draft", "patch_persona_draft"),
        "docs": ("app.api.v4.artifacts.persona.docs", "get_personas_docs"),
    },
    "pricing": {
        "get": ("app.api.v4.artifacts.pricing.get", "get_pricing"),
        "refresh": ("app.api.v4.artifacts.pricing.refresh", "pricing_refresh"),
        "docs": ("app.api.v4.artifacts.pricing.docs", "get_pricing_docs_static"),
    },
    "profile": {
        "get": ("app.api.v4.artifacts.profile.get", "get_profile"),
        "list": ("app.api.v4.artifacts.profile.list", "get_profile_list"),
        "save": ("app.api.v4.artifacts.profile.save", "save_profile"),
        "delete": ("app.api.v4.artifacts.profile.delete", "delete_profile"),
        "duplicate": ("app.api.v4.artifacts.profile.duplicate", "duplicate_profile"),
        "draft": ("app.api.v4.artifacts.profile.draft", "patch_profile_draft"),
        "docs": ("app.api.v4.artifacts.profile.docs", "get_profiles_docs"),
    },
    "provider": {
        "get": ("app.api.v4.artifacts.provider.get", "get_provider"),
        "list": ("app.api.v4.artifacts.provider.list", "get_provider_list"),
        "save": ("app.api.v4.artifacts.provider.save", "save_provider"),
        "delete": ("app.api.v4.artifacts.provider.delete", "delete_provider"),
        "duplicate": ("app.api.v4.artifacts.provider.duplicate", "duplicate_provider"),
        "draft": ("app.api.v4.artifacts.provider.draft", "patch_provider_draft"),
        "docs": ("app.api.v4.artifacts.provider.docs", "get_providers_docs"),
    },
    "reports": {
        "get": ("app.api.v4.artifacts.reports.get", "get_reports"),
        "refresh": ("app.api.v4.artifacts.reports.refresh", "reports_refresh"),
        "docs": ("app.api.v4.artifacts.reports.docs", "get_reports_docs_static"),
    },
    "rubric": {
        "get": ("app.api.v4.artifacts.rubric.get", "get_rubric"),
        "list": ("app.api.v4.artifacts.rubric.list", "get_rubric_list"),
        "save": ("app.api.v4.artifacts.rubric.save", "save_rubric"),
        "delete": ("app.api.v4.artifacts.rubric.delete", "delete_rubric"),
        "duplicate": ("app.api.v4.artifacts.rubric.duplicate", "duplicate_rubric"),
        "draft": ("app.api.v4.artifacts.rubric.draft", "patch_rubric_draft"),
        "docs": ("app.api.v4.artifacts.rubric.docs", "get_rubrics_docs"),
    },
    "scenario": {
        "get": ("app.api.v4.artifacts.scenario.get", "get_scenario"),
        "list": ("app.api.v4.artifacts.scenario.list", "get_scenario_list"),
        "save": ("app.api.v4.artifacts.scenario.save", "save_scenario"),
        "delete": ("app.api.v4.artifacts.scenario.delete", "delete_scenario"),
        "duplicate": ("app.api.v4.artifacts.scenario.duplicate", "duplicate_scenario"),
        "draft": ("app.api.v4.artifacts.scenario.draft", "patch_scenario_draft"),
        "docs": ("app.api.v4.artifacts.scenario.docs", "get_scenarios_docs"),
    },
    "session": {
        "get": ("app.api.v4.artifacts.session.get", "get_session"),
        "list": ("app.api.v4.artifacts.session.list", "list_sessions"),
        "docs": ("app.api.v4.artifacts.session.docs", "get_sessions_docs"),
    },
    "setting": {
        "get": ("app.api.v4.artifacts.setting.get", "get_setting"),
        "list": ("app.api.v4.artifacts.setting.list", "get_setting_list"),
        "save": ("app.api.v4.artifacts.setting.save", "save_setting"),
        "delete": ("app.api.v4.artifacts.setting.delete", "delete_setting"),
        "duplicate": ("app.api.v4.artifacts.setting.duplicate", "duplicate_setting"),
        "draft": ("app.api.v4.artifacts.setting.draft", "patch_setting_draft"),
        "docs": ("app.api.v4.artifacts.setting.docs", "get_settings_docs"),
    },
    "simulation": {
        "get": ("app.api.v4.artifacts.simulation.get", "get_simulation"),
        "list": ("app.api.v4.artifacts.simulation.list", "get_simulation_list"),
        "save": ("app.api.v4.artifacts.simulation.save", "save_simulation"),
        "delete": ("app.api.v4.artifacts.simulation.delete", "delete_simulation"),
        "duplicate": (
            "app.api.v4.artifacts.simulation.duplicate",
            "duplicate_simulation",
        ),
        "draft": ("app.api.v4.artifacts.simulation.draft", "patch_simulation_draft"),
        "docs": ("app.api.v4.artifacts.simulation.docs", "get_simulations_docs"),
    },
    "test": {
        "get": ("app.api.v4.artifacts.test.get", "get_test_artifact"),
        "list": ("app.api.v4.artifacts.test.list", "list_test_artifacts"),
        "docs": ("app.api.v4.artifacts.test.docs", "get_tests_docs"),
    },
    "tool": {
        "get": ("app.api.v4.artifacts.tool.get", "get_tool"),
        "list": ("app.api.v4.artifacts.tool.list", "get_tool_list"),
        "save": ("app.api.v4.artifacts.tool.save", "save_tool"),
        "delete": ("app.api.v4.artifacts.tool.delete", "delete_tool"),
        "duplicate": ("app.api.v4.artifacts.tool.duplicate", "duplicate_tool"),
        "draft": ("app.api.v4.artifacts.tool.draft", "patch_tool_draft"),
        "docs": ("app.api.v4.artifacts.tool.docs", "get_tools_docs"),
    },
    "training": {
        "get": ("app.api.v4.artifacts.training.get", "training_bundle_get"),
        "list": ("app.api.v4.artifacts.training.list", "training_get"),
        "draft": ("app.api.v4.artifacts.training.draft", "patch_training_draft"),
        "refresh": ("app.api.v4.artifacts.training.refresh", "training_refresh"),
        "docs": ("app.api.v4.artifacts.training.docs", "get_training_docs_static"),
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
    "bindings",
    "cohorts",
    "colors",
    "conditional_parameters",
    "departments",
    "descriptions",
    "documents",
    "domains",
    "emails",
    "endpoints",
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
    "roles",
    "rubrics",
    "run_positions",
    "run_rubrics",
    "runs",
    "scenario_flags",
    "scenario_personas",
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
    "scenario_personas",
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
        "get": (f"app.api.v4.resources.{_name}.get", f"get_{_name}"),
        "search": (f"app.api.v4.resources.{_name}.search", f"search_{_name}"),
        "docs": (f"app.api.v4.resources.{_name}.docs", f"get_{_name}_docs"),
    }
    if _name in _RESOURCES_WITH_CREATE:
        _entry["create"] = (
            f"app.api.v4.resources.{_name}.create",
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
    "bindings",
    "calls",
    "certificates",
    "cohort_drafts",
    "config",
    "conversations",
    "conversations_completions",
    "dashboard_insights",
    "debug_info",
    "department_drafts",
    "document_drafts",
    "domains",
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
    "mutes",
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
    "responses",
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

ENTRY_REGISTRY: dict[str, dict[str, tuple[str, str]]] = {}
for _name in _ALL_ENTRIES:
    _entry: dict[str, tuple[str, str]] = {
        "get": (f"app.api.v4.entries.{_name}.get", f"get_{_name}_entries"),
        "search": (f"app.api.v4.entries.{_name}.search", f"search_{_name}_entries"),
    }
    # Special case: uploads uses create_uploads_entry_mcp
    if _name == "uploads":
        _entry["create"] = (
            f"app.api.v4.entries.{_name}.create",
            "create_uploads_entry_mcp",
        )
    else:
        _entry["create"] = (
            f"app.api.v4.entries.{_name}.create",
            f"create_{_name}_entry",
        )
    ENTRY_REGISTRY[_name] = _entry


# ============================================================================
# Special Registry — 16 special handlers
# ============================================================================

SPECIAL_REGISTRY: dict[str, tuple[str, str]] = {
    "attempt_archive": (
        "app.api.v4.artifacts.attempt.archive",
        "archive_attempts",
    ),
    "test_archive": (
        "app.api.v4.artifacts.test.archive",
        "archive_test_artifacts",
    ),
    "export_report": ("app.api.v4.artifacts.reports.export", "export_report"),
    "export_certificate": (
        "app.api.v4.artifacts.attempt.certifficate",
        "export_certificate",
    ),
    "decrypt": ("app.api.v4.resources.keys.decrypt", "decrypt_key"),
    "upload_save": ("app.api.v4.resources.uploads.upload", "save_upload"),
    "upload_download": ("app.api.v4.resources.uploads.download", "get_upload"),
    "debug_problem": ("app.api.v4.artifacts.activity.problem", "create_problem"),
    "debug_resolve": ("app.api.v4.artifacts.activity.resolve", "resolve_problem"),
    "bulk_document_process": (
        "app.api.v4.artifacts.document.bulk.process",
        "process_document",
    ),
    "bulk_document_search": (
        "app.api.v4.artifacts.document.bulk.search",
        "search_document",
    ),
    "bulk_document_save": (
        "app.api.v4.artifacts.document.bulk.save",
        "save_document",
    ),
    "bulk_document_delete": (
        "app.api.v4.artifacts.document.bulk.delete",
        "delete_document",
    ),
    "bulk_profile_process": (
        "app.api.v4.artifacts.profile.bulk.process",
        "process_staff",
    ),
    "bulk_profile_search": (
        "app.api.v4.artifacts.profile.bulk.search",
        "search_staff",
    ),
    "bulk_profile_save": ("app.api.v4.artifacts.profile.bulk.save", "save_staff"),
    "bulk_profile_delete": (
        "app.api.v4.artifacts.profile.bulk.delete",
        "delete_staff",
    ),
}


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

    from app.main import get_db

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
            "path": "/api/v4/mcp",
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
    """Register all MCP endpoints."""

    # ------------------------------------------------------------------
    # Discovery tools
    # ------------------------------------------------------------------

    @server.tool()
    def artifacts() -> list[dict[str, str]]:
        """List all available artifacts with descriptions.

        Returns:
            List of dictionaries with 'name' and 'description' keys.
        """
        return [
            {
                "name": artifact,
                "description": get_artifact_description(artifact),
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
                "description": get_resource_description(resource),
            }
            for resource in RESOURCES
        ]

    @server.tool()
    def entries() -> list[dict[str, str]]:
        """List all available entries with descriptions.

        Returns:
            List of dictionaries with 'name' and 'description' keys.
        """
        return [
            {
                "name": entry,
                "description": get_entry_description(entry),
            }
            for entry in ENTRIES
        ]

    # ------------------------------------------------------------------
    # Documentation tools
    # ------------------------------------------------------------------

    @server.tool()
    def docs_artifact(name: str) -> dict[str, Any]:
        """Get comprehensive documentation for an artifact.

        Args:
            name: Artifact name (e.g., "agent", "persona", "cohort", "document").

        Returns:
            Dictionary containing database schema, relationships, API routing,
            resources, frontend components, and GLOW context.
        """
        if name not in ARTIFACT_REGISTRY:
            return {"error": f"'{name}' is not a valid artifact."}

        ops = ARTIFACT_REGISTRY[name]
        if "docs" not in ops:
            return {
                "error": f"Documentation not available for '{name}'",
                "note": "Check if docs.py exists for this artifact.",
            }

        handler = _get_handler(*ops["docs"])
        return cast(dict[str, Any], handler())

    @server.tool()
    def docs_resource(name: str) -> dict[str, Any]:
        """Get comprehensive documentation for a resource.

        Args:
            name: Resource name (e.g., "names", "descriptions", "flags").

        Returns:
            Dictionary containing database schema, relationships, and usage patterns.
        """
        if name not in RESOURCE_REGISTRY:
            return {"error": f"'{name}' is not a valid resource."}

        ops = RESOURCE_REGISTRY[name]
        if "docs" not in ops:
            return {
                "error": f"Documentation not available for '{name}'",
                "note": "Check if docs.py exists for this resource.",
            }

        handler = _get_handler(*ops["docs"])
        return cast(dict[str, Any], handler())

    @server.tool()
    def docs_entry(name: str) -> dict[str, Any]:
        """Get comprehensive documentation for an entry.

        Args:
            name: Entry name (e.g., "activity", "attempt", "training").

        Returns:
            Dictionary containing entry documentation and usage patterns.
        """
        if name not in ENTRY_REGISTRY:
            return {"error": f"'{name}' is not a valid entry."}

        ops = ENTRY_REGISTRY[name]
        if "docs" not in ops:
            return {
                "error": f"Documentation not available for '{name}'",
                "note": "Entry docs are not yet implemented.",
            }

        handler = _get_handler(*ops["docs"])
        return cast(dict[str, Any], handler())

    @server.tool()
    def docs() -> dict[str, Any]:
        """Get general GLOW documentation.

        Returns:
            Dictionary containing general information about GLOW architecture,
            core concepts, common patterns, and best practices.
        """
        try:
            handler = _get_handler("app.api.v4.docs", "get_glow_docs")
            return handler()
        except Exception:
            return {"error": "Root GLOW documentation not available."}

    # ------------------------------------------------------------------
    # Payload schema tools
    # ------------------------------------------------------------------

    @server.tool()
    def payload_artifact(name: str, operation: str = "get") -> dict[str, Any]:  # type: ignore[return]
        """Get payload schema for an artifact.

        IMPORTANT: Call this tool FIRST before using artifact operations.

        Args:
            name: Artifact name (e.g., "agent", "persona", "cohort").
            operation: Operation name (e.g., "get", "save", "list", "duplicate", "delete", "draft").

        Returns:
            JSON schema for the payload. The 'mcp' field is auto-filtered.
        """
        return get_payload_schema(name, operation)

    @server.tool()
    def payload_resource(name: str, operation: str = "create") -> dict[str, Any]:  # type: ignore[return]
        """Get payload schema for a resource.

        IMPORTANT: Call this tool FIRST before using create_resource.

        Args:
            name: Resource name (e.g., "names", "descriptions", "flags").
            operation: Operation name. Defaults to "create".

        Returns:
            JSON schema for the payload. The 'mcp' field is auto-filtered.
        """
        return get_payload_schema(name, operation)

    @server.tool()
    def payload_entry(name: str, operation: str = "get") -> dict[str, Any]:  # type: ignore[return]
        """Get payload schema for an entry.

        IMPORTANT: Call this tool FIRST before using entry operations.

        Args:
            name: Entry name (e.g., "activity", "attempt", "training").
            operation: Operation name (e.g., "get", "search", "create"). Defaults to "get".

        Returns:
            JSON schema for the payload. The 'mcp' field is auto-filtered.
        """
        if name not in ENTRY_REGISTRY:
            return {
                "error": f"'{name}' is not a valid entry. Available: {', '.join(ENTRIES)}"
            }
        if operation not in ENTRY_REGISTRY[name]:
            return {
                "error": f"Operation '{operation}' not available for entry '{name}'.",
                "available_operations": list(ENTRY_REGISTRY[name].keys()),
            }
        return get_payload_schema(name, operation)

    # ------------------------------------------------------------------
    # Artifact CRUD tools
    # ------------------------------------------------------------------

    @server.tool()
    async def get_artifact(name: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Get an artifact by name.

        Args:
            name: Artifact name (e.g., "agent", "persona", "cohort", "document").
                  Use singular form: "scenario" not "scenarios".
            payload: Request payload. Call payload_artifact(name, "get") first.

        Returns:
            Object containing artifact data with id, name, timestamps, and related resources.
        """
        return await call_handler(name, "get", payload)

    @server.tool()
    async def save_artifact(name: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Save (create or update) an artifact.

        Args:
            name: Artifact name (e.g., "agent", "persona", "cohort").
            payload: Request payload. Call payload_artifact(name, "save") first.

        Returns:
            Object with saved artifact data including id and timestamps.
        """
        return await call_handler(name, "save", payload)

    @server.tool()
    async def list_artifact(name: str, payload: dict[str, Any]) -> dict[str, Any]:
        """List items for an artifact.

        Args:
            name: Artifact name (e.g., "agent", "persona", "cohort"). Use singular form.
            payload: Request payload with filter parameters. Call payload_artifact(name, "list") first.

        Returns:
            List of artifact objects with id, name, timestamps, and related data.
        """
        return await call_handler(name, "list", payload)

    @server.tool()
    async def duplicate_artifact(name: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Duplicate an artifact.

        Args:
            name: Artifact name (e.g., "agent", "persona"). Use singular form.
            payload: Request payload. Call payload_artifact(name, "duplicate") first.

        Returns:
            Object with duplicated artifact data including new id.
        """
        return await call_handler(name, "duplicate", payload)

    @server.tool()
    async def delete_artifact(name: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Delete an artifact.

        Args:
            name: Artifact name (e.g., "agent", "persona"). Use singular form.
            payload: Request payload. Call payload_artifact(name, "delete") first.

        Returns:
            Success response or error message.
        """
        return await call_handler(name, "delete", payload)

    @server.tool()
    async def draft_artifact(name: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Create or patch a draft artifact (autosave).

        Args:
            name: Artifact name (e.g., "agent", "persona"). Use singular form.
            payload: Request payload. Call payload_artifact(name, "draft") first.

        Returns:
            Draft data including draft_id and version information.
        """
        return await call_handler(name, "draft", payload)

    @server.tool()
    async def refresh_artifact(name: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Refresh an artifact's cached data.

        Args:
            name: Artifact name (e.g., "activity", "benchmark", "dashboard", "health").
            payload: Request payload. Call payload_artifact(name, "refresh") first.

        Returns:
            Refresh result.
        """
        return await call_handler(name, "refresh", payload)

    # ------------------------------------------------------------------
    # Resource tools
    # ------------------------------------------------------------------

    @server.tool()
    async def get_resource(name: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Get resource data by name.

        Args:
            name: Resource name (e.g., "agents", "names", "descriptions").
            payload: Request payload. Call payload_resource(name, "get") first.

        Returns:
            Resource data.
        """
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        profile_id = get_mcp_profile_id()

        if name not in RESOURCE_REGISTRY:
            return {"error": f"'{name}' is not a valid resource."}

        if "get" not in RESOURCE_REGISTRY[name]:
            return {"error": f"get operation not available for '{name}'."}

        handler = _get_handler(*RESOURCE_REGISTRY[name]["get"])
        return await call_endpoint_handler(handler, payload, profile_id)

    @server.tool()
    async def search_resource(name: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Search resources by name.

        Args:
            name: Resource name (e.g., "agents", "names", "descriptions").
            payload: Request payload. Call payload_resource(name, "search") first.

        Returns:
            Search results.
        """
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        profile_id = get_mcp_profile_id()

        if name not in RESOURCE_REGISTRY:
            return {"error": f"'{name}' is not a valid resource."}

        if "search" not in RESOURCE_REGISTRY[name]:
            return {"error": f"search operation not available for '{name}'."}

        handler = _get_handler(*RESOURCE_REGISTRY[name]["search"])
        return await call_endpoint_handler(handler, payload, profile_id)

    @server.tool()
    async def create_resource(name: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Create a resource.

        Args:
            name: Resource name (e.g., "names", "descriptions", "flags").
            payload: Request payload. Call payload_resource(name) first.

        Returns:
            Success response with created resource data including id.
        """
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        profile_id = get_mcp_profile_id()

        if name not in RESOURCE_REGISTRY:
            return {
                "error": f"'{name}' is not a valid resource.",
                "status": "invalid_resource",
            }

        if "create" not in RESOURCE_REGISTRY[name]:
            return {
                "error": f"Resource '{name}' does not support create.",
                "status": "not_implemented",
            }

        handler = _get_handler(*RESOURCE_REGISTRY[name]["create"])
        return await call_endpoint_handler(handler, payload, profile_id)

    # ------------------------------------------------------------------
    # Entry tools
    # ------------------------------------------------------------------

    @server.tool()
    async def get_entry(name: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Get entry data by name.

        Args:
            name: Entry name (e.g., "activity", "attempt", "training").
            payload: Request payload. Call payload_entry(name, "get") first.

        Returns:
            Entry data.
        """
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        profile_id = get_mcp_profile_id()

        if name not in ENTRY_REGISTRY:
            return {
                "error": f"'{name}' is not a valid entry.",
                "available_entries": ENTRIES,
            }

        if "get" not in ENTRY_REGISTRY[name]:
            return {
                "error": f"get operation not available for entry '{name}'.",
                "available_operations": list(ENTRY_REGISTRY[name].keys()),
            }

        handler = _get_handler(*ENTRY_REGISTRY[name]["get"])
        return await call_endpoint_handler(handler, payload, profile_id)

    @server.tool()
    async def search_entry(name: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Search entries by name.

        Args:
            name: Entry name (e.g., "activity", "attempt", "training").
            payload: Request payload. Call payload_entry(name, "search") first.

        Returns:
            Search results.
        """
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        profile_id = get_mcp_profile_id()

        if name not in ENTRY_REGISTRY:
            return {
                "error": f"'{name}' is not a valid entry.",
                "available_entries": ENTRIES,
            }

        if "search" not in ENTRY_REGISTRY[name]:
            return {
                "error": f"search operation not available for entry '{name}'.",
                "available_operations": list(ENTRY_REGISTRY[name].keys()),
            }

        handler = _get_handler(*ENTRY_REGISTRY[name]["search"])
        return await call_endpoint_handler(handler, payload, profile_id)

    @server.tool()
    async def create_entry(name: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Create an entry.

        Args:
            name: Entry name (e.g., "activity", "attempt", "training").
            payload: Request payload. Call payload_entry(name, "create") first.

        Returns:
            Success response with created entry data.
        """
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        profile_id = get_mcp_profile_id()

        if name not in ENTRY_REGISTRY:
            return {
                "error": f"'{name}' is not a valid entry.",
                "available_entries": ENTRIES,
            }

        if "create" not in ENTRY_REGISTRY[name]:
            return {
                "error": f"create operation not available for entry '{name}'.",
                "available_operations": list(ENTRY_REGISTRY[name].keys()),
            }

        handler = _get_handler(*ENTRY_REGISTRY[name]["create"])
        return await call_endpoint_handler(handler, payload, profile_id)

    # ------------------------------------------------------------------
    # Special tools
    # ------------------------------------------------------------------

    @server.tool()
    async def archive_attempt(type: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Archive or unarchive attempts.

        Args:
            type: Attempt type ("simulation" or "test").
            payload: Request payload including attempt_ids and archived flag.

        Example:
            type: "simulation"
            payload: {{"attempt_ids": ["123e4567-..."], "archived": true}}

        Returns:
            Archive result with success status.
        """
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        profile_id = get_mcp_profile_id()

        key_map = {"simulation": "attempt_archive", "test": "test_archive"}
        registry_key = key_map.get(type)
        if not registry_key or registry_key not in SPECIAL_REGISTRY:
            return {
                "error": f"'{type}' is not a valid attempt type for archive.",
                "valid_types": list(key_map.keys()),
            }

        handler = _get_handler(*SPECIAL_REGISTRY[registry_key])
        return await call_endpoint_handler(handler, payload, profile_id)

    @server.tool()
    async def export_report(payload: dict[str, Any]) -> dict[str, Any]:
        """Export report.

        Args:
            payload: Request payload with report parameters and format.

        Returns:
            Report content (CSV or ZIP, base64-encoded).
        """
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        profile_id = get_mcp_profile_id()
        handler = _get_handler(*SPECIAL_REGISTRY["export_report"])
        return await call_endpoint_handler(handler, payload, profile_id)

    @server.tool()
    async def export_certificate(payload: dict[str, Any]) -> dict[str, Any]:
        """Export certificate.

        Args:
            payload: Request payload with certificate parameters.

        Returns:
            Certificate content (PDF, base64-encoded).
        """
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        profile_id = get_mcp_profile_id()
        handler = _get_handler(*SPECIAL_REGISTRY["export_certificate"])
        return await call_endpoint_handler(handler, payload, profile_id)

    @server.tool()
    async def bulk(
        type: str, operation: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        """Call bulk operation endpoint.

        Args:
            type: Bulk type ("document" or "profile").
            operation: Operation ("process", "search", "save", "delete").
            payload: Request payload with operation-specific data.

        Returns:
            Bulk operation result.
        """
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        profile_id = get_mcp_profile_id()

        # Map type to registry key prefix
        type_map = {
            "document": "bulk_document",
            "staff": "bulk_profile",
            "profile": "bulk_profile",
        }
        prefix = type_map.get(type)
        if not prefix:
            return {
                "error": f"'{type}' is not a valid bulk type.",
                "valid_types": ["document", "staff"],
            }

        registry_key = f"{prefix}_{operation}"
        if registry_key not in SPECIAL_REGISTRY:
            valid_ops = [
                k.split("_", 2)[2] for k in SPECIAL_REGISTRY if k.startswith(prefix)
            ]
            return {
                "error": f"'{operation}' is not a valid operation for {type} bulk.",
                "valid_operations": valid_ops,
            }

        handler = _get_handler(*SPECIAL_REGISTRY[registry_key])
        return await call_endpoint_handler(handler, payload, profile_id)

    @server.tool()
    async def decrypt(key_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Decrypt encrypted key value.

        Args:
            key_id: UUID string of the encrypted key to decrypt.
            payload: Request payload (typically empty).

        Returns:
            Object containing decrypted_value and key metadata.
        """
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        profile_id = get_mcp_profile_id()
        payload_with_id = {**payload, "key_id": key_id}
        handler = _get_handler(*SPECIAL_REGISTRY["decrypt"])
        return await call_endpoint_handler(handler, payload_with_id, profile_id)

    @server.tool()
    async def upload(payload: dict[str, Any]) -> dict[str, Any]:
        """Upload a file (base64 content).

        Args:
            payload: Request payload containing:
                - content: base64-encoded string (required)
                - filename: string (required)
                - content_type: string (optional, MIME type)
                - subfolder: "audio" | "video" | None (optional)

        Returns:
            Object containing upload_id, filename, and status.
        """
        import base64
        import json
        import uuid

        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        profile_id = get_mcp_profile_id()

        if "content" not in payload or "filename" not in payload:
            return {
                "error": "Payload must include 'content' (base64) and 'filename'",
                "status": "validation_error",
            }

        try:
            content_bytes = base64.b64decode(payload["content"])
            filename = payload["filename"]
            content_type = payload.get("content_type")
            subfolder = payload.get("subfolder")
            upload_id = str(uuid.uuid4())

            from app.main import TUS_UPLOADS_DIR

            upload_dir = TUS_UPLOADS_DIR / upload_id
            upload_dir.mkdir(parents=True, exist_ok=True)

            metadata = {
                "filename": filename,
                "filetype": content_type,
                "subfolder": subfolder,
            }
            with open(upload_dir / "metadata.json", "w") as f:
                json.dump(metadata, f)

            with open(upload_dir / "file", "wb") as f:
                f.write(content_bytes)

            with open(upload_dir / "info", "w") as f:
                f.write(f"length:{len(content_bytes)}\noffset:{len(content_bytes)}")

            # Finalize upload
            save_handler = _get_handler(*SPECIAL_REGISTRY["upload_save"])

            from starlette.requests import Request as StarletteRequest

            from app.main import get_db

            scope = {
                "type": "http",
                "method": "POST",
                "path": f"/api/v4/resources/uploads/upload/{upload_id}/finalize",
                "headers": [],
                "query_string": b"",
                "server": ("localhost", 8000),
            }
            http_request = StarletteRequest(scope)
            http_request.state.profile_id = profile_id
            http_request.state.mcp = True
            http_response = Response()

            async for conn in get_db():
                result = await save_handler(
                    upload_id, http_request, http_response, conn
                )
                if hasattr(result, "model_dump"):
                    result_dict = result.model_dump(mode="json")
                    return cast(dict[str, Any], result_dict)
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

    @server.tool()
    async def download(upload_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Download an upload file.

        Args:
            upload_id: UUID string of the upload.
            payload: Optional: {{"preview": true}} for PDF preview.

        Returns:
            Object with content (base64), content_type, and encoding.
        """
        import base64

        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        profile_id = get_mcp_profile_id()

        try:
            download_handler = _get_handler(*SPECIAL_REGISTRY["upload_download"])

            from starlette.requests import Request as StarletteRequest

            from app.main import get_db

            scope = {
                "type": "http",
                "method": "GET",
                "path": f"/api/v4/uploads/get/{upload_id}",
                "headers": [],
                "query_string": b"",
                "server": ("localhost", 8000),
            }
            http_request = StarletteRequest(scope)
            http_request.state.profile_id = profile_id
            http_request.state.mcp = True

            preview = payload.get("preview", False)

            async for conn in get_db():
                result = await download_handler(
                    upload_id, http_request, conn, preview=preview
                )

                if hasattr(result, "body"):
                    content = result.body
                    if isinstance(content, bytes):
                        return {
                            "content": base64.b64encode(content).decode("utf-8"),
                            "content_type": result.headers.get(
                                "content-type", "application/octet-stream"
                            ),
                            "encoding": "base64",
                        }
                    else:
                        return {
                            "content": content.decode("utf-8")
                            if isinstance(content, bytes)
                            else str(content),
                            "content_type": result.headers.get(
                                "content-type", "text/plain"
                            ),
                        }
                else:
                    return {
                        "error": "Unexpected response type from download handler",
                        "status": "error",
                    }

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

    @server.tool()
    async def debug(message: str) -> dict[str, Any]:
        """Report a problem or provide feedback.

        Args:
            message: Problem description or feedback (max 1000 characters).

        Returns:
            Object with success status and feedback_id.
        """
        from app.utils.mcp.get_mcp_profile_id import get_mcp_profile_id

        profile_id = get_mcp_profile_id()

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

        handler = _get_handler(*SPECIAL_REGISTRY["debug_problem"])
        payload = {
            "type": "bug",
            "message": message.strip(),
        }
        return await call_endpoint_handler(handler, payload, profile_id)
