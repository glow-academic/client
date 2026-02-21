"""
Domain registry — static enum-to-enum mappings.
Mirrors seed-only _relation tables from the database.
"""

from __future__ import annotations

# artifact_flags_relation (artifact_type → flag_type)
ARTIFACT_FLAGS: dict[str, frozenset[str]] = {
    "agent": frozenset({"active"}),
    "auth": frozenset({"active"}),
    "cohort": frozenset({"active"}),
    "department": frozenset({"active"}),
    "document": frozenset({"active"}),
    "eval": frozenset({"active", "dynamic", "groups"}),
    "field": frozenset({"active"}),
    "model": frozenset(
        {
            "active",
            "modalities_enabled",
            "pricing_enabled",
            "qualities_enabled",
            "reasoning_levels_enabled",
            "temperature_enabled",
            "voices_enabled",
        }
    ),
    "parameter": frozenset(
        {
            "active",
            "document_parameter",
            "persona_parameter",
            "scenario_parameter",
            "simulation_parameter",
            "video_parameter",
        }
    ),
    "persona": frozenset({"active"}),
    "profile": frozenset({"active"}),
    "provider": frozenset({"active"}),
    "rubric": frozenset({"active"}),
    "scenario": frozenset(
        {
            "active",
            "analyses_enabled",
            "images_enabled",
            "improvements_enabled",
            "objectives_enabled",
            "problem_statement_enabled",
            "questions_enabled",
            "replacements_enabled",
            "strengths_enabled",
            "use_custom",
            "use_previous",
            "video_enabled",
        }
    ),
    "setting": frozenset({"active", "guest_login_enabled", "mcp"}),
    "simulation": frozenset({"active", "practice"}),
    "tool": frozenset({"active"}),
}

# artifact_roles_relation (artifact_type → profile_type)
ARTIFACT_ROLES: dict[str, frozenset[str]] = {
    "agent": frozenset({"admin", "superadmin"}),
    "auth": frozenset({"superadmin"}),
    "cohort": frozenset({"admin", "instructional", "superadmin"}),
    "department": frozenset({"superadmin"}),
    "document": frozenset({"admin", "superadmin"}),
    "eval": frozenset({"superadmin"}),
    "field": frozenset({"admin", "superadmin"}),
    "model": frozenset({"admin", "superadmin"}),
    "parameter": frozenset({"admin", "superadmin"}),
    "persona": frozenset({"admin", "instructional", "superadmin"}),
    "profile": frozenset({"admin", "superadmin"}),
    "provider": frozenset({"admin", "superadmin"}),
    "rubric": frozenset({"superadmin"}),
    "scenario": frozenset({"admin", "instructional", "superadmin"}),
    "setting": frozenset({"admin", "superadmin"}),
    "simulation": frozenset({"admin", "instructional", "superadmin"}),
    "tool": frozenset({"admin", "superadmin"}),
}

# entry_resource_relation (entry_type → resource_type)
ENTRY_RESOURCES: dict[str, frozenset[str]] = {
    "args_outputs_values": frozenset({"args_outputs"}),
    "args_values": frozenset({"args"}),
    "benchmark": frozenset(
        {
            "departments",
            "evals",
            "profiles",
            "rubrics",
            "standard_groups",
            "standards",
        }
    ),
    "benchmark_bundle": frozenset(
        {
            "departments",
            "groups",
            "instructions",
            "keys",
            "models",
            "prompts",
            "reasoning_levels",
            "runs",
            "temperature_levels",
            "tools",
            "voices",
        }
    ),
    "benchmark_grades": frozenset({"rubrics"}),
    "benchmark_invocations": frozenset({"groups", "runs"}),
    "benchmark_tests": frozenset({"departments", "evals", "profiles", "roles"}),
    "bindings": frozenset({"bindings"}),
    "config": frozenset({"agents", "models", "providers"}),
    "domains": frozenset({"domains"}),
    "groups": frozenset({"groups"}),
    "responses": frozenset({"options", "questions"}),
    "run_pricing": frozenset({"pricing"}),
    "runs": frozenset({"keys", "runs", "tools"}),
    "simulation_attempts": frozenset(
        {
            "cohorts",
            "departments",
            "profiles",
            "roles",
            "simulations",
        }
    ),
    "simulation_chats": frozenset(
        {
            "images",
            "objectives",
            "options",
            "parameters",
            "questions",
            "videos",
        }
    ),
    "simulation_grades": frozenset({"rubrics"}),
    "texts": frozenset({"texts"}),
    "training": frozenset(
        {
            "cohorts",
            "departments",
            "profiles",
            "rubrics",
            "simulations",
            "standard_groups",
            "standards",
        }
    ),
    "training_bundle": frozenset(
        {
            "departments",
            "documents",
            "fields",
            "images",
            "objectives",
            "options",
            "parameter_fields",
            "parameters",
            "personas",
            "problem_statements",
            "questions",
            "scenarios",
            "videos",
        }
    ),
    "training_bundle_departments": frozenset(
        {
            "documents",
            "images",
            "objectives",
            "options",
            "parameter_fields",
            "parameters",
            "personas",
            "problem_statements",
            "questions",
            "rubrics",
            "scenarios",
            "standard_groups",
            "standards",
            "videos",
        }
    ),
    "uploads": frozenset({"uploads"}),
}

