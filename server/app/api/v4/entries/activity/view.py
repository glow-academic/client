"""View wrapper for activity list entries."""

from datetime import datetime
from uuid import UUID

import asyncpg
from pydantic import BaseModel, Field

from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/activity/list/get_activity_list_view_complete.sql"


class ActivityViewItem(BaseModel):
    """Single item from the activity list view."""

    activity_id: UUID
    profile_id: UUID | None = None
    session_id: UUID | None = None
    last_active: datetime | None = None
    created_at: datetime | None = None


class GetActivityListViewResponse(BaseModel):
    """Response containing activity list data."""

    items: list[ActivityViewItem] = Field(default_factory=list)
    total_count: int = Field(default=0)


async def get_activity_list_view_internal(
    conn: asyncpg.Connection,
    profile_id_filter: UUID | None = None,
    session_id_filter: UUID | None = None,
    page_limit: int = 10000,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetActivityListViewResponse:
    """Internal function for fetching activity data from MV."""
    from app.sql.types import GetActivityListViewSqlParams

    cache_key_val = cache_key(
        "views/activity/list/get",
        {
            "profile_id_filter": str(profile_id_filter) if profile_id_filter else None,
            "session_id_filter": str(session_id_filter) if session_id_filter else None,
            "page_limit": page_limit,
            "page_offset": page_offset,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetActivityListViewResponse.model_validate(cached)

    params = GetActivityListViewSqlParams(
        profile_id_filter=profile_id_filter,
        session_id_filter=session_id_filter,
        page_limit_val=page_limit,
        page_offset_val=page_offset,
    )

    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[ActivityViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                ActivityViewItem(
                    activity_id=item.activity_id,
                    profile_id=item.profile_id,
                    session_id=item.session_id,
                    last_active=item.last_active,
                    created_at=item.created_at,
                )
            )

    response = GetActivityListViewResponse(
        items=items,
        total_count=result.total_count or 0 if result else 0,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "activity", "list"],
    )

    return response
