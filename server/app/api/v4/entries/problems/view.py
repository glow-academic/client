"""View wrapper for problems list entries."""

from datetime import datetime
from uuid import UUID

import asyncpg
from pydantic import BaseModel, Field

from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/problem/list/get_problem_list_view_complete.sql"


class ProblemViewItem(BaseModel):
    """Single item from the problems list view."""

    problem_id: UUID
    type: str | None = None
    message: str | None = None
    resolved: bool | None = None
    session_id: UUID | None = None
    problem_created_at: datetime | None = None
    problem_updated_at: datetime | None = None
    profile_id: UUID | None = None


class GetProblemListViewResponse(BaseModel):
    """Response containing problems list data."""

    items: list[ProblemViewItem] = Field(default_factory=list)
    total_count: int = Field(default=0)


async def get_problem_list_view_internal(
    conn: asyncpg.Connection,
    profile_id_filter: UUID | None = None,
    resolved_filter: bool | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_order: str = "desc",
    page_limit: int = 50,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetProblemListViewResponse:
    """Internal function for fetching problems data from MV."""
    from app.sql.types import GetProblemListViewSqlParams

    cache_key_val = cache_key(
        "views/problem/list/get",
        {
            "profile_id_filter": str(profile_id_filter) if profile_id_filter else None,
            "resolved_filter": resolved_filter,
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
            "sort_order": sort_order,
            "page_limit": page_limit,
            "page_offset": page_offset,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetProblemListViewResponse.model_validate(cached)

    params = GetProblemListViewSqlParams(
        profile_id_filter=profile_id_filter,
        resolved_filter=resolved_filter,
        date_from=date_from or datetime.min,
        date_to=date_to or datetime.max,
        sort_order_field=sort_order,
        page_limit_val=page_limit,
        page_offset_val=page_offset,
    )

    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[ProblemViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                ProblemViewItem(
                    problem_id=item.problem_id,
                    type=item.type,
                    message=item.message,
                    resolved=item.resolved,
                    session_id=item.session_id,
                    problem_created_at=item.problem_created_at,
                    problem_updated_at=item.problem_updated_at,
                    profile_id=item.profile_id,
                )
            )

    response = GetProblemListViewResponse(
        items=items,
        total_count=result.total_count or 0 if result else 0,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "problem", "list"],
    )

    return response
