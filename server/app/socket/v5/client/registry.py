"""Artifact configuration registry.

Maps artifact_type → ArtifactGenerateConfig, encapsulating per-artifact
metadata (valid resource types, entry types, SQL paths, draft view keys).
"""

from __future__ import annotations

from dataclasses import dataclass, field

# ---------------------------------------------------------------------------
# Config dataclass
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ArtifactGenerateConfig:
    """Per-artifact configuration metadata."""

    artifact_type: str

    # Valid resource types for this artifact
    valid_resource_types: list[str]

    # SQL path for prepare_{artifact}_generation_complete
    prepare_sql_path: str

    # Jinja context key for the draft view (e.g. "draft_agent")
    draft_view_key: str

    # Whether draft_id is required (most artifacts require it)
    requires_draft: bool = True

    # Whether this artifact has a canonical artifact_id (draft artifacts only)
    has_artifact_id: bool = True

    # The kwarg name for the artifact's ID in the fetcher call
    # e.g. "agent_id", "chat_entry_id" — empty for non-ID artifacts
    fetcher_id_kwarg: str = ""

    # Async entry types for this artifact
    entry_types: list[str] = field(default_factory=lambda: ["problems", "messages"])


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

REGISTRY: dict[str, ArtifactGenerateConfig] = {}


def _register(config: ArtifactGenerateConfig) -> None:
    REGISTRY[config.artifact_type] = config


# === Standard artifacts ===

_register(
    ArtifactGenerateConfig(
        artifact_type="agent",
        valid_resource_types=[
            "names",
            "descriptions",
            "models",
            "prompts",
            "instructions",
            "flags",
            "departments",
            "tools",
            "temperature_levels",
            "reasoning_levels",
            "voices",
        ],
        prepare_sql_path="app/sql/queries/generate/agent/prepare_agent_generation_complete.sql",
        draft_view_key="draft_agent",
        fetcher_id_kwarg="agent_id",
    )
)

_register(
    ArtifactGenerateConfig(
        artifact_type="auth",
        valid_resource_types=[
            "names",
            "descriptions",
            "flags",
            "protocols",
            "slugs",
            "items",
        ],
        prepare_sql_path="app/sql/queries/generate/auth/prepare_auth_generation_complete.sql",
        draft_view_key="draft_auth",
        fetcher_id_kwarg="auth_id",
    )
)

_register(
    ArtifactGenerateConfig(
        artifact_type="persona",
        valid_resource_types=[
            "names",
            "descriptions",
            "colors",
            "icons",
            "instructions",
            "flags",
            "examples",
            "parameter_fields",
            "departments",
            "voices",
        ],
        prepare_sql_path="app/sql/queries/generate/persona/prepare_persona_generation_complete.sql",
        draft_view_key="draft_persona",
        requires_draft=False,
        fetcher_id_kwarg="persona_id",
    )
)

_register(
    ArtifactGenerateConfig(
        artifact_type="scenario",
        valid_resource_types=[
            "names",
            "descriptions",
            "problem_statements",
            "objectives",
            "scenario_flags",
            "images",
            "videos",
            "questions",
            "departments",
            "parameter_fields",
            "personas",
            "documents",
        ],
        prepare_sql_path="app/sql/queries/generate/scenario/prepare_scenario_generation_complete.sql",
        draft_view_key="draft_scenario",
        requires_draft=False,
        fetcher_id_kwarg="scenario_id",
    )
)

_register(
    ArtifactGenerateConfig(
        artifact_type="simulation",
        valid_resource_types=[
            "names",
            "descriptions",
            "departments",
            "flags",
            "scenarios",
            "scenario_flags",
            "scenario_positions",
            "scenario_rubrics",
            "scenario_time_limits",
        ],
        prepare_sql_path="app/sql/queries/generate/simulation/prepare_simulation_generation_complete.sql",
        draft_view_key="draft_simulation",
        requires_draft=False,
        fetcher_id_kwarg="simulation_id",
    )
)

_register(
    ArtifactGenerateConfig(
        artifact_type="cohort",
        valid_resource_types=[
            "names",
            "descriptions",
            "flags",
            "departments",
            "simulations",
            "simulation_positions",
            "simulation_availability",
            "profiles",
            "profile_personas",
        ],
        prepare_sql_path="app/sql/queries/generate/cohort/prepare_cohort_generation_complete.sql",
        draft_view_key="draft_cohort",
        requires_draft=False,
        fetcher_id_kwarg="cohort_id",
    )
)

_register(
    ArtifactGenerateConfig(
        artifact_type="document",
        valid_resource_types=[
            "names",
            "descriptions",
            "flags",
            "departments",
            "fields",
            "uploads",
            "images",
            "texts",
        ],
        prepare_sql_path="app/sql/queries/generate/document/prepare_document_generation_complete.sql",
        draft_view_key="draft_document",
        requires_draft=False,
        fetcher_id_kwarg="document_id",
    )
)

