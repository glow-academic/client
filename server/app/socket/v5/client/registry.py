"""Artifact configuration registry for unified generation.

Maps artifact_type → ArtifactGenerateConfig, encapsulating all the per-artifact
differences (fetcher, SQL paths, resource attr names, etc.) so the unified
generate handler can work for every draft artifact type.
"""

from __future__ import annotations

from collections.abc import Callable, Coroutine
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

import asyncpg

# ---------------------------------------------------------------------------
# Config dataclass
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ArtifactGenerateConfig:
    """Everything the unified generate handler needs to know per artifact."""

    artifact_type: str

    # Valid resource types for this artifact
    valid_resource_types: list[str]

    # SQL path for prepare_{artifact}_generation_complete
    prepare_sql_path: str

    # Jinja context key for the draft view (e.g. "draft_agent")
    draft_view_key: str

    # Attribute names on result.config for config chain
    config_agents_attr: str = "agents"
    config_models_attr: str = "models"
    config_providers_attr: str = "providers"
    config_tools_attr: str = "tools"
    config_args_outputs_attr: str = "args_outputs"

    # Whether draft_id is required (most artifacts require it)
    requires_draft: bool = True

    # Whether this artifact has a canonical artifact_id (draft artifacts only)
    has_artifact_id: bool = True

    # Whether the fetcher requires an explicit pool argument
    requires_pool: bool = False

    # The kwarg name for the artifact's ID in the fetcher call
    # e.g. "agent_id", "chat_entry_id" — empty for non-ID artifacts
    fetcher_id_kwarg: str = ""

    # Whether the fetcher requires an explicit connection (attempt, test)
    needs_conn: bool = False

    # Module path and function name for the fetcher (for direct import in artifact tools)
    fetcher_module: str = ""
    fetcher_func: str = ""

    # Async entry types for this artifact
    entry_types: list[str] = field(default_factory=lambda: ["debug_info"])

    # Extra fields to forward from the client payload to generate_artifact emit
    extra_emit_fields: list[str] = field(default_factory=list)

    # Async fetcher adapter — uniform signature:
    #   (profile_id, artifact_id, draft_id, pool) -> response
    fetcher: (
        Callable[
            [UUID, UUID | None, UUID | None, asyncpg.Pool | None],
            Coroutine[Any, Any, object],
        ]
        | None
    ) = None


# ---------------------------------------------------------------------------
# Fetcher adapters
#
# Each normalises the unique websocket-fetcher signature into:
#   (profile_id, artifact_id, draft_id, pool) -> response
# ---------------------------------------------------------------------------


async def _fetch_standard(
    module_path: str,
    func_name: str,
    id_kwarg: str,
    profile_id: UUID,
    artifact_id: UUID | None,
    draft_id: UUID | None,
    pool: asyncpg.Pool | None,  # noqa: ARG001
) -> object:
    """Standard fetcher: get_*_websocket(profile_id, <id_kwarg>, draft_id)."""
    import importlib

    mod = importlib.import_module(module_path)
    fn = getattr(mod, func_name)
    kwargs: dict[str, object] = {"profile_id": profile_id, "draft_id": draft_id}
    if id_kwarg:
        kwargs[id_kwarg] = artifact_id
    return await fn(**kwargs)


async def _fetch_with_pool(
    module_path: str,
    func_name: str,
    id_kwarg: str,
    profile_id: UUID,
    artifact_id: UUID | None,
    draft_id: UUID | None,
    pool: asyncpg.Pool | None,
) -> object:
    """Pool-based fetcher: get_*_websocket(pool, profile_id, [<id_kwarg>,] draft_id)."""
    import importlib

    if pool is None:
        raise RuntimeError("Database pool required but not available")
    mod = importlib.import_module(module_path)
    fn = getattr(mod, func_name)
    kwargs: dict[str, object] = {
        "pool": pool,
        "profile_id": profile_id,
        "draft_id": draft_id,
    }
    if id_kwarg:
        kwargs[id_kwarg] = artifact_id
    return await fn(**kwargs)


