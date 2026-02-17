"""Rubric scores service — score_percent per (chat, standard_group)."""

from datetime import date
from uuid import UUID

import asyncpg

from app.api.v4.views.chat.types import FilterOption
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/chat/rubric_scores/get_rubric_scores_complete.sql"


class RubricScoreItem:
    """Single (chat, standard_group) rubric score row.

    Drop-in replacement for RubricFactsItem — same shape.
    """

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
    """Fetch rubric scores — replaces get_rubric_facts_internal."""
    from app.sql.types import GetRubricScoresSqlParams

    cache_key_val = cache_key(
        "views/chat/rubric_scores",
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

    result = await execute_sql_typed(conn, SQL_PATH, params=params)

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
        tags=["views", "chat", "rubric_scores"],
    )

    return response
