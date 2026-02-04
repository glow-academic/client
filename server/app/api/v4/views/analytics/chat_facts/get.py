"""Get endpoint for analytics chat facts view (mv_chat_facts)."""

from datetime import datetime
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.api.v4.views.analytics.chat_facts.types import (
    ChatFactsItem,
    GetChatFactsRequest,
    GetChatFactsResponse,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/analytics/chat_facts/get_analytics_chat_facts_view_complete.sql"

router = APIRouter()


class GetAnalyticsChatFactsSqlParams(BaseModel):
    """Typed SQL params for api_get_analytics_chat_facts_view_v4."""

    profile_id: UUID | None = None
    profile_ids: list[UUID] | None = None
    simulation_ids: list[UUID] | None = None
    cohort_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    scenario_ids: list[UUID] | None = None
    persona_ids: list[UUID] | None = None
    attempt_type_filter: str | None = None
    is_archived_filter: bool = False
    infinite_mode_filter: bool | None = None
    completed_filter: bool | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
    search: str | None = None
    sort_by: str = "date"
    sort_order: str = "desc"
    page_limit: int = 50
    page_offset: int = 0

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.profile_id,
            self.profile_ids,
            self.simulation_ids,
            self.cohort_ids,
            self.department_ids,
            self.scenario_ids,
            self.persona_ids,
            self.attempt_type_filter,
            self.is_archived_filter,
            self.infinite_mode_filter,
            self.completed_filter,
            self.date_from,
            self.date_to,
            self.search,
            self.sort_by,
            self.sort_order,
            self.page_limit,
            self.page_offset,
        )


async def get_chat_facts_internal(
    conn: asyncpg.Connection,
    request: GetChatFactsRequest,
    bypass_cache: bool = False,
) -> GetChatFactsResponse:
    """Internal function for fetching chat facts from mv_chat_facts."""
    cache_key_val = cache_key(
        "views/analytics/chat-facts/get",
        request.model_dump(mode="json"),
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetChatFactsResponse.model_validate(cached)

    params = GetAnalyticsChatFactsSqlParams(
        profile_id=request.profile_id,
        profile_ids=request.profile_ids,
        simulation_ids=request.simulation_ids,
        cohort_ids=request.cohort_ids,
        department_ids=request.department_ids,
        scenario_ids=request.scenario_ids,
        persona_ids=request.persona_ids,
        attempt_type_filter=request.attempt_type,
        is_archived_filter=request.is_archived,
        infinite_mode_filter=request.infinite_mode,
        completed_filter=request.completed,
        date_from=request.date_from,
        date_to=request.date_to,
        search=request.search,
        sort_by=request.sort_by,
        sort_order=request.sort_order,
        page_limit=request.page_limit,
        page_offset=request.page_offset,
    )

    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[ChatFactsItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                ChatFactsItem(
                    chat_id=item.chat_id,
                    attempt_id=item.attempt_id,
                    grade_id=item.grade_id,
                    simulation_id=item.simulation_id,
                    profile_id=item.profile_id,
                    cohort_id=item.cohort_id,
                    department_id=item.department_id,
                    role_id=item.role_id,
                    scenario_id=item.scenario_id,
                    persona_id=item.persona_id,
                    rubric_id=item.rubric_id,
                    attempt_created_at=item.attempt_created_at,
                    chat_created_at=item.chat_created_at,
                    grade_created_at=item.grade_created_at,
                    attempt_type=item.attempt_type or "general",
                    is_archived=item.is_archived or False,
                    infinite_mode=item.infinite_mode or False,
                    completed=item.completed or False,
                    score=item.score,
                    passed=item.passed,
                    time_taken=item.time_taken,
                    grade_percent=float(item.grade_percent)
                    if item.grade_percent is not None
                    else None,
                    rubric_total_points=item.rubric_total_points,
                    rubric_pass_points=item.rubric_pass_points,
                    num_messages_total=item.num_messages_total or 0,
                    message_time_taken_seconds=list(item.message_time_taken_seconds)
                    if item.message_time_taken_seconds
                    else [],
                )
            )

    response = GetChatFactsResponse(
        items=items,
        total_count=result.total_count or 0 if result else 0,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "analytics", "chat_facts"],
    )

    return response


@router.post(
    "/get",
    response_model=GetChatFactsResponse,
    dependencies=[
        audit_activity(
            "views.analytics.chat_facts.get",
            "{{ actor.name }} fetched analytics chat facts data",
        )
    ],
)
async def get_chat_facts(
    request: GetChatFactsRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetChatFactsResponse:
    """Get chat facts data from mv_chat_facts with filter/search only (no joins)."""
    tags = ["views", "analytics", "chat_facts"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        result = await get_chat_facts_internal(
            conn=conn,
            request=request,
            bypass_cache=bypass_cache,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return result
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="views_analytics_chat_facts_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