async def _fetch_with_conn(
    module_path: str,
    func_name: str,
    id_kwarg: str,
    profile_id: UUID,
    artifact_id: UUID | None,
    draft_id: UUID | None,  # noqa: ARG001
    pool: asyncpg.Pool | None,  # noqa: ARG001
) -> object:
    """Conn-based fetcher: get_*_websocket(conn, profile_id, <id_kwarg>).

    Used by attempt/test which take a raw connection, not pool or kwargs.
    Acquires a connection via get_db_connection().
    """
    import importlib

    from app.infra.v4.websocket.get_db_connection import get_db_connection

    mod = importlib.import_module(module_path)
    fn = getattr(mod, func_name)
    async with get_db_connection() as conn:
        kwargs: dict[str, object] = {"conn": conn, "profile_id": profile_id}
        if id_kwarg:
            kwargs[id_kwarg] = artifact_id
        return await fn(**kwargs)


def _make_fetcher(
    module_path: str,
    func_name: str,
    id_kwarg: str,
    *,
    needs_pool: bool = False,
    needs_conn: bool = False,
) -> Callable[
    [UUID, UUID | None, UUID | None, asyncpg.Pool | None],
    Coroutine[Any, Any, object],
]:
    """Create a fetcher closure with the right call convention."""

    async def _fetcher(
        profile_id: UUID,
        artifact_id: UUID | None,
        draft_id: UUID | None,
        pool: asyncpg.Pool | None,
    ) -> object:
        if needs_conn:
            return await _fetch_with_conn(
                module_path,
                func_name,
                id_kwarg,
                profile_id,
                artifact_id,
                draft_id,
                pool,
            )
        if needs_pool:
            return await _fetch_with_pool(
                module_path,
                func_name,
                id_kwarg,
                profile_id,
                artifact_id,
                draft_id,
                pool,
            )
        return await _fetch_standard(
            module_path,
            func_name,
            id_kwarg,
            profile_id,
            artifact_id,
            draft_id,
            pool,
        )

    return _fetcher


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

REGISTRY: dict[str, ArtifactGenerateConfig] = {}


def _register(config: ArtifactGenerateConfig) -> None:
    REGISTRY[config.artifact_type] = config


