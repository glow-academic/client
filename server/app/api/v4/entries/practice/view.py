"""View wrapper for practice context entries."""

from uuid import UUID

import asyncpg
from pydantic import BaseModel, Field

from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/views/practice/context/get_practice_context_view_complete.sql"
)


class PracticeContextViewItem(BaseModel):
    """IDs-first practice simulation item — raw IDs only, no computed fields."""

    simulation_id: UUID
    training_entry_ids: list[UUID] | None = None
    scenario_ids: list[UUID] | None = None
    cohort_ids: list[UUID] | None = None
    persona_ids: list[UUID] | None = None
    rubric_ids: list[UUID] | None = None
    time_limit_ids: list[UUID] | None = None


class GetPracticeContextViewResponse(BaseModel):
    """View-layer response for practice context."""

    actor_name: str | None = None
    user_role: str | None = None
    items: list[PracticeContextViewItem] = Field(default_factory=list)


async def get_practice_context_view_internal(
    conn: asyncpg.Connection,
    profile_id: UUID,
    bypass_cache: bool = False,
) -> GetPracticeContextViewResponse:
    """Internal function for IDs-first practice context data."""
    from app.sql.types import GetPracticeContextViewSqlParams

    cache_key_val = cache_key(
        "views/practice/context/get",
        {"profile_id": str(profile_id)},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetPracticeContextViewResponse.model_validate(cached)

    params = GetPracticeContextViewSqlParams(
        profile_id_filter=profile_id,
    )
    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[PracticeContextViewItem] = []
    if result and result.items:
        for item in result.items:
            if not item.simulation_id:
                continue
            items.append(
                PracticeContextViewItem(
                    simulation_id=item.simulation_id,
                    training_entry_ids=(
                        list(item.training_entry_ids)
                        if item.training_entry_ids
                        else None
                    ),
                    scenario_ids=list(item.scenario_ids) if item.scenario_ids else None,
                    cohort_ids=list(item.cohort_ids) if item.cohort_ids else None,
                    persona_ids=(list(item.persona_ids) if item.persona_ids else None),
                    rubric_ids=(list(item.rubric_ids) if item.rubric_ids else None),
                    time_limit_ids=(
                        list(item.time_limit_ids) if item.time_limit_ids else None
                    ),
                )
            )

    response = GetPracticeContextViewResponse(
        items=items,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "practice", "context"],
    )

    return response
