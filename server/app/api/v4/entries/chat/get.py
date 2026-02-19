"""Get endpoint for unified chat entries (attempt_chat_mv)."""

from datetime import date, datetime
from typing import Any
from uuid import UUID

import asyncpg
from pydantic import BaseModel, Field

from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# ---------------------------------------------------------------------------
# Types (formerly in types.py)
# ---------------------------------------------------------------------------


class ChatItem(BaseModel):
    """Single chat row from attempt_chat_mv."""

    # Primary key
    chat_id: UUID

    # Foreign keys
    attempt_id: UUID
    group_id: UUID | None = None
    training_department_id: UUID | None = None

    # Resource IDs
    profile_id: UUID
    cohort_id: UUID | None = None
    department_id: UUID | None = None
    simulation_id: UUID
    scenario_id: UUID | None = None
    user_persona_id: UUID | None = None
    rubric_id: UUID | None = None

    # Grade measures (raw values — consumers compute grade_percent)
    grade_score: int | None = None
    grade_total_points: int | None = None
    grade_pass_points: int | None = None
    grade_passed: bool | None = None
    grade_time_taken: int | None = None

    # Chat state
    completed: bool = False
    attempt_number: int = 0

    # Timestamps
    chat_created_at: datetime | None = None
    attempt_date: date | None = None

    # Filters
    attempt_type: str | None = None  # 'general' | 'practice'
    is_archived: bool = False
    infinite_mode: bool = False

    # Enrichment fields (set by consumers after fetching, not from MV)
    num_messages_total: int = 0
    avg_response_sec: float | None = None
    document_ids: list[UUID] = Field(default_factory=list)

    @property
    def grade_percent(self) -> float | None:
        """Compute grade percentage from raw score and total points."""
        if (
            self.grade_score is not None
            and self.grade_total_points is not None
            and self.grade_total_points > 0
        ):
            return round((self.grade_score / self.grade_total_points) * 100, 2)
        return None

    @property
    def passed(self) -> bool | None:
        """Alias for grade_passed (compat with old *FactsItem types)."""
        return self.grade_passed

    @property
    def persona_id(self) -> UUID | None:
        """Alias for user_persona_id (compat with old *FactsItem types)."""
        return self.user_persona_id

    @property
    def time_taken_seconds(self) -> int | None:
        """Alias for grade_time_taken (compat with old *FactsItem types)."""
        return self.grade_time_taken


class FilterOption(BaseModel):
    """Filter option for dropdowns."""

    value: str
    label: str
    count: int = 0


class GetChatsRequest(BaseModel):
    """Request for getting chats with filters and pagination."""

    # Filters
    profile_id: UUID | None = Field(default=None, description="Filter by profile ID")
    cohort_ids: list[UUID] | None = Field(
        default=None, description="Filter by cohort IDs"
    )
    department_ids: list[UUID] | None = Field(
        default=None, description="Filter by department IDs"
    )
    simulation_ids: list[UUID] | None = Field(
        default=None, description="Filter by simulation IDs"
    )
    scenario_ids: list[UUID] | None = Field(
        default=None, description="Filter by scenario IDs"
    )
    rubric_ids: list[UUID] | None = Field(
        default=None, description="Filter by rubric IDs"
    )
    attempt_id: UUID | None = Field(default=None, description="Filter by attempt ID")
    attempt_type: str | None = Field(
        default=None, description="Filter by attempt type: 'general' | 'practice'"
    )
    is_archived: bool = Field(default=False, description="Include archived attempts")
    date_from: date | None = Field(
        default=None, description="Filter by date range start (inclusive)"
    )
    date_to: date | None = Field(
        default=None, description="Filter by date range end (inclusive)"
    )

    # Sorting
    sort_by: str = Field(
        default="date", description="Sort field: 'date' | 'created_at'"
    )
    sort_order: str = Field(default="desc", description="Sort order: 'asc' | 'desc'")

    # Pagination
    page_limit: int = Field(default=10000, description="Items per page", ge=1, le=50000)
    page_offset: int = Field(default=0, description="Pagination offset", ge=0)


class GetChatsResponse(BaseModel):
    """Response with chat items and pagination info."""

    items: list[ChatItem] = Field(default_factory=list, description="Chat items")
    total_count: int = Field(default=0, description="Total count before pagination")

    # Filter options (for dropdowns)
    simulation_options: list[FilterOption] | None = Field(
        default=None, description="Available simulation filter options"
    )
    cohort_options: list[FilterOption] | None = Field(
        default=None, description="Available cohort filter options"
    )
    department_options: list[FilterOption] | None = Field(
        default=None, description="Available department filter options"
    )
    scenario_options: list[FilterOption] | None = Field(
        default=None, description="Available scenario filter options"
    )
    persona_options: list[FilterOption] | None = Field(
        default=None, description="Available persona filter options"
    )