# === Standard artifacts (no pool, resources.agents/models/providers) ===

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
        prepare_sql_path="app/sql/v4/queries/generate/agent/prepare_agent_generation_complete.sql",
        draft_view_key="draft_agent",
        fetcher_id_kwarg="agent_id",
        fetcher_module="app.api.v4.artifacts.agent.get",
        fetcher_func="get_agent_websocket",
        fetcher=_make_fetcher(
            "app.api.v4.artifacts.agent.get",
            "get_agent_websocket",
            "agent_id",
        ),
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
        prepare_sql_path="app/sql/v4/queries/generate/auth/prepare_auth_generation_complete.sql",
        draft_view_key="draft_auth",
        fetcher_id_kwarg="auth_id",
        fetcher_module="app.api.v4.artifacts.auth.get",
        fetcher_func="get_auth_websocket",
        fetcher=_make_fetcher(
            "app.api.v4.artifacts.auth.get",
            "get_auth_websocket",
            "auth_id",
        ),
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
        prepare_sql_path="app/sql/v4/queries/generate/persona/prepare_persona_generation_complete.sql",
        draft_view_key="draft_persona",
        requires_draft=False,
        fetcher_id_kwarg="persona_id",
        fetcher_module="app.api.v4.artifacts.persona.get",
        fetcher_func="get_persona_websocket",
        fetcher=_make_fetcher(
            "app.api.v4.artifacts.persona.get",
            "get_persona_websocket",
            "persona_id",
        ),
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
        prepare_sql_path="app/sql/v4/queries/generate/scenario/prepare_scenario_generation_complete.sql",
        draft_view_key="draft_scenario",
        requires_draft=False,
        fetcher_id_kwarg="scenario_id",
        fetcher_module="app.api.v4.artifacts.scenario.get",
        fetcher_func="get_scenario_websocket",
        fetcher=_make_fetcher(
            "app.api.v4.artifacts.scenario.get",
            "get_scenario_websocket",
            "scenario_id",
        ),
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
        prepare_sql_path="app/sql/v4/queries/generate/simulation/prepare_simulation_generation_complete.sql",
        draft_view_key="draft_simulation",
        requires_draft=False,
        fetcher_id_kwarg="simulation_id",
        fetcher_module="app.api.v4.artifacts.simulation.get",
        fetcher_func="get_simulation_websocket",
        fetcher=_make_fetcher(
            "app.api.v4.artifacts.simulation.get",
            "get_simulation_websocket",
            "simulation_id",
        ),
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
        prepare_sql_path="app/sql/v4/queries/generate/cohort/prepare_cohort_generation_complete.sql",
        draft_view_key="draft_cohort",
        requires_draft=False,
        fetcher_id_kwarg="cohort_id",
        fetcher_module="app.api.v4.artifacts.cohort.get",
        fetcher_func="get_cohort_websocket",
        fetcher=_make_fetcher(
            "app.api.v4.artifacts.cohort.get",
            "get_cohort_websocket",
            "cohort_id",
        ),
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
        prepare_sql_path="app/sql/v4/queries/generate/document/prepare_document_generation_complete.sql",
        draft_view_key="draft_document",
        requires_draft=False,
        fetcher_id_kwarg="document_id",
        fetcher_module="app.api.v4.artifacts.document.get",
        fetcher_func="get_document_websocket",
        fetcher=_make_fetcher(
            "app.api.v4.artifacts.document.get",
            "get_document_websocket",
            "document_id",
        ),
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
        prepare_sql_path="app/sql/v4/queries/generate/profile/prepare_profile_generation_complete.sql",
        draft_view_key="draft_profile",
        fetcher_id_kwarg="target_profile_id",
        fetcher_module="app.api.v4.artifacts.profile.get",
        fetcher_func="get_profile_websocket",
        fetcher=_make_fetcher(
            "app.api.v4.artifacts.profile.get",
            "get_profile_websocket",
            "target_profile_id",
        ),
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
        prepare_sql_path="app/sql/v4/queries/generate/parameter/prepare_parameter_generation_complete.sql",
        draft_view_key="draft_parameter",
        fetcher_id_kwarg="parameter_id",
        fetcher_module="app.api.v4.artifacts.parameter.get",
        fetcher_func="get_parameter_websocket",
        fetcher=_make_fetcher(
            "app.api.v4.artifacts.parameter.get",
            "get_parameter_websocket",
            "parameter_id",
        ),
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
        prepare_sql_path="app/sql/v4/queries/generate/field/prepare_field_generation_complete.sql",
        draft_view_key="draft_field",
        fetcher_id_kwarg="field_id",
        fetcher_module="app.api.v4.artifacts.field.get",
        fetcher_func="get_field_websocket",
        fetcher=_make_fetcher(
            "app.api.v4.artifacts.field.get",
            "get_field_websocket",
            "field_id",
        ),
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
        prepare_sql_path="app/sql/v4/queries/generate/model/prepare_model_generation_complete.sql",
        draft_view_key="draft_model",
        fetcher_id_kwarg="model_id",
        fetcher_module="app.api.v4.artifacts.model.get",
        fetcher_func="get_model_websocket",
        fetcher=_make_fetcher(
            "app.api.v4.artifacts.model.get",
            "get_model_websocket",
            "model_id",
        ),
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
        prepare_sql_path="app/sql/v4/queries/generate/tool/prepare_tool_generation_complete.sql",
        draft_view_key="draft_tool",
        fetcher_id_kwarg="tool_id",
        fetcher_module="app.api.v4.artifacts.tool.get",
        fetcher_func="get_tool_websocket",
        fetcher=_make_fetcher(
            "app.api.v4.artifacts.tool.get",
            "get_tool_websocket",
            "tool_id",
        ),
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
        prepare_sql_path="app/sql/v4/queries/generate/department/prepare_department_generation_complete.sql",
        draft_view_key="draft_department",
        fetcher_id_kwarg="department_id",
        fetcher_module="app.api.v4.artifacts.department.get",
        fetcher_func="get_department_websocket",
        fetcher=_make_fetcher(
            "app.api.v4.artifacts.department.get",
            "get_department_websocket",
            "department_id",
        ),
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
        prepare_sql_path="app/sql/v4/queries/generate/provider/prepare_provider_generation_complete.sql",
        draft_view_key="draft_provider",
        fetcher_id_kwarg="provider_id",
        fetcher_module="app.api.v4.artifacts.provider.get",
        fetcher_func="get_provider_websocket",
        fetcher=_make_fetcher(
            "app.api.v4.artifacts.provider.get",
            "get_provider_websocket",
            "provider_id",
        ),
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
        prepare_sql_path="app/sql/v4/queries/generate/rubric/prepare_rubric_generation_complete.sql",
        draft_view_key="draft_rubric",
        fetcher_id_kwarg="rubric_id",
        fetcher_module="app.api.v4.artifacts.rubric.get",
        fetcher_func="get_rubric_websocket",
        fetcher=_make_fetcher(
            "app.api.v4.artifacts.rubric.get",
            "get_rubric_websocket",
            "rubric_id",
        ),
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
        prepare_sql_path="app/sql/v4/queries/generate/eval/prepare_eval_generation_complete.sql",
        draft_view_key="draft_eval",
        fetcher_id_kwarg="eval_id",
        fetcher_module="app.api.v4.artifacts.eval.get",
        fetcher_func="get_eval_websocket",
        fetcher=_make_fetcher(
            "app.api.v4.artifacts.eval.get",
            "get_eval_websocket",
            "eval_id",
        ),
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
        prepare_sql_path="app/sql/v4/queries/generate/setting/prepare_setting_generation_complete.sql",
        draft_view_key="draft_setting",
        fetcher_id_kwarg="setting_id",
        fetcher_module="app.api.v4.artifacts.setting.get",
        fetcher_func="get_setting_websocket",
        fetcher=_make_fetcher(
            "app.api.v4.artifacts.setting.get",
            "get_setting_websocket",
            "setting_id",
        ),
    )
)