# resource_entry_relation (resource_type → entry_type)
RESOURCE_ENTRIES: dict[str, frozenset[str]] = {
    "agents": frozenset({"calls", "drafts"}),
    "arg_positions": frozenset({"calls"}),
    "args": frozenset({"calls", "drafts"}),
    "args_outputs": frozenset({"calls", "drafts"}),
    "auth_item_keys": frozenset({"calls"}),
    "auths": frozenset({"calls", "drafts"}),
    "bindings": frozenset({"bindings", "calls", "drafts"}),
    "cohorts": frozenset({"calls", "drafts"}),
    "colors": frozenset({"calls", "drafts"}),
    "conditional_parameters": frozenset({"calls", "drafts"}),
    "departments": frozenset({"calls", "drafts"}),
    "descriptions": frozenset({"calls", "drafts"}),
    "documents": frozenset({"calls", "drafts"}),
    "domains": frozenset({"calls", "domains", "drafts"}),
    "emails": frozenset({"calls", "drafts"}),
    "endpoints": frozenset({"calls", "drafts"}),
    "evals": frozenset({"calls", "drafts"}),
    "examples": frozenset({"calls", "drafts"}),
    "fields": frozenset({"calls", "drafts"}),
    "flags": frozenset({"calls", "drafts"}),
    "group_positions": frozenset({"calls", "drafts"}),
    "group_rubrics": frozenset({"calls", "drafts"}),
    "groups": frozenset({"calls", "drafts", "groups"}),
    "icons": frozenset({"calls", "drafts"}),
    "images": frozenset({"calls", "drafts"}),
    "instructions": frozenset({"calls", "drafts"}),
    "items": frozenset({"calls", "drafts"}),
    "keys": frozenset({"calls", "drafts"}),
    "modalities": frozenset({"calls", "drafts"}),
    "models": frozenset({"calls", "drafts"}),
    "names": frozenset({"calls", "drafts"}),
    "objectives": frozenset({"calls", "drafts"}),
    "options": frozenset({"calls", "drafts"}),
    "parameter_fields": frozenset({"calls", "drafts"}),
    "parameters": frozenset({"calls", "drafts"}),
    "personas": frozenset({"calls", "drafts"}),
    "points": frozenset({"calls", "drafts"}),
    "pricing": frozenset({"calls", "drafts"}),
    "problem_statements": frozenset({"calls", "drafts"}),
    "profiles": frozenset(
        {
            "activity",
            "audits",
            "calls",
            "drafts",
            "emulations",
            "grants",
            "logins",
            "problems",
            "runs",
        }
    ),
    "prompts": frozenset({"calls", "drafts"}),
    "protocols": frozenset({"calls", "drafts"}),
    "provider_keys": frozenset({"calls"}),
    "providers": frozenset({"calls", "drafts"}),
    "qualities": frozenset({"calls", "drafts"}),
    "questions": frozenset({"calls", "drafts"}),
    "reasoning_levels": frozenset({"calls", "drafts"}),
    "request_limits": frozenset({"calls", "drafts"}),
    "role_routes": frozenset({"calls", "drafts"}),
    "roles": frozenset({"calls", "drafts"}),
    "routes": frozenset({"calls", "drafts"}),
    "rubrics": frozenset({"calls", "drafts"}),
    "run_positions": frozenset({"calls", "drafts"}),
    "run_rubrics": frozenset({"calls", "drafts"}),
    "runs": frozenset({"calls", "drafts", "runs"}),
    "scenario_flags": frozenset({"calls", "drafts"}),
    "scenario_personas": frozenset({"calls", "drafts"}),
    "scenario_positions": frozenset({"calls", "drafts"}),
    "scenario_rubrics": frozenset({"calls", "drafts"}),
    "scenario_time_limits": frozenset({"calls", "drafts"}),
    "scenarios": frozenset({"calls", "drafts"}),
    "settings": frozenset({"calls", "drafts"}),
    "simulation_positions": frozenset({"calls", "drafts"}),
    "simulations": frozenset({"calls", "drafts"}),
    "slugs": frozenset({"calls", "drafts"}),
    "standard_groups": frozenset({"calls", "drafts"}),
    "standards": frozenset({"calls", "drafts"}),
    "temperature_levels": frozenset({"calls", "drafts"}),
    "texts": frozenset({"calls", "drafts", "texts"}),
    "thresholds": frozenset({"calls", "drafts"}),
    "tools": frozenset({"calls", "drafts"}),
    "uploads": frozenset({"calls", "drafts", "uploads"}),
    "values": frozenset({"calls", "drafts"}),
    "videos": frozenset({"calls", "drafts"}),
    "voices": frozenset({"calls", "drafts"}),
}