# ---------------------------------------------------------------------------
# Message stats types (formerly in message_stats.py)
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Rubric scores types (formerly in rubric_scores.py)
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


# ---------------------------------------------------------------------------
# Training config types (formerly in training_config.py)
# ---------------------------------------------------------------------------


class TrainingConfig(BaseModel):
    """Training department config flags + resource ID arrays."""

    training_department_id: UUID
    # Config flags
    copy_paste_allowed: bool = True
    text_enabled: bool = True
    audio_enabled: bool = True
    hints_enabled: bool = True
    show_images: bool = True
    show_objectives: bool = True
    show_problem_statement: bool = True
    time_limit_seconds: int = 0
    negative: bool = False
    # Singular picks
    scenario_id: UUID | None = None
    rubric_id: UUID | None = None
    problem_statement_id: UUID | None = None
    # Plural sets
    persona_ids: list[UUID] | None = None
    objective_ids: list[UUID] | None = None
    question_ids: list[UUID] | None = None
    option_ids: list[UUID] | None = None
    image_ids: list[UUID] | None = None
    video_ids: list[UUID] | None = None
    document_ids: list[UUID] | None = None
    standard_group_ids: list[UUID] | None = None
    standard_ids: list[UUID] | None = None


# ---------------------------------------------------------------------------
# SQL paths
# ---------------------------------------------------------------------------

SQL_PATH = "app/sql/v4/queries/views/chat/get_chat_view_complete.sql"
SQL_PATH_MESSAGE_STATS = (
    "app/sql/v4/queries/views/chat/message_stats/get_message_stats_complete.sql"
)
SQL_PATH_RUBRIC_SCORES = (
    "app/sql/v4/queries/views/chat/rubric_scores/get_rubric_scores_complete.sql"
)
SQL_PATH_TRAINING_CONFIG = (
    "app/sql/v4/queries/views/chat/training_config/get_training_config_complete.sql"
)


# ---------------------------------------------------------------------------
# get_chats_internal
# ---------------------------------------------------------------------------


