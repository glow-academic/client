"""Get endpoint for simulation feedbacks view."""

from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.simulation.feedbacks.types import (
    FeedbackViewItem,
    GetFeedbacksRequest,
    GetFeedbacksResponse,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/simulation/feedbacks/get_attempt_feedback_view_complete.sql"

router = APIRouter()


async def get_attempt_feedback_internal(
    conn: asyncpg.Connection,
    grade_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[FeedbackViewItem]:
    """Internal function for fetching feedbacks data."""
    from app.sql.types import GetSimulationFeedbacksViewSqlParams

    cache_key_val = cache_key(
        "views/simulation/feedbacks/get",
        {"grade_ids": [str(g) for g in grade_ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [FeedbackViewItem.model_validate(item) for item in cached["items"]]

    params = GetSimulationFeedbacksViewSqlParams(grade_ids_filter=grade_ids)
    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[FeedbackViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                FeedbackViewItem(
                    feedback_id=item.feedback_id,
                    grade_id=item.grade_id,
                    standard_id=item.standard_id,
                    total=item.total,
                    feedback=item.feedback,
                    created_at=item.created_at,
                )
            )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["views", "simulation", "feedbacks"],
    )
    return items


@router.post(
    "/get",
    response_model=GetFeedbacksResponse,
    dependencies=[
        audit_activity(
            "views.simulation.feedbacks.get",
            "{{ actor.name }} fetched simulation feedbacks data",
        )
    ],
)
async def get_feedbacks(
    request: GetFeedbacksRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetFeedbacksResponse:
    tags = ["views", "simulation", "feedbacks"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    try:
        items = await get_attempt_feedback_internal(
            conn=conn,
            grade_ids=request.grade_ids,
            bypass_cache=bypass_cache,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetFeedbacksResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="views_attempt_feedback_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
