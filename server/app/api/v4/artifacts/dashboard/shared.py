"""Shared data-fetching helpers for dashboard section endpoints.

Extracted from get.py to enable reuse across header/primary/secondary/footer.
"""

from dataclasses import dataclass
from datetime import date, datetime
from typing import Any
from uuid import UUID

import asyncpg

from app.api.v4.artifacts.dashboard.types import DashboardSectionRequest
from app.api.v4.entries.chat.get import FilterOption, GetChatsResponse
from app.api.v4.resources.rubrics.get import get_rubrics_batch_internal
from app.api.v4.resources.standard_groups.get import get_standard_groups_internal
from app.sql.types import GetActiveSettingsSqlParams, GetActiveSettingsSqlRow
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

ACTIVE_SETTINGS_SQL_PATH = (
    "app/sql/v4/queries/settings/get_active_settings_complete.sql"
)

SQL_PATH_RUBRIC_SCORES = (
    "app/sql/v4/queries/views/chat/rubric_scores/get_rubric_scores_complete.sql"
)


# ---------------------------------------------------------------------------
# Rubric scores types (moved from entries/chat/get.py)
# ---------------------------------------------------------------------------


class RubricScoreItem:
    """Single (chat, standard_group) rubric score row."""

    __slots__ = (
        "chat_id",
        "standard_group_id",
        "rubric_id",
        "score_percent",
        "simulation_id",
        "profile_id",
        "cohort_id",
        "department_id",
        "attempt_date",
        "attempt_type",
        "is_archived",
    )

    def __init__(
        self,
        chat_id: UUID,
        standard_group_id: UUID,
        rubric_id: UUID | None = None,
        score_percent: float | None = None,
        simulation_id: UUID | None = None,
        profile_id: UUID | None = None,
        cohort_id: UUID | None = None,
        department_id: UUID | None = None,
        attempt_date: date | None = None,
        attempt_type: str | None = None,
        is_archived: bool = False,
    ) -> None:
        self.chat_id = chat_id
        self.standard_group_id = standard_group_id
        self.rubric_id = rubric_id
        self.score_percent = score_percent
        self.simulation_id = simulation_id
        self.profile_id = profile_id
        self.cohort_id = cohort_id
        self.department_id = department_id
        self.attempt_date = attempt_date
        self.attempt_type = attempt_type
        self.is_archived = is_archived


class RubricScoresResponse:
    """Response from rubric scores query."""

    __slots__ = (
        "items",
        "total_count",
        "rubric_options",
        "department_options",
        "simulation_options",
        "standard_group_options",
    )

    def __init__(
        self,
        items: list[RubricScoreItem] | None = None,
        total_count: int = 0,
        rubric_options: list[FilterOption] | None = None,
        department_options: list[FilterOption] | None = None,
        simulation_options: list[FilterOption] | None = None,
        standard_group_options: list[FilterOption] | None = None,
    ) -> None:
        self.items = items or []
        self.total_count = total_count
        self.rubric_options = rubric_options
        self.department_options = department_options
        self.simulation_options = simulation_options
        self.standard_group_options = standard_group_options


@dataclass
class ParsedFilters:
    """Parsed filter values from a dashboard section request."""

    simulation_ids: list[UUID] | None
    cohort_ids: list[UUID] | None
    parsed_start_date: datetime | None
    parsed_end_date: datetime | None
    is_archived: bool
    attempt_type: str | None


@dataclass
class Thresholds:
    """Dashboard threshold values."""

    success: int | float = 85
    warning: int | float = 80
    danger: int | float = 70

    def as_dict(self) -> dict[str, int | float]:
        return {
            "success": self.success,
            "warning": self.warning,
            "danger": self.danger,
        }