# resource_modalities_relation (resource_type → modality_type)
RESOURCE_MODALITIES: dict[str, frozenset[str]] = {
    "agents": frozenset({"call"}),
    "auths": frozenset({"call"}),
    "cohorts": frozenset({"call"}),
    "colors": frozenset({"call"}),
    "departments": frozenset({"call"}),
    "descriptions": frozenset({"call"}),
    "documents": frozenset({"call", "document"}),
    "endpoints": frozenset({"call"}),
    "evals": frozenset({"call"}),
    "examples": frozenset({"call"}),
    "fields": frozenset({"call"}),
    "flags": frozenset({"call"}),
    "icons": frozenset({"call"}),
    "images": frozenset({"call", "image"}),
    "instructions": frozenset({"call"}),
    "items": frozenset({"call"}),
    "keys": frozenset({"call"}),
    "models": frozenset({"call"}),
    "names": frozenset({"call"}),
    "objectives": frozenset({"call"}),
    "options": frozenset({"call"}),
    "parameters": frozenset({"call"}),
    "personas": frozenset({"call"}),
    "points": frozenset({"call"}),
    "problem_statements": frozenset({"call"}),
    "profiles": frozenset({"call"}),
    "prompts": frozenset({"call"}),
    "protocols": frozenset({"call"}),
    "questions": frozenset({"call"}),
    "rubrics": frozenset({"call"}),
    "scenarios": frozenset({"call"}),
    "settings": frozenset({"call"}),
    "simulations": frozenset({"call"}),
    "slugs": frozenset({"call"}),
    "standard_groups": frozenset({"call"}),
    "thresholds": frozenset({"call"}),
    "videos": frozenset({"call", "video"}),
}

# view_resource_relation (view_type → resource_type)
VIEW_RESOURCES: dict[str, frozenset[str]] = {
    "benchmark_attempts": frozenset(
        {
            "cohorts",
            "departments",
            "profiles",
            "simulations",
        }
    ),
    "benchmark_chats": frozenset(
        {
            "personas",
            "profiles",
            "rubrics",
            "scenarios",
            "simulations",
        }
    ),
    "benchmark_history": frozenset(
        {
            "cohorts",
            "departments",
            "personas",
            "profiles",
            "scenarios",
            "simulations",
        }
    ),
    "benchmark_messages": frozenset(
        {
            "personas",
            "profiles",
            "scenarios",
            "simulations",
        }
    ),
    "benchmark_overview": frozenset(
        {
            "cohorts",
            "departments",
            "personas",
            "profiles",
            "rubrics",
            "simulations",
        }
    ),
    "simulation_attempts": frozenset(
        {
            "cohorts",
            "departments",
            "profiles",
            "simulations",
        }
    ),
    "simulation_chats": frozenset(
        {
            "documents",
            "images",
            "objectives",
            "options",
            "personas",
            "problem_statements",
            "profiles",
            "questions",
            "rubrics",
            "scenarios",
            "simulations",
            "standard_groups",
            "standards",
            "videos",
        }
    ),
    "simulation_history": frozenset(
        {
            "cohorts",
            "departments",
            "personas",
            "profiles",
            "scenarios",
            "simulations",
        }
    ),
    "simulation_messages": frozenset(
        {
            "personas",
            "profiles",
            "scenarios",
            "simulations",
        }
    ),
    "simulation_overview": frozenset(
        {
            "cohorts",
            "departments",
            "personas",
            "profiles",
            "rubrics",
            "simulations",
        }
    ),
}