async def get_chats_internal(
    conn: asyncpg.Connection,
    profile_id: UUID | None = None,
    cohort_ids: list[UUID] | None = None,
    department_ids: list[UUID] | None = None,
    simulation_ids: list[UUID] | None = None,
    scenario_ids: list[UUID] | None = None,
    rubric_ids: list[UUID] | None = None,
    attempt_id: UUID | None = None,
    attempt_type: str | None = None,
    is_archived: bool = False,
    date_from: date | None = None,
    date_to: date | None = None,
    sort_by: str = "date",
    sort_order: str = "desc",
    page_limit: int = 10000,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetChatsResponse:
    """Internal function for fetching unified chat data."""
    from app.sql.types import GetChatViewSqlParams

    cache_key_val = cache_key(
        "entries/chat/get",
        {
            "profile_id": str(profile_id) if profile_id else None,
            "cohort_ids": [str(c) for c in cohort_ids] if cohort_ids else None,
            "department_ids": [str(d) for d in department_ids]
            if department_ids
            else None,
            "simulation_ids": [str(s) for s in simulation_ids]
            if simulation_ids
            else None,
            "scenario_ids": [str(s) for s in scenario_ids] if scenario_ids else None,
            "rubric_ids": [str(r) for r in rubric_ids] if rubric_ids else None,
            "attempt_id": str(attempt_id) if attempt_id else None,
            "attempt_type": attempt_type,
            "is_archived": is_archived,
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
            "sort_by": sort_by,
            "sort_order": sort_order,
            "page_limit": page_limit,
            "page_offset": page_offset,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetChatsResponse.model_validate(cached)

    params = GetChatViewSqlParams(
        profile_id_filter=profile_id,
        cohort_ids=cohort_ids,
        department_ids=department_ids,
        simulation_ids=simulation_ids,
        scenario_ids=scenario_ids,
        rubric_ids=rubric_ids,
        attempt_id_filter=attempt_id,
        attempt_type_filter=attempt_type,
        is_archived_filter=is_archived,
        date_from=date_from,
        date_to=date_to,
        sort_by=sort_by,
        sort_order=sort_order,
        page_limit=page_limit,
        page_offset=page_offset,
    )

    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[ChatItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                ChatItem(
                    chat_id=item.chat_id,
                    attempt_id=item.attempt_id,
                    group_id=item.group_id,
                    training_department_id=item.training_department_id,
                    profile_id=item.profile_id,
                    cohort_id=item.cohort_id,
                    department_id=item.department_id,
                    simulation_id=item.simulation_id,
                    scenario_id=item.scenario_id,
                    user_persona_id=item.user_persona_id,
                    rubric_id=item.rubric_id,
                    grade_score=item.grade_score,
                    grade_total_points=item.grade_total_points,
                    grade_pass_points=item.grade_pass_points,
                    grade_passed=item.grade_passed,
                    grade_time_taken=item.grade_time_taken,
                    completed=item.completed or False,
                    attempt_number=item.attempt_number or 0,
                    chat_created_at=item.chat_created_at,
                    attempt_date=item.attempt_date,
                    attempt_type=item.attempt_type,
                    is_archived=item.is_archived or False,
                    infinite_mode=item.infinite_mode or False,
                )
            )

    def _transform_options(
        raw_options: Any,
    ) -> list[FilterOption] | None:
        if not raw_options:
            return None
        return [
            FilterOption(
                value=opt.value or "",
                label=opt.label or "",
                count=opt.count or 0,
            )
            for opt in raw_options
            if opt.value
        ]

    response = GetChatsResponse(
        items=items,
        total_count=result.total_count or 0 if result else 0,
        simulation_options=_transform_options(
            result.simulation_options if result else None
        ),
        cohort_options=_transform_options(result.cohort_options if result else None),
        department_options=_transform_options(
            result.department_options if result else None
        ),
        scenario_options=_transform_options(
            result.scenario_options if result else None
        ),
        persona_options=_transform_options(result.persona_options if result else None),
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["entries", "chat"],
    )

    return response


# ---------------------------------------------------------------------------
# get_message_stats_internal (formerly in message_stats.py)
# ---------------------------------------------------------------------------


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
# get_rubric_scores_internal (formerly in rubric_scores.py)
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
                    attempt_date=item.attempt_date,
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


# ---------------------------------------------------------------------------
# get_training_config_internal (formerly in training_config.py)
# ---------------------------------------------------------------------------


async def get_training_config_internal(
    conn: asyncpg.Connection,
    training_department_ids: list[UUID],
    bypass_cache: bool = False,
) -> dict[UUID, TrainingConfig]:
    """Fetch training config for a batch of training_department_ids.

    Returns a dict keyed by training_department_id for easy lookup.
    Cacheable — training config rarely changes.
    """
    if not training_department_ids:
        return {}

    from app.sql.types import GetTrainingConfigSqlParams

    cache_key_val = cache_key(
        "entries/chat/training_config/get",
        {"ids": sorted(str(i) for i in training_department_ids)},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            configs: dict[UUID, TrainingConfig] = {}
            for key, val in cached.items():
                configs[UUID(key)] = TrainingConfig.model_validate(val)
            return configs

    params = GetTrainingConfigSqlParams(training_department_ids=training_department_ids)
    result = await execute_sql_typed(conn, SQL_PATH_TRAINING_CONFIG, params=params)

    configs = {}
    if result and result.items:
        for item in result.items:
            configs[item.training_department_id] = TrainingConfig(
                training_department_id=item.training_department_id,
                copy_paste_allowed=item.copy_paste_allowed
                if item.copy_paste_allowed is not None
                else True,
                text_enabled=item.text_enabled
                if item.text_enabled is not None
                else True,
                audio_enabled=item.audio_enabled
                if item.audio_enabled is not None
                else True,
                hints_enabled=item.hints_enabled
                if item.hints_enabled is not None
                else True,
                show_images=item.show_images if item.show_images is not None else True,
                show_objectives=item.show_objectives
                if item.show_objectives is not None
                else True,
                show_problem_statement=item.show_problem_statement
                if item.show_problem_statement is not None
                else True,
                time_limit_seconds=item.time_limit_seconds or 0,
                negative=item.negative or False,
                scenario_id=item.scenario_id,
                rubric_id=item.rubric_id,
                problem_statement_id=item.problem_statement_id,
                persona_ids=list(item.persona_ids) if item.persona_ids else None,
                objective_ids=list(item.objective_ids) if item.objective_ids else None,
                question_ids=list(item.question_ids) if item.question_ids else None,
                option_ids=list(item.option_ids) if item.option_ids else None,
                image_ids=list(item.image_ids) if item.image_ids else None,
                video_ids=list(item.video_ids) if item.video_ids else None,
                document_ids=list(item.document_ids) if item.document_ids else None,
                standard_group_ids=list(item.standard_group_ids)
                if item.standard_group_ids
                else None,
                standard_ids=list(item.standard_ids) if item.standard_ids else None,
            )

    # Cache with longer TTL — training config rarely changes
    await set_cached(
        cache_key_val,
        {str(k): v.model_dump(mode="json") for k, v in configs.items()},
        ttl=300,
        tags=["entries", "chat", "training_config"],
    )

    return configs