def parse_dashboard_filters(request: DashboardSectionRequest) -> ParsedFilters:
    """Parse common filter values from a dashboard section request."""
    parsed_start_date = (
        datetime.fromisoformat(request.start_date.replace("Z", "+00:00"))
        if request.start_date
        else None
    )
    parsed_end_date = (
        datetime.fromisoformat(request.end_date.replace("Z", "+00:00"))
        if request.end_date
        else None
    )
    is_archived = bool(
        request.simulation_filters and "archived" in request.simulation_filters
    )
    if request.simulation_filters and "general" in request.simulation_filters:
        attempt_type = "general"
    elif request.simulation_filters and "practice" in request.simulation_filters:
        attempt_type = "practice"
    else:
        attempt_type = None

    return ParsedFilters(
        simulation_ids=None,  # Section requests don't have simulation_ids field
        cohort_ids=request.cohort_ids,
        parsed_start_date=parsed_start_date,
        parsed_end_date=parsed_end_date,
        is_archived=is_archived,
        attempt_type=attempt_type,
    )


async def fetch_thresholds(
    pool: asyncpg.Pool,
    actor_profile_id: UUID | None,
    target_profile_id: UUID | None,
    department_ids: list[UUID] | None,
) -> Thresholds:
    """Fetch threshold settings for the given profile/department."""
    thresholds = Thresholds()
    profile_for_settings = actor_profile_id or target_profile_id
    if profile_for_settings:
        async with pool.acquire() as c:
            settings_row_raw = await execute_sql_typed(
                c,
                ACTIVE_SETTINGS_SQL_PATH,
                params=GetActiveSettingsSqlParams(
                    profile_id=str(profile_for_settings),
                    department_id=(str(department_ids[0]) if department_ids else None),
                ),
            )
            if settings_row_raw:
                settings = GetActiveSettingsSqlRow.model_validate(settings_row_raw)
                thresholds.success = settings.success_threshold or thresholds.success
                thresholds.warning = settings.warning_threshold or thresholds.warning
                thresholds.danger = settings.danger_threshold or thresholds.danger
    return thresholds


# ---------------------------------------------------------------------------
# get_rubric_scores_internal (moved from entries/chat/get.py)
# ---------------------------------------------------------------------------