# artifact_resources_relation (artifact_type → resource_type)
ARTIFACT_RESOURCES: dict[str, frozenset[str]] = {
    "agent": frozenset(
        {
            "agents",
            "departments",
            "descriptions",
            "flags",
            "instructions",
            "models",
            "names",
            "prompts",
            "reasoning_levels",
            "temperature_levels",
            "tools",
            "voices",
        }
    ),
    "auth": frozenset(
        {
            "auths",
            "departments",
            "descriptions",
            "flags",
            "items",
            "names",
            "protocols",
            "slugs",
        }
    ),
    "cohort": frozenset(
        {
            "cohorts",
            "departments",
            "descriptions",
            "flags",
            "names",
            "simulation_positions",
            "simulations",
        }
    ),
    "department": frozenset({"departments", "descriptions", "flags", "names", "settings"}),
    "document": frozenset(
        {
            "departments",
            "descriptions",
            "documents",
            "flags",
            "names",
            "parameter_fields",
            "parameters",
        }
    ),
    "eval": frozenset(
        {
            "departments",
            "descriptions",
            "evals",
            "flags",
            "group_positions",
            "groups",
            "names",
            "run_positions",
            "runs",
        }
    ),
    "field": frozenset(
        {
            "conditional_parameters",
            "departments",
            "descriptions",
            "fields",
            "flags",
            "names",
        }
    ),
    "model": frozenset(
        {
            "departments",
            "descriptions",
            "flags",
            "modalities",
            "models",
            "names",
            "pricing",
            "providers",
            "qualities",
            "reasoning_levels",
            "temperature_levels",
            "values",
            "voices",
        }
    ),
    "parameter": frozenset(
        {"departments", "descriptions", "fields", "flags", "names", "parameters"}
    ),
    "persona": frozenset(
        {
            "colors",
            "departments",
            "descriptions",
            "examples",
            "flags",
            "icons",
            "instructions",
            "names",
            "parameter_fields",
            "parameters",
            "personas",
        }
    ),
    "profile": frozenset(
        {
            "cohorts",
            "departments",
            "emails",
            "flags",
            "names",
            "profiles",
            "request_limits",
            "roles",
            "routes",
        }
    ),
    "provider": frozenset(
        {
            "departments",
            "descriptions",
            "endpoints",
            "flags",
            "keys",
            "names",
            "providers",
            "values",
        }
    ),
    "rubric": frozenset(
        {
            "departments",
            "descriptions",
            "flags",
            "names",
            "points",
            "rubrics",
            "standard_groups",
            "standards",
        }
    ),
    "scenario": frozenset(
        {
            "departments",
            "descriptions",
            "documents",
            "flags",
            "images",
            "names",
            "objectives",
            "options",
            "parameter_fields",
            "parameters",
            "personas",
            "problem_statements",
            "questions",
            "scenarios",
            "videos",
        }
    ),
    "setting": frozenset(
        {
            "agents",
            "auth_item_keys",
            "auths",
            "colors",
            "departments",
            "descriptions",
            "flags",
            "names",
            "profiles",
            "provider_keys",
            "role_routes",
            "roles",
            "settings",
            "thresholds",
        }
    ),
    "simulation": frozenset(
        {
            "departments",
            "descriptions",
            "flags",
            "names",
            "scenario_flags",
            "scenario_personas",
            "scenario_positions",
            "scenario_rubrics",
            "scenario_time_limits",
            "scenarios",
            "simulations",
        }
    ),
    "tool": frozenset(
        {
            "arg_positions",
            "args",
            "args_outputs",
            "bindings",
            "departments",
            "descriptions",
            "domains",
            "flags",
            "names",
            "tools",
        }
    ),
}

# artifact_view_relation (artifact_type → view_type)
ARTIFACT_VIEWS: dict[str, frozenset[str]] = {
    "attempt": frozenset({"simulation_attempts", "simulation_chats", "simulation_messages"}),
    "benchmark": frozenset(
        {
            "benchmark_attempts",
            "benchmark_chats",
            "benchmark_history",
            "benchmark_messages",
            "benchmark_overview",
        }
    ),
    "dashboard": frozenset({"simulation_history", "simulation_overview"}),
    "home": frozenset(
        {
            "simulation_attempts",
            "simulation_chats",
            "simulation_history",
            "simulation_messages",
            "simulation_overview",
        }
    ),
    "leaderboard": frozenset({"simulation_overview"}),
    "practice": frozenset(
        {
            "simulation_attempts",
            "simulation_chats",
            "simulation_history",
            "simulation_messages",
            "simulation_overview",
        }
    ),
    "reports": frozenset(
        {
            "simulation_attempts",
            "simulation_chats",
            "simulation_history",
            "simulation_messages",
            "simulation_overview",
        }
    ),
    "test": frozenset({"benchmark_attempts", "benchmark_chats", "benchmark_messages"}),
}

# view_entry_relation (view_type → entry_type)
VIEW_ENTRIES: dict[str, frozenset[str]] = {
    "benchmark_messages": frozenset({"highlights", "messages", "replacements"}),
    "simulation_messages": frozenset({"highlights", "messages", "replacements"}),
}
