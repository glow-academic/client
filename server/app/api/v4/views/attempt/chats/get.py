"""Get endpoint for attempt chats view (lean — no composites)."""

from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.attempt.chats.types import (
    ChatViewItem,
    GetChatsRequest,
    GetChatsResponse,
    GradeItem,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/attempt/chats/get_attempt_chats_view_complete.sql"

router = APIRouter()


async def get_attempt_chats_internal(
    conn: asyncpg.Connection,
    attempt_id: UUID | None = None,
    attempt_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
) -> list[ChatViewItem]:
    """Internal function for fetching lean chat data.

    Lean: entry attrs + resource IDs + grade scalars only. Composites
    (feedbacks, analyses, responses) fetched via simulation/* views.
    """
    from app.sql.types import (
        GetAttemptChatsViewSqlParams,
    )

    ids = attempt_ids or ([attempt_id] if attempt_id else [])

    cache_key_val = cache_key(
        "views/attempt/chats/get",
        {"attempt_ids": [str(a) for a in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [ChatViewItem.model_validate(item) for item in cached["items"]]

    # Execute SQL query
    params = GetAttemptChatsViewSqlParams(attempt_ids_filter=ids)

    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    # Transform to response items (no composite transforms needed)
    items: list[ChatViewItem] = []
    if result and result.items:
        for item in result.items:
            # Transform grade
            grade = None
            if item.grade:
                grade = GradeItem(
                    score=item.grade.score,
                    passed=item.grade.passed,
                    time_taken=item.grade.time_taken,
                    total_points=item.grade.total_points,
                    pass_points=item.grade.pass_points,
                )

            items.append(
                ChatViewItem(
                    chat_id=item.chat_id,
                    attempt_id=item.attempt_id,
                    group_id=item.group_id,
                    scenario_id=item.scenario_id,
                    rubric_id=item.rubric_id,
                    problem_statement_id=item.problem_statement_id,
                    copy_paste_allowed=item.copy_paste_allowed,
                    text_enabled=item.text_enabled,
                    audio_enabled=item.audio_enabled,
                    hints_enabled=item.hints_enabled,
                    show_images=item.show_images,
                    show_objectives=item.show_objectives,
                    show_problem_statement=item.show_problem_statement,
                    time_limit_seconds=item.time_limit_seconds,
                    negative=item.negative,
                    created_at=item.created_at,
                    completed=item.completed or False,
                    grade=grade,
                    persona_ids=list(item.persona_ids) if item.persona_ids else None,
                    objective_ids=list(item.objective_ids)
                    if item.objective_ids
                    else None,
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
            )

    # Cache the result
    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["views", "attempt", "chats"],
    )

    return items


@router.post(
    "/get",
    response_model=GetChatsResponse,
    dependencies=[
        audit_activity(
            "views.attempt.chats.get",
            "{{ actor.name }} fetched attempt chat data",
        )
    ],
)
async def get_chats(
    request: GetChatsRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetChatsResponse:
    """Get attempt chat data from the materialized view."""
    tags = ["views", "attempt", "chats"]

    # Check for cache bypass header
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        items = await get_attempt_chats_internal(
            conn=conn,
            attempt_id=request.attempt_id,
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
            operation="views_attempt_chats_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
