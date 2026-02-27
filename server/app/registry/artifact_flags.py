"""artifact_flags_relation (artifact_type → flag_type)."""

from __future__ import annotations

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
