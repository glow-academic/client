"""entry_resource_relation (entry_type → resource_type)."""

from __future__ import annotations

ENTRY_RESOURCES: dict[str, frozenset[str]] = {
    "args_outputs_values": frozenset({"args_outputs"}),
    "args_values": frozenset({"args"}),
    "attempt": frozenset({"profiles"}),
    "attempt_chat": frozenset(
        {
            "departments",
            "descriptions",
            "documents",
            "images",
            "names",
            "objectives",
            "options",
            "parameter_fields",
            "parameters",
            "personas",
            "problem_statements",
            "questions",
            "rubrics",
            "standard_groups",
            "standards",
            "videos",
        }
    ),
    "audios": frozenset({"voices"}),
    "benchmark": frozenset(
        {
            "departments",
            "group_positions",
            "group_rubrics",
            "profiles",
            "run_positions",
            "run_rubrics",
        }
    ),
    "entries": frozenset({"entries"}),
    "chat": frozenset(
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
            "rubrics",
            "scenario_flags",
            "scenario_positions",
            "scenario_time_limits",
            "scenarios",
            "standard_groups",
            "standards",
            "videos",
        }
    ),
    "config": frozenset({"agents", "models", "providers"}),
    "resources": frozenset({"resources"}),
    "emulations": frozenset({"profiles"}),
    "grants": frozenset({"profiles"}),
    "groups": frozenset({"groups"}),
    "home": frozenset(
        {
            "cohorts",
            "departments",
            "profile_personas",
            "profiles",
            "simulation_availability",
            "simulation_positions",
            "simulations",
        }
    ),
    "images": frozenset({"images", "qualities"}),
    "invocation": frozenset(
        {
            "departments",
            "descriptions",
            "flags",
            "groups",
            "instructions",
            "keys",
            "names",
            "prompts",
            "reasoning_levels",
            "runs",
            "temperature_levels",
            "tools",
            "voices",
        }
    ),
    "logins": frozenset({"profiles"}),
    "personas": frozenset({"personas"}),
    "practice": frozenset(
        {
            "cohorts",
            "departments",
            "profile_personas",
            "profiles",
            "simulation_availability",
            "simulation_positions",
            "simulations",
        }
    ),
    "problems": frozenset({"profiles"}),
    "responses": frozenset({"options", "questions"}),
    "run_pricing": frozenset({"pricing"}),
    "runs": frozenset({"keys", "profiles", "runs", "tools"}),
    "test": frozenset({"departments", "evals", "profiles", "roles"}),
    "texts": frozenset({"texts"}),
    "uploads": frozenset({"uploads"}),
    "videos": frozenset({"videos"}),
}