# === Pool-based artifacts (requires_pool=True, config_agents/config_models/config_providers) ===

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
        prepare_sql_path="app/sql/v4/queries/generate/training/prepare_training_generation_complete.sql",
        draft_view_key="draft_chat",
        requires_pool=True,
        fetcher_id_kwarg="chat_entry_id",
        extra_emit_fields=["attempt_id", "attempt_chat_id"],
        fetcher_module="app.api.v4.artifacts.chat.get",
        fetcher_func="get_chat_websocket",
        fetcher=_make_fetcher(
            "app.api.v4.artifacts.chat.get",
            "get_chat_websocket",
            "chat_entry_id",
            needs_pool=True,
        ),
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
        prepare_sql_path="app/sql/v4/queries/generate/benchmark/prepare_benchmark_generation_complete.sql",
        draft_view_key="draft_invocation",
        has_artifact_id=False,
        requires_pool=True,
        fetcher_module="app.api.v4.artifacts.benchmark.get",
        fetcher_func="get_invocation_websocket",
        fetcher=_make_fetcher(
            "app.api.v4.artifacts.benchmark.get",
            "get_invocation_websocket",
            "",
            needs_pool=True,
        ),
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
        prepare_sql_path="app/sql/v4/queries/generate/suite/prepare_suite_generation_complete.sql",
        draft_view_key="draft_invocation",
        entry_types=[],
        requires_draft=False,
        requires_pool=True,
        fetcher_id_kwarg="benchmark_entry_id",
        fetcher_module="app.api.v4.artifacts.invocation.get",
        fetcher_func="get_invocation_websocket",
        fetcher=_make_fetcher(
            "app.api.v4.artifacts.invocation.get",
            "get_invocation_websocket",
            "benchmark_entry_id",
            needs_pool=True,
        ),
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
        prepare_sql_path="app/sql/v4/queries/generate/activity/prepare_activity_generation_complete.sql",
        draft_view_key="draft_activity",
        entry_types=["activity_insights", "debug_info"],
        requires_draft=False,
        has_artifact_id=False,
        requires_pool=True,
        fetcher_module="app.api.v4.artifacts.activity.get",
        fetcher_func="get_activity_websocket",
        fetcher=_make_fetcher(
            "app.api.v4.artifacts.activity.get",
            "get_activity_websocket",
            "",
            needs_pool=True,
        ),
    )
)

