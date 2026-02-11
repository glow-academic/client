"""Get endpoints for per-artifact draft views."""

from typing import Any, TypeVar
from uuid import UUID

import asyncpg

from app.api.v4.views.drafts.types import (
    DraftAgentViewItem,
    DraftAuthViewItem,
    DraftCohortViewItem,
    DraftDepartmentViewItem,
    DraftDocumentViewItem,
    DraftEvalViewItem,
    DraftFieldViewItem,
    DraftModelViewItem,
    DraftParameterViewItem,
    DraftPersonaViewItem,
    DraftProfileViewItem,
    DraftProviderViewItem,
    DraftRubricViewItem,
    DraftScenarioViewItem,
    DraftSettingViewItem,
    DraftSimulationViewItem,
    DraftToolViewItem,
    DraftTrainingViewItem,
    DraftViewItemBase,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# === Generic helper to build a draft view item from SQL result ===

T = TypeVar("T", bound=DraftViewItemBase)


def _build_item(item_cls: type[T], item: Any) -> T:
    """Build a typed draft view item from a SQL composite row."""
    data: dict[str, Any] = {
        "draft_id": item.draft_id,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
        "version": item.version or 0,
        "generated": item.generated or False,
        "mcp": item.mcp or False,
        "active": item.active if item.active is not None else True,
        "group_id": item.group_id,
    }
    # Dynamically add all uuid[] fields from the item
    for field_name in item_cls.model_fields:
        if field_name in data:
            continue
        val = getattr(item, field_name, None)
        data[field_name] = list(val) if val else []
    return item_cls(**data)


async def _get_draft_internal(
    conn: asyncpg.Connection,
    draft_ids: list[UUID],
    artifact: str,
    sql_path: str,
    item_cls: type[T],
    bypass_cache: bool = False,
) -> list[T]:
    """Generic internal function for fetching per-artifact draft view rows."""
    cache_key_val = cache_key(
        f"views/drafts/{artifact}/get",
        {"draft_ids": [str(d) for d in draft_ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [item_cls.model_validate(item) for item in cached["items"]]

    # Lazy import to avoid circular imports and allow sql-compile to generate types
    from app.sql import types as sql_types

    params_cls_name = f"GetDraft{artifact.title()}ViewSqlParams"
    params_cls = getattr(sql_types, params_cls_name)
    params = params_cls(draft_ids=draft_ids)
    result = await execute_sql_typed(conn, sql_path, params=params)

    items: list[T] = []
    if result and result.items:
        for item in result.items:
            items.append(_build_item(item_cls, item))

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["views", "drafts"],
    )

    return items


# === Per-artifact internal functions ===

_SQL_BASE = "app/sql/v4/queries/views/drafts"


async def get_draft_agent_internal(
    conn: asyncpg.Connection,
    draft_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[DraftAgentViewItem]:
    return await _get_draft_internal(
        conn,
        draft_ids,
        "agent",
        f"{_SQL_BASE}/get_draft_agent_view_complete.sql",
        DraftAgentViewItem,
        bypass_cache,
    )


async def get_draft_auth_internal(
    conn: asyncpg.Connection,
    draft_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[DraftAuthViewItem]:
    return await _get_draft_internal(
        conn,
        draft_ids,
        "auth",
        f"{_SQL_BASE}/get_draft_auth_view_complete.sql",
        DraftAuthViewItem,
        bypass_cache,
    )


async def get_draft_cohort_internal(
    conn: asyncpg.Connection,
    draft_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[DraftCohortViewItem]:
    return await _get_draft_internal(
        conn,
        draft_ids,
        "cohort",
        f"{_SQL_BASE}/get_draft_cohort_view_complete.sql",
        DraftCohortViewItem,
        bypass_cache,
    )


async def get_draft_department_internal(
    conn: asyncpg.Connection,
    draft_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[DraftDepartmentViewItem]:
    return await _get_draft_internal(
        conn,
        draft_ids,
        "department",
        f"{_SQL_BASE}/get_draft_department_view_complete.sql",
        DraftDepartmentViewItem,
        bypass_cache,
    )


async def get_draft_document_internal(
    conn: asyncpg.Connection,
    draft_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[DraftDocumentViewItem]:
    return await _get_draft_internal(
        conn,
        draft_ids,
        "document",
        f"{_SQL_BASE}/get_draft_document_view_complete.sql",
        DraftDocumentViewItem,
        bypass_cache,
    )


async def get_draft_eval_internal(
    conn: asyncpg.Connection,
    draft_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[DraftEvalViewItem]:
    return await _get_draft_internal(
        conn,
        draft_ids,
        "eval",
        f"{_SQL_BASE}/get_draft_eval_view_complete.sql",
        DraftEvalViewItem,
        bypass_cache,
    )


async def get_draft_field_internal(
    conn: asyncpg.Connection,
    draft_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[DraftFieldViewItem]:
    return await _get_draft_internal(
        conn,
        draft_ids,
        "field",
        f"{_SQL_BASE}/get_draft_field_view_complete.sql",
        DraftFieldViewItem,
        bypass_cache,
    )


async def get_draft_model_internal(
    conn: asyncpg.Connection,
    draft_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[DraftModelViewItem]:
    return await _get_draft_internal(
        conn,
        draft_ids,
        "model",
        f"{_SQL_BASE}/get_draft_model_view_complete.sql",
        DraftModelViewItem,
        bypass_cache,
    )


async def get_draft_parameter_internal(
    conn: asyncpg.Connection,
    draft_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[DraftParameterViewItem]:
    return await _get_draft_internal(
        conn,
        draft_ids,
        "parameter",
        f"{_SQL_BASE}/get_draft_parameter_view_complete.sql",
        DraftParameterViewItem,
        bypass_cache,
    )


async def get_draft_persona_internal(
    conn: asyncpg.Connection,
    draft_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[DraftPersonaViewItem]:
    return await _get_draft_internal(
        conn,
        draft_ids,
        "persona",
        f"{_SQL_BASE}/get_draft_persona_view_complete.sql",
        DraftPersonaViewItem,
        bypass_cache,
    )


async def get_draft_profile_internal(
    conn: asyncpg.Connection,
    draft_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[DraftProfileViewItem]:
    return await _get_draft_internal(
        conn,
        draft_ids,
        "profile",
        f"{_SQL_BASE}/get_draft_profile_view_complete.sql",
        DraftProfileViewItem,
        bypass_cache,
    )


async def get_draft_provider_internal(
    conn: asyncpg.Connection,
    draft_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[DraftProviderViewItem]:
    return await _get_draft_internal(
        conn,
        draft_ids,
        "provider",
        f"{_SQL_BASE}/get_draft_provider_view_complete.sql",
        DraftProviderViewItem,
        bypass_cache,
    )


async def get_draft_rubric_internal(
    conn: asyncpg.Connection,
    draft_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[DraftRubricViewItem]:
    return await _get_draft_internal(
        conn,
        draft_ids,
        "rubric",
        f"{_SQL_BASE}/get_draft_rubric_view_complete.sql",
        DraftRubricViewItem,
        bypass_cache,
    )


async def get_draft_scenario_internal(
    conn: asyncpg.Connection,
    draft_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[DraftScenarioViewItem]:
    return await _get_draft_internal(
        conn,
        draft_ids,
        "scenario",
        f"{_SQL_BASE}/get_draft_scenario_view_complete.sql",
        DraftScenarioViewItem,
        bypass_cache,
    )


async def get_draft_setting_internal(
    conn: asyncpg.Connection,
    draft_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[DraftSettingViewItem]:
    return await _get_draft_internal(
        conn,
        draft_ids,
        "setting",
        f"{_SQL_BASE}/get_draft_setting_view_complete.sql",
        DraftSettingViewItem,
        bypass_cache,
    )


async def get_draft_simulation_internal(
    conn: asyncpg.Connection,
    draft_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[DraftSimulationViewItem]:
    return await _get_draft_internal(
        conn,
        draft_ids,
        "simulation",
        f"{_SQL_BASE}/get_draft_simulation_view_complete.sql",
        DraftSimulationViewItem,
        bypass_cache,
    )


async def get_draft_tool_internal(
    conn: asyncpg.Connection,
    draft_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[DraftToolViewItem]:
    return await _get_draft_internal(
        conn,
        draft_ids,
        "tool",
        f"{_SQL_BASE}/get_draft_tool_view_complete.sql",
        DraftToolViewItem,
        bypass_cache,
    )


async def get_draft_training_internal(
    conn: asyncpg.Connection,
    draft_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[DraftTrainingViewItem]:
    return await _get_draft_internal(
        conn,
        draft_ids,
        "training",
        f"{_SQL_BASE}/get_draft_training_view_complete.sql",
        DraftTrainingViewItem,
        bypass_cache,
    )
