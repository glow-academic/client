"""artifact_resources_relation (artifact_type → resource_type)."""

from __future__ import annotations

ARTIFACT_RESOURCES: dict[str, frozenset[str]] = {
    "agent": frozenset(
        {
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
            "departments",
            "descriptions",
            "flags",
            "names",
            "profile_personas",
            "profiles",
            "simulation_availability",
            "simulation_positions",
            "simulations",
        }
    ),
    "department": frozenset(
        {
            "descriptions",
            "flags",
            "names",
            "settings",
        }
    ),
    "document": frozenset(
        {
            "departments",
            "descriptions",
            "flags",
            "images",
            "names",
            "parameter_fields",
            "parameters",
            "texts",
            "uploads",
        }
    ),
    "eval": frozenset(
        {
            "departments",
            "descriptions",
            "flags",
            "group_positions",
            "group_rubrics",
            "groups",
            "names",
            "run_positions",
            "run_rubrics",
            "runs",
        }
    ),
    "field": frozenset(
        {
            "conditional_parameters",
            "departments",
            "descriptions",
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
        {
            "departments",
            "descriptions",
            "fields",
            "flags",
            "names",
        }
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
            "voices",
        }
    ),
    "profile": frozenset(
        {
            "departments",
            "emails",
            "flags",
            "names",
            "request_limits",
            "roles",
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
            "personas",
            "problem_statements",
            "questions",
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
            "items",
            "names",
            "profiles",
            "provider_keys",
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
            "scenario_positions",
            "scenario_rubrics",
            "scenario_time_limits",
            "scenarios",
        }
    ),
    "tool": frozenset(
        {
            "arg_positions",
            "args",
            "args_outputs",
            "artifacts",
            "departments",
            "descriptions",
            "entries",
            "flags",
            "names",
            "operations",
            "resources",
        }
    ),
}