async def get_rubric_scores_internal(
    conn: asyncpg.Connection,
    profile_id: UUID | None = None,
    cohort_ids: list[UUID] | None = None,
    department_ids: list[UUID] | None = None,
    simulation_ids: list[UUID] | None = None,
    rubric_ids: list[UUID] | None = None,
    attempt_type: str | None = None,
    is_archived: bool = False,
    date_from: date | None = None,
    date_to: date | None = None,
    page_limit: int = 50000,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> RubricScoresResponse:
    """Fetch rubric scores."""
    from app.sql.types import GetRubricScoresSqlParams

    cache_key_val = cache_key(
        "entries/chat/rubric_scores",
        {
            "profile_id": str(profile_id) if profile_id else None,
            "cohort_ids": [str(c) for c in cohort_ids] if cohort_ids else None,
            "department_ids": [str(d) for d in department_ids]
            if department_ids
            else None,
            "simulation_ids": [str(s) for s in simulation_ids]
            if simulation_ids
            else None,
            "rubric_ids": [str(r) for r in rubric_ids] if rubric_ids else None,
            "attempt_type": attempt_type,
            "is_archived": is_archived,
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
            "page_limit": page_limit,
            "page_offset": page_offset,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            resp = RubricScoresResponse(
                items=[
                    RubricScoreItem(
                        chat_id=UUID(i["chat_id"]),
                        standard_group_id=UUID(i["standard_group_id"]),
                        rubric_id=UUID(i["rubric_id"]) if i.get("rubric_id") else None,
                        score_percent=i.get("score_percent"),
                        simulation_id=UUID(i["simulation_id"])
                        if i.get("simulation_id")
                        else None,
                        profile_id=UUID(i["profile_id"])
                        if i.get("profile_id")
                        else None,
                        cohort_id=UUID(i["cohort_id"]) if i.get("cohort_id") else None,
                        department_id=UUID(i["department_id"])
                        if i.get("department_id")
                        else None,
                        attempt_date=date.fromisoformat(i["attempt_date"])
                        if i.get("attempt_date")
                        else None,
                        attempt_type=i.get("attempt_type"),
                        is_archived=i.get("is_archived", False),
                    )
                    for i in cached.get("items", [])
                ],
                total_count=cached.get("total_count", 0),
            )
            return resp

    params = GetRubricScoresSqlParams(
        profile_id_filter=profile_id,
        cohort_ids=cohort_ids,
        department_ids=department_ids,
        simulation_ids=simulation_ids,
        rubric_ids=rubric_ids,
        attempt_type_filter=attempt_type,
        is_archived_filter=is_archived,
        date_from=date_from,
        date_to=date_to,
        page_limit=page_limit,
        page_offset=page_offset,
    )

    result = await execute_sql_typed(conn, SQL_PATH_RUBRIC_SCORES, params=params)

    items: list[RubricScoreItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                RubricScoreItem(
                    chat_id=item.chat_id,
                    standard_group_id=item.standard_group_id,
                    rubric_id=item.rubric_id,
                    score_percent=float(item.score_percent)
                    if item.score_percent is not None
                    else None,
                    simulation_id=item.simulation_id,
                    profile_id=item.profile_id,
                    cohort_id=item.cohort_id,
                    department_id=item.department_id,
                    attempt_date=date.fromisoformat(item.attempt_date)
                    if isinstance(item.attempt_date, str)
                    else item.attempt_date,
                    attempt_type=item.attempt_type,
                    is_archived=item.is_archived or False,
                )
            )

    def _transform_options(raw_options):  # type: ignore[no-untyped-def]
        if not raw_options:
            return None
        return [
            FilterOption(
                value=opt.value or "", label=opt.label or "", count=opt.count or 0
            )
            for opt in raw_options
            if opt.value
        ]

    response = RubricScoresResponse(
        items=items,
        total_count=result.total_count or 0 if result else 0,
        rubric_options=_transform_options(result.rubric_options if result else None),
        department_options=_transform_options(
            result.department_options if result else None
        ),
        simulation_options=_transform_options(
            result.simulation_options if result else None
        ),
        standard_group_options=_transform_options(
            result.standard_group_options if result else None
        ),
    )

    # Cache the result
    await set_cached(
        cache_key_val,
        {
            "items": [
                {
                    "chat_id": str(i.chat_id),
                    "standard_group_id": str(i.standard_group_id),
                    "rubric_id": str(i.rubric_id) if i.rubric_id else None,
                    "score_percent": i.score_percent,
                    "simulation_id": str(i.simulation_id) if i.simulation_id else None,
                    "profile_id": str(i.profile_id) if i.profile_id else None,
                    "cohort_id": str(i.cohort_id) if i.cohort_id else None,
                    "department_id": str(i.department_id) if i.department_id else None,
                    "attempt_date": i.attempt_date.isoformat()
                    if i.attempt_date
                    else None,
                    "attempt_type": i.attempt_type,
                    "is_archived": i.is_archived,
                }
                for i in items
            ],
            "total_count": response.total_count,
        },
        ttl=60,
        tags=["entries", "chat", "rubric_scores"],
    )

    return response


async def fetch_chats_data(
    pool: asyncpg.Pool,
    request: DashboardSectionRequest,
    filters: ParsedFilters,
    bypass_cache: bool = False,
) -> "GetChatsResponse":
    """Fetch chat data from attempt_chat_mv — unified replacement for all 4 facts fetchers."""
    from app.api.v4.entries.chat.get import get_chats_internal

    async with pool.acquire() as c:
        return await get_chats_internal(
            conn=c,
            profile_id=request.target_profile_id,
            cohort_ids=filters.cohort_ids,
            department_ids=request.department_ids,
            simulation_ids=filters.simulation_ids,
            attempt_type=filters.attempt_type,
            is_archived=filters.is_archived,
            date_from=filters.parsed_start_date.date()
            if filters.parsed_start_date
            else None,
            date_to=filters.parsed_end_date.date() if filters.parsed_end_date else None,
            bypass_cache=bypass_cache,
        )


async def fetch_rubric_scores_data(
    pool: asyncpg.Pool,
    request: DashboardSectionRequest,
    filters: ParsedFilters,
    bypass_cache: bool = False,
) -> "RubricScoresResponse":
    """Fetch rubric scores — replaces fetch_rubric_facts_data."""
    async with pool.acquire() as c:
        return await get_rubric_scores_internal(
            conn=c,
            profile_id=request.target_profile_id,
            cohort_ids=filters.cohort_ids,
            department_ids=request.department_ids,
            attempt_type=filters.attempt_type,
            is_archived=filters.is_archived,
            date_from=filters.parsed_start_date.date()
            if filters.parsed_start_date
            else None,
            date_to=filters.parsed_end_date.date() if filters.parsed_end_date else None,
            bypass_cache=bypass_cache,
        )


async def hydrate_rubric_resources(
    pool: asyncpg.Pool,
    rubric_ids: list,
    bypass_cache: bool = False,
) -> tuple[list[Any], dict[str, str]]:
    """Hydrate rubric metadata and build standard_group_name_map.

    Returns:
        (rubrics, standard_group_name_map)
    """
    async with pool.acquire() as c:
        rubrics = await get_rubrics_batch_internal(
            conn=c,
            ids=rubric_ids,
            bypass_cache=bypass_cache,
        )

    # Collect all standard_group_ids from rubrics
    all_sg_ids: list[UUID] = []
    for rubric in rubrics:
        sg_ids = getattr(rubric, "standard_group_ids", None) or []
        for sg_id in sg_ids:
            if sg_id and sg_id not in all_sg_ids:
                all_sg_ids.append(sg_id)

    # Fetch standard group names via resource handler
    standard_group_name_map: dict[str, str] = {}
    if all_sg_ids:
        async with pool.acquire() as c:
            sg_items = await get_standard_groups_internal(
                conn=c,
                ids=all_sg_ids,
                bypass_cache=bypass_cache,
            )
        for sg in sg_items:
            sg_id = getattr(sg, "standard_group_id", None)
            sg_name = getattr(sg, "name", None)
            if sg_id and sg_name:
                standard_group_name_map[str(sg_id)] = sg_name

    return rubrics, standard_group_name_map


def build_simulation_meta(simulations: list[Any]) -> list[dict]:
    """Build simulation metadata list from hydrated simulations."""
    return [
        {
            "simulation_id": str(item.simulation_id) if item.simulation_id else None,
            "name": item.name,
            "description": item.description,
            "department_ids": item.department_ids,
            "time_limit": None,
        }
        for item in simulations
    ]


def build_rubric_meta(rubrics: list[Any]) -> list[dict]:
    """Build rubric metadata list from hydrated rubrics."""
    return [
        {
            "rubric_id": str(item.rubric_id) if item.rubric_id else None,
            "name": item.name,
            "description": item.description,
        }
        for item in rubrics
    ]


def build_parameter_meta(parameters: list[Any]) -> list[dict]:
    """Build parameter metadata list from hydrated parameters."""
    return [
        {
            "parameter_id": str(item.parameter_id) if item.parameter_id else None,
            "name": item.name,
            "description": item.description,
            "numerical": None,
            "document_parameter": item.document_parameter,
            "persona_parameter": item.persona_parameter,
        }
        for item in parameters
    ]


def build_field_meta(
    fields: list[Any],
    field_parameter_map: dict,
    parameters: list[Any],
) -> list[dict]:
    """Build field metadata list from hydrated fields."""
    parameter_name_map = {
        p.parameter_id: p.name for p in parameters if p.parameter_id is not None
    }
    return [
        {
            "field_id": str(item.field_id) if item.field_id else None,
            "name": item.name,
            "description": item.description,
            "parameter_id": (
                str(field_parameter_map.get(item.field_id))
                if item.field_id and field_parameter_map.get(item.field_id)
                else None
            ),
            "parameter_name": (
                parameter_name_map.get(field_parameter_map.get(item.field_id))
                if item.field_id and field_parameter_map.get(item.field_id)
                else None
            ),
        }
        for item in fields
    ]


# ---------------------------------------------------------------------------
# Message stats types + internal (moved from header.py)
# ---------------------------------------------------------------------------

SQL_PATH_MESSAGE_STATS = (
    "app/sql/v4/queries/views/chat/message_stats/get_message_stats_complete.sql"
)


class MessageStats:
    """Message statistics for a single chat."""

    __slots__ = ("chat_id", "num_messages_total", "avg_response_sec")

    def __init__(
        self,
        chat_id: UUID,
        num_messages_total: int = 0,
        avg_response_sec: float | None = None,
    ) -> None:
        self.chat_id = chat_id
        self.num_messages_total = num_messages_total
        self.avg_response_sec = avg_response_sec


async def get_message_stats_internal(
    conn: asyncpg.Connection,
    chat_ids: list[UUID],
    bypass_cache: bool = False,
) -> dict[UUID, MessageStats]:
    """Fetch message stats for a batch of chat IDs.

    Returns a dict keyed by chat_id for O(1) lookup.
    """
    if not chat_ids:
        return {}

    from app.sql.types import GetMessageStatsSqlParams

    cache_key_val = cache_key(
        "entries/chat/message_stats",
        {"chat_ids": sorted(str(c) for c in chat_ids)},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return {
                UUID(k): MessageStats(
                    chat_id=UUID(k),
                    num_messages_total=v["num_messages_total"],
                    avg_response_sec=v.get("avg_response_sec"),
                )
                for k, v in cached.items()
            }

    params = GetMessageStatsSqlParams(chat_ids=chat_ids)
    result = await execute_sql_typed(conn, SQL_PATH_MESSAGE_STATS, params=params)

    stats_map: dict[UUID, MessageStats] = {}
    if result and result.items:
        for item in result.items:
            if item.chat_id:
                stats_map[item.chat_id] = MessageStats(
                    chat_id=item.chat_id,
                    num_messages_total=item.num_messages_total or 0,
                    avg_response_sec=float(item.avg_response_sec)
                    if item.avg_response_sec is not None
                    else None,
                )

    # Cache as simple dict
    await set_cached(
        cache_key_val,
        {
            str(k): {
                "num_messages_total": v.num_messages_total,
                "avg_response_sec": v.avg_response_sec,
            }
            for k, v in stats_map.items()
        },
        ttl=60,
        tags=["entries", "chat", "message_stats"],
    )

    return stats_map


# ---------------------------------------------------------------------------
# Training doc IDs (moved from footer.py)
# ---------------------------------------------------------------------------

TRAINING_CONFIG_SQL = (
    "app/sql/v4/queries/views/chat/training_config/get_training_config_complete.sql"
)


async def fetch_training_doc_ids(
    conn: asyncpg.Connection,
    chat_resolved_ids: list[UUID],
    bypass_cache: bool = False,
) -> dict[UUID, list[UUID]]:
    """Fetch document_ids from training config for a batch of chat_resolved_ids."""
    if not chat_resolved_ids:
        return {}

    from app.sql.types import GetTrainingConfigSqlParams

    tc_cache_key = cache_key(
        "dashboard/training_doc_ids",
        {"ids": sorted(str(i) for i in chat_resolved_ids)},
    )

    if not bypass_cache:
        cached = await get_cached(tc_cache_key)
        if cached:
            return {UUID(k): [UUID(d) for d in v] for k, v in cached.items() if v}

    params = GetTrainingConfigSqlParams(chat_resolved_ids=chat_resolved_ids)
    result = await execute_sql_typed(conn, TRAINING_CONFIG_SQL, params=params)

    doc_map: dict[UUID, list[UUID]] = {}
    if result and result.items:
        for item in result.items:
            if item.document_ids:
                doc_map[item.chat_resolved_id] = list(item.document_ids)

    await set_cached(
        tc_cache_key,
        {str(k): [str(d) for d in v] for k, v in doc_map.items()},
        ttl=300,
        tags=["entries", "chat", "training_config"],
    )

    return doc_map
