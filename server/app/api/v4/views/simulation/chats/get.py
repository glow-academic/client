"""Get endpoint for simulation chats view."""

from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.simulation.chats.types import (
    ChatViewItem,
    FeedbackItem,
    GetChatsRequest,
    GetChatsResponse,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/simulation/chats/get_simulation_chats_view_complete.sql"

router = APIRouter()


async def get_simulation_chats_internal(
    conn: asyncpg.Connection,
    attempt_id: UUID | None = None,
    chat_ids: list[UUID] | None = None,
    practice: bool | None = None,
    bypass_cache: bool = False,
) -> list[ChatViewItem]:
    """Internal function for fetching chat data.

    This can be reused by analytics routes that need chat data.

    Args:
        conn: Database connection
        attempt_id: Filter by attempt ID
        chat_ids: List of specific chat IDs to fetch
        practice: Filter by practice mode
        bypass_cache: Skip cache lookup

    Returns:
        List of ChatViewItem objects
    """
    from app.sql.types import (
        GetSimulationChatsViewSqlParams,
    )

    cache_key_val = cache_key(
        "views/simulation/chats/get",
        {
            "attempt_id": str(attempt_id) if attempt_id else None,
            "chat_ids": [str(c) for c in chat_ids] if chat_ids else None,
            "practice": practice,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [ChatViewItem.model_validate(item) for item in cached["items"]]

    # Execute SQL query
    params = GetSimulationChatsViewSqlParams(
        attempt_id_filter=attempt_id,
        chat_ids=chat_ids,
        practice_filter=practice,
    )

    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    # Transform to response items
    items: list[ChatViewItem] = []
    if result and result.items:
        for item in result.items:
            # Transform feedbacks
            feedbacks = None
            if item.feedbacks:
                feedbacks = [
                    FeedbackItem(
                        id=f.id,
                        standard_id=f.standard_id,
                        standard_name=f.standard_name,
                        total=f.total,
                        feedback=f.feedback,
                    )
                    for f in item.feedbacks
                ]

            items.append(
                ChatViewItem(
                    chat_id=item.chat_id,
                    attempt_id=item.attempt_id,
                    scenario_id=item.scenario_id,
                    persona_id=item.persona_id,
                    rubric_id=item.rubric_id,
                    scenario_name=item.scenario_name,
                    persona_name=item.persona_name,
                    persona_color=item.persona_color,
                    persona_icon=item.persona_icon,
                    rubric_name=item.rubric_name,
                    objective=item.objective,
                    problem_statement=item.problem_statement,
                    practice=item.practice or False,
                    chat_created_at=item.chat_created_at,
                    chat_completed=item.chat_completed or False,
                    chat_position=item.chat_position,
                    is_current_chat=item.is_current_chat or False,
                    grade_id=item.grade_id,
                    grade_score=item.grade_score,
                    grade_passed=item.grade_passed,
                    grade_description=item.grade_description,
                    grade_time_taken=item.grade_time_taken,
                    rubric_total_points=item.rubric_total_points,
                    rubric_pass_points=item.rubric_pass_points,
                    feedbacks=feedbacks,
                )
            )

    # Cache the result
    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["views", "simulation", "chats"],
    )

    return items


@router.post(
    "/get",
    response_model=GetChatsResponse,
    dependencies=[
        audit_activity(
            "views.simulation.chats.get",
            "{{ actor.name }} fetched simulation chat data",
        )
    ],
)
async def get_chats(
    request: GetChatsRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetChatsResponse:
    """Get simulation chat data from the materialized view.

    This endpoint fetches chat-level data with resource metadata JOINed.
    """
    tags = ["views", "simulation", "chats"]

    # Check for cache bypass header
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        items = await get_simulation_chats_internal(
            conn=conn,
            attempt_id=request.attempt_id,
            chat_ids=request.chat_ids,
            practice=request.practice,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetChatsResponse(items=items)

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="views_simulation_chats_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