_register(
    ArtifactGenerateConfig(
        artifact_type="session",
        valid_resource_types=[
            "names",
            "descriptions",
            "flags",
            "departments",
        ],
        prepare_sql_path="app/sql/v4/queries/generate/session/prepare_session_generation_complete.sql",
        draft_view_key="draft_session",
        entry_types=["session_insights", "debug_info"],
        requires_draft=False,
        requires_pool=True,
        fetcher_id_kwarg="session_id",
        fetcher_module="app.api.v4.artifacts.session.get",
        fetcher_func="get_session_websocket",
        fetcher=_make_fetcher(
            "app.api.v4.artifacts.session.get",
            "get_session_websocket",
            "session_id",
            needs_pool=True,
        ),
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
        prepare_sql_path="app/sql/v4/queries/generate/pricing/prepare_pricing_generation_complete.sql",
        draft_view_key="draft_pricing",
        entry_types=["pricing_insights", "debug_info"],
        requires_draft=False,
        has_artifact_id=False,
        requires_pool=True,
        fetcher_module="app.api.v4.artifacts.pricing.get",
        fetcher_func="get_pricing_websocket",
        fetcher=_make_fetcher(
            "app.api.v4.artifacts.pricing.get",
            "get_pricing_websocket",
            "",
            needs_pool=True,
        ),
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
        prepare_sql_path="app/sql/v4/queries/generate/reports/prepare_reports_generation_complete.sql",
        draft_view_key="draft_reports",
        entry_types=["reports_insights", "debug_info"],
        requires_draft=False,
        has_artifact_id=False,
        requires_pool=True,
        fetcher_module="app.api.v4.artifacts.reports.get",
        fetcher_func="get_reports_websocket",
        fetcher=_make_fetcher(
            "app.api.v4.artifacts.reports.get",
            "get_reports_websocket",
            "",
            needs_pool=True,
        ),
    )
)

_register(
    ArtifactGenerateConfig(
        artifact_type="group",
        valid_resource_types=[
            "names",
            "descriptions",
            "flags",
            "departments",
        ],
        prepare_sql_path="app/sql/v4/queries/generate/group/prepare_group_generation_complete.sql",
        draft_view_key="draft_group",
        entry_types=["group_insights", "debug_info"],
        requires_draft=False,
        requires_pool=True,
        fetcher_id_kwarg="group_id",
        fetcher_module="app.api.v4.artifacts.group.get",
        fetcher_func="get_group_websocket",
        fetcher=_make_fetcher(
            "app.api.v4.artifacts.group.get",
            "get_group_websocket",
            "group_id",
            needs_pool=True,
        ),
    )
)

_register(
    ArtifactGenerateConfig(
        artifact_type="health",
        valid_resource_types=[
            "names",
            "descriptions",
            "flags",
            "departments",
        ],
        prepare_sql_path="app/sql/v4/queries/generate/health/prepare_health_generation_complete.sql",
        draft_view_key="draft_health",
        entry_types=["health_insights", "debug_info"],
        requires_draft=False,
        has_artifact_id=False,
        requires_pool=True,
        fetcher_module="app.api.v4.artifacts.health.get",
        fetcher_func="get_health_websocket",
        fetcher=_make_fetcher(
            "app.api.v4.artifacts.health.get",
            "get_health_websocket",
            "",
            needs_pool=True,
        ),
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
        prepare_sql_path="app/sql/v4/queries/generate/leaderboard/prepare_leaderboard_generation_complete.sql",
        draft_view_key="draft_leaderboard",
        entry_types=["leaderboard_insights", "debug_info"],
        requires_draft=False,
        has_artifact_id=False,
        requires_pool=True,
        fetcher_module="app.api.v4.artifacts.leaderboard.get",
        fetcher_func="get_leaderboard_websocket",
        fetcher=_make_fetcher(
            "app.api.v4.artifacts.leaderboard.get",
            "get_leaderboard_websocket",
            "",
            needs_pool=True,
        ),
    )
)