_register(
    ArtifactGenerateConfig(
        artifact_type="profile",
        valid_resource_types=[
            "names",
            "flags",
            "request_limits",
            "departments",
            "emails",
            "cohorts",
        ],
        prepare_sql_path="app/sql/queries/generate/profile/prepare_profile_generation_complete.sql",
        draft_view_key="draft_profile",
        fetcher_id_kwarg="target_profile_id",
    )
)

_register(
    ArtifactGenerateConfig(
        artifact_type="parameter",
        valid_resource_types=[
            "names",
            "descriptions",
            "flags",
            "departments",
            "fields",
        ],
        prepare_sql_path="app/sql/queries/generate/parameter/prepare_parameter_generation_complete.sql",
        draft_view_key="draft_parameter",
        fetcher_id_kwarg="parameter_id",
    )
)

_register(
    ArtifactGenerateConfig(
        artifact_type="field",
        valid_resource_types=[
            "names",
            "descriptions",
            "flags",
            "departments",
            "conditional_parameters",
        ],
        prepare_sql_path="app/sql/queries/generate/field/prepare_field_generation_complete.sql",
        draft_view_key="draft_field",
        fetcher_id_kwarg="field_id",
    )
)

_register(
    ArtifactGenerateConfig(
        artifact_type="model",
        valid_resource_types=[
            "names",
            "descriptions",
            "values",
            "providers",
            "flags",
            "departments",
            "modalities",
            "temperature_levels",
            "pricing",
            "reasoning_levels",
            "qualities",
            "voices",
        ],
        prepare_sql_path="app/sql/queries/generate/model/prepare_model_generation_complete.sql",
        draft_view_key="draft_model",
        fetcher_id_kwarg="model_id",
    )
)

_register(
    ArtifactGenerateConfig(
        artifact_type="tool",
        valid_resource_types=[
            "names",
            "descriptions",
            "args",
            "arg_positions",
            "args_outputs",
            "flags",
        ],
        prepare_sql_path="app/sql/queries/generate/tool/prepare_tool_generation_complete.sql",
        draft_view_key="draft_tool",
        fetcher_id_kwarg="tool_id",
    )
)

_register(
    ArtifactGenerateConfig(
        artifact_type="department",
        valid_resource_types=[
            "names",
            "descriptions",
            "flags",
            "settings",
        ],
        prepare_sql_path="app/sql/queries/generate/department/prepare_department_generation_complete.sql",
        draft_view_key="draft_department",
        fetcher_id_kwarg="department_id",
    )
)

_register(
    ArtifactGenerateConfig(
        artifact_type="provider",
        valid_resource_types=[
            "names",
            "descriptions",
            "flags",
            "departments",
            "values",
            "endpoints",
        ],
        prepare_sql_path="app/sql/queries/generate/provider/prepare_provider_generation_complete.sql",
        draft_view_key="draft_provider",
        fetcher_id_kwarg="provider_id",
    )
)

_register(
    ArtifactGenerateConfig(
        artifact_type="rubric",
        valid_resource_types=[
            "names",
            "descriptions",
            "departments",
            "flags",
            "points",
            "pass_points",
            "standard_groups",
            "standards",
        ],
        prepare_sql_path="app/sql/queries/generate/rubric/prepare_rubric_generation_complete.sql",
        draft_view_key="draft_rubric",
        fetcher_id_kwarg="rubric_id",
    )
)

_register(
    ArtifactGenerateConfig(
        artifact_type="eval",
        valid_resource_types=[
            "names",
            "descriptions",
            "flags",
            "departments",
            "agents",
            "run_positions",
            "group_positions",
            "run_rubrics",
            "group_rubrics",
            "rubrics",
        ],
        prepare_sql_path="app/sql/queries/generate/eval/prepare_eval_generation_complete.sql",
        draft_view_key="draft_eval",
        fetcher_id_kwarg="eval_id",
    )
)

_register(
    ArtifactGenerateConfig(
        artifact_type="setting",
        valid_resource_types=[
            "names",
            "descriptions",
            "colors",
            "flags",
            "departments",
            "profiles",
            "auths",
            "provider_keys",
            "auth_item_keys",
            "roles",
        ],
        prepare_sql_path="app/sql/queries/generate/setting/prepare_setting_generation_complete.sql",
        draft_view_key="draft_setting",
        fetcher_id_kwarg="setting_id",
    )
)

# === Pool-based artifacts ===

_register(
    ArtifactGenerateConfig(
        artifact_type="chat",
        valid_resource_types=[
            "departments",
            "personas",
            "documents",
            "parameter_fields",
            "scenarios",
            "parameters",
            "fields",
            "questions",
            "options",
            "videos",
            "images",
            "templates",
            "problem_statements",
            "objectives",
        ],
        prepare_sql_path="app/sql/queries/generate/training/prepare_training_generation_complete.sql",
        draft_view_key="draft_chat",
        fetcher_id_kwarg="chat_entry_id",
    )
)

