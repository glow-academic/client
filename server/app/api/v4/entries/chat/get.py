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
# Types
# ---------------------------------------------------------------------------


class ChatItem(BaseModel):
    """Single chat row from attempt_chat_mv."""

    # Primary key
    chat_id: UUID

    # Foreign keys
    attempt_id: UUID
    chat_entry_id: UUID | None = None
    group_id: UUID | None = None
    attempt_chat_id: UUID | None = None

    # Resource IDs
    profile_id: UUID
    cohort_id: UUID | None = None
    department_id: UUID | None = None
    simulation_id: UUID
    scenario_id: UUID | None = None
    persona_refs: list[dict] | None = None  # [{personas_id, personas_entry_id}]
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
    def persona_ids(self) -> list[UUID]:
        """Extract resource-level persona IDs from persona_refs."""
        if not self.persona_refs:
            return []
        return [UUID(r["personas_id"]) if isinstance(r.get("personas_id"), str) else r["personas_id"] for r in self.persona_refs if r.get("personas_id")]

    @property
    def persona_id(self) -> UUID | None:
        """First persona_id for compat with old *FactsItem types."""
        ids = self.persona_ids
        return ids[0] if ids else None

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
# SQL paths
# ---------------------------------------------------------------------------

SQL_PATH = "app/sql/v4/queries/views/chat/get_chat_view_complete.sql"


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
                    chat_entry_id=getattr(item, "chat_entry_id", None),
                    group_id=item.group_id,
                    attempt_chat_id=item.attempt_chat_id,
                    profile_id=item.profile_id,
                    cohort_id=item.cohort_id,
                    department_id=item.department_id,
                    simulation_id=item.simulation_id,
                    scenario_id=item.scenario_id,
                    persona_refs=[
                        {"personas_id": ref.personas_id, "personas_entry_id": ref.personas_entry_id}
                        for ref in item.persona_refs
                    ] if item.persona_refs else None,
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