_register(
    ArtifactGenerateConfig(
        artifact_type="record",
        valid_resource_types=[
            "names",
            "descriptions",
            "flags",
            "departments",
        ],
        prepare_sql_path="app/sql/v4/queries/generate/record/prepare_record_generation_complete.sql",
        draft_view_key="draft_record",
        entry_types=["record_insights", "debug_info"],
        requires_draft=False,
        requires_pool=True,
        fetcher_id_kwarg="record_id",
        fetcher_module="app.api.v4.artifacts.record.get",
        fetcher_func="get_record_websocket",
        fetcher=_make_fetcher(
            "app.api.v4.artifacts.record.get",
            "get_record_websocket",
            "record_id",
            needs_pool=True,
        ),
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
        prepare_sql_path="app/sql/v4/queries/generate/dashboard/prepare_dashboard_generation_complete.sql",
        draft_view_key="draft_dashboard",
        entry_types=["dashboard_insights", "debug_info"],
        requires_draft=False,
        has_artifact_id=False,
        requires_pool=True,
        fetcher_module="app.api.v4.artifacts.dashboard.get",
        fetcher_func="get_dashboard_websocket",
        fetcher=_make_fetcher(
            "app.api.v4.artifacts.dashboard.get",
            "get_dashboard_websocket",
            "",
            needs_pool=True,
        ),
    )
)

# === No-ID, no resource types (home/practice — fetcher bug to fix) ===

_register(
    ArtifactGenerateConfig(
        artifact_type="home",
        valid_resource_types=[],
        prepare_sql_path="app/sql/v4/queries/generate/training/prepare_training_generation_complete.sql",
        draft_view_key="draft_training",
        entry_types=["home_insights", "debug_info"],
        requires_draft=False,
        has_artifact_id=False,
        requires_pool=True,
        fetcher_module="app.api.v4.artifacts.home.get",
        fetcher_func="get_home_websocket",
        fetcher=_make_fetcher(
            "app.api.v4.artifacts.home.get",
            "get_home_websocket",
            "",
            needs_pool=True,
        ),
    )
)

_register(
    ArtifactGenerateConfig(
        artifact_type="practice",
        valid_resource_types=[],
        prepare_sql_path="app/sql/v4/queries/generate/training/prepare_training_generation_complete.sql",
        draft_view_key="draft_training",
        entry_types=["practice_insights", "debug_info"],
        requires_draft=False,
        has_artifact_id=False,
        requires_pool=True,
        fetcher_module="app.api.v4.artifacts.practice.get",
        fetcher_func="get_practice_websocket",
        fetcher=_make_fetcher(
            "app.api.v4.artifacts.practice.get",
            "get_practice_websocket",
            "",
            needs_pool=True,
        ),
    )
)

# === Conn-based artifacts (attempt/test — use get_db_connection, no draft) ===

_register(
    ArtifactGenerateConfig(
        artifact_type="attempt",
        valid_resource_types=[
            "user_messages",
            "assistant_messages",
            "contents",
            "hints",
            "feedbacks",
            "strengths",
            "improvements",
            "analyses",
            "highlights",
            "replacements",
        ],
        prepare_sql_path="app/sql/v4/queries/generate/persona/prepare_persona_generation_complete.sql",
        draft_view_key="draft_attempt",
        requires_draft=False,
        entry_types=["attempt_insights", "debug_info"],
        fetcher_id_kwarg="attempt_id",
        extra_emit_fields=["attempt_id", "chat_id", "grade_id"],
        fetcher_module="app.api.v4.artifacts.attempt.get",
        fetcher_func="get_attempt_websocket",
        needs_conn=True,
        fetcher=_make_fetcher(
            "app.api.v4.artifacts.attempt.get",
            "get_attempt_websocket",
            "attempt_id",
            needs_conn=True,
        ),
    )
)

_register(
    ArtifactGenerateConfig(
        artifact_type="test",
        valid_resource_types=[
            "grades",
            "feedbacks",
        ],
        prepare_sql_path="app/sql/v4/queries/generate/persona/prepare_persona_generation_complete.sql",
        draft_view_key="draft_test",
        requires_draft=False,
        entry_types=["test_insights", "debug_info"],
        fetcher_id_kwarg="test_id",
        fetcher_module="app.api.v4.artifacts.test.get",
        fetcher_func="get_test_websocket",
        needs_conn=True,
        fetcher=_make_fetcher(
            "app.api.v4.artifacts.test.get",
            "get_test_websocket",
            "test_id",
            needs_conn=True,
        ),
    )
)