_register(
    ArtifactGenerateConfig(
        artifact_type="benchmark",
        valid_resource_types=[
            "departments",
            "models",
            "prompts",
            "instructions",
            "voices",
            "temperature_levels",
            "reasoning_levels",
            "tools",
            "keys",
        ],
        prepare_sql_path="app/sql/queries/generate/benchmark/prepare_benchmark_generation_complete.sql",
        draft_view_key="draft_invocation",
        has_artifact_id=False,
    )
)

_register(
    ArtifactGenerateConfig(
        artifact_type="invocation",
        valid_resource_types=[
            "departments",
            "models",
            "prompts",
            "instructions",
            "voices",
            "temperature_levels",
            "reasoning_levels",
            "tools",
            "keys",
        ],
        prepare_sql_path="app/sql/queries/generate/suite/prepare_suite_generation_complete.sql",
        draft_view_key="draft_invocation",
        entry_types=[],
        requires_draft=False,
        fetcher_id_kwarg="benchmark_entry_id",
    )
)

_register(
    ArtifactGenerateConfig(
        artifact_type="activity",
        valid_resource_types=[
            "names",
            "descriptions",
            "flags",
            "departments",
        ],
        prepare_sql_path="app/sql/queries/generate/activity/prepare_activity_generation_complete.sql",
        draft_view_key="draft_activity",
        entry_types=["problems", "messages"],
        requires_draft=False,
        has_artifact_id=False,
    )
)

_register(
    ArtifactGenerateConfig(
        artifact_type="pricing",
        valid_resource_types=[
            "names",
            "descriptions",
            "flags",
            "departments",
        ],
        prepare_sql_path="app/sql/queries/generate/pricing/prepare_pricing_generation_complete.sql",
        draft_view_key="draft_pricing",
        entry_types=["problems", "messages"],
        requires_draft=False,
        has_artifact_id=False,
    )
)

_register(
    ArtifactGenerateConfig(
        artifact_type="reports",
        valid_resource_types=[
            "names",
            "descriptions",
            "flags",
            "departments",
        ],
        prepare_sql_path="app/sql/queries/generate/reports/prepare_reports_generation_complete.sql",
        draft_view_key="draft_reports",
        entry_types=["problems", "messages"],
        requires_draft=False,
        has_artifact_id=False,
    )
)

_register(
    ArtifactGenerateConfig(
        artifact_type="leaderboard",
        valid_resource_types=[
            "names",
            "descriptions",
            "flags",
            "departments",
        ],
        prepare_sql_path="app/sql/queries/generate/leaderboard/prepare_leaderboard_generation_complete.sql",
        draft_view_key="draft_leaderboard",
        entry_types=["problems", "messages"],
        requires_draft=False,
        has_artifact_id=False,
    )
)

_register(
    ArtifactGenerateConfig(
        artifact_type="dashboard",
        valid_resource_types=[
            "names",
            "descriptions",
            "flags",
            "departments",
        ],
        prepare_sql_path="app/sql/queries/generate/dashboard/prepare_dashboard_generation_complete.sql",
        draft_view_key="draft_dashboard",
        entry_types=["problems", "messages"],
        requires_draft=False,
        has_artifact_id=False,
    )
)

_register(
    ArtifactGenerateConfig(
        artifact_type="home",
        valid_resource_types=[],
        prepare_sql_path="app/sql/queries/generate/training/prepare_training_generation_complete.sql",
        draft_view_key="draft_training",
        entry_types=["problems", "messages"],
        requires_draft=False,
        has_artifact_id=False,
    )
)

_register(
    ArtifactGenerateConfig(
        artifact_type="practice",
        valid_resource_types=[],
        prepare_sql_path="app/sql/queries/generate/training/prepare_training_generation_complete.sql",
        draft_view_key="draft_training",
        entry_types=["problems", "messages"],
        requires_draft=False,
        has_artifact_id=False,
    )
)

# === Conn-based artifacts (attempt/test) ===

_register(
    ArtifactGenerateConfig(
        artifact_type="attempt",
        valid_resource_types=[
            "scenarios",
            "personas",
            "documents",
            "images",
            "videos",
            "objectives",
            "questions",
            "options",
            "problem_statements",
            "rubrics",
            "standard_groups",
            "standards",
        ],
        prepare_sql_path="app/sql/queries/generate/persona/prepare_persona_generation_complete.sql",
        draft_view_key="draft_attempt",
        requires_draft=False,
        entry_types=[
            "contents",
            "hints",
            "feedbacks",
            "strengths",
            "improvements",
            "analyses",
            "highlights",
            "replacements",
            "problems",
            "messages",
        ],
        fetcher_id_kwarg="attempt_id",
    )
)

_register(
    ArtifactGenerateConfig(
        artifact_type="test",
        valid_resource_types=[
            "grades",
            "feedbacks",
        ],
        prepare_sql_path="app/sql/queries/generate/persona/prepare_persona_generation_complete.sql",
        draft_view_key="draft_test",
        requires_draft=False,
        entry_types=["problems", "messages"],
        fetcher_id_kwarg="test_id",
    )
)
