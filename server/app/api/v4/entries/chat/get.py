"""Get endpoint for unified chat entries (attempt_chat_mv)."""

from datetime import date
from typing import Any
from uuid import UUID

import asyncpg

from app.api.v4.entries.chat.types import (
    ChatItem,
    FilterOption,
    GetChatsResponse,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/chat/get_chat_view_complete.sql"


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
