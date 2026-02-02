"""Get endpoint for simulation chats view."""

from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.simulation.chats.types import (
    AnalysisItem,
    ChatViewItem,
    FeedbackItem,
    GetChatsRequest,
    GetChatsResponse,
    GradeItem,
    ResponseItem,
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
    attempt_id: UUID,
    bypass_cache: bool = False,
) -> list[ChatViewItem]:
    """Internal function for fetching chat data.

    This can be reused by analytics routes that need chat data.

    Args:
        conn: Database connection
        attempt_id: Attempt ID to fetch chats for
        bypass_cache: Skip cache lookup

    Returns:
        List of ChatViewItem objects
    """
    from app.sql.types import (
        GetSimulationChatsViewSqlParams,
    )

    cache_key_val = cache_key(
        "views/simulation/chats/get",
        {"attempt_id": str(attempt_id)},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [ChatViewItem.model_validate(item) for item in cached["items"]]

    # Execute SQL query
    params = GetSimulationChatsViewSqlParams(attempt_id_filter=attempt_id)

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

            # Transform responses
            responses = None
            if item.responses:
                responses = [
                    ResponseItem(
                        question_id=r.question_id,
                        option_id=r.option_id,
                        completed=r.completed,
                        created_at=r.created_at,
                    )
                    for r in item.responses
                ]

            # Transform grade
            grade = None
            if item.grade:
                grade = GradeItem(
                    score=item.grade.score,
                    passed=item.grade.passed,
                    time_taken=item.grade.time_taken,
                )

            # Transform analyses
            analyses = None
            if item.analyses:
                analyses = [
                    AnalysisItem(content=a.content)
                    for a in item.analyses
                ]

            items.append(
                ChatViewItem(
                    chat_id=item.chat_id,
                    attempt_id=item.attempt_id,
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
                    # Time limit (denormalized)
                    time_limit_seconds=item.time_limit_seconds,
                    # Chat metadata (top-level, position/is_current derived in service layer)
                    created_at=item.created_at,
                    completed=item.completed or False,
                    # Grade (composite)
                    grade=grade,
                    feedbacks=feedbacks,
                    analyses=analyses,
                    # Resource IDs - Normal/General View
                    persona_ids=list(item.persona_ids) if item.persona_ids else None,
                    objective_ids=list(item.objective_ids) if item.objective_ids else None,
                    # Resource IDs - Video/Quiz View
                    question_ids=list(item.question_ids) if item.question_ids else None,
                    option_ids=list(item.option_ids) if item.option_ids else None,
                    responses=responses,
                    # Resource IDs - Both Views
                    template_ids=list(item.template_ids) if item.template_ids else None,
                    image_ids=list(item.image_ids) if item.image_ids else None,
                    video_ids=list(item.video_ids) if item.video_ids else None,
                    document_ids=list(item.document_ids) if item.document_ids else None,
                    # Rubric/Grade resource IDs
                    standard_group_ids=list(item.standard_group_ids) if item.standard_group_ids else None,
                    standard_ids=list(item.standard_ids) if item.standard_ids else None,
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
