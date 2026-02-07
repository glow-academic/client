"""Get endpoint for analytics profile metrics view (mv_profile_metrics)."""

from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.api.v4.views.analytics.profile_metrics.types import (
    GetProfileMetricsRequest,
    GetProfileMetricsResponse,
    ProfileMetricsItem,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/analytics/profile_metrics/get_analytics_profile_metrics_view_complete.sql"

router = APIRouter()


class GetAnalyticsProfileMetricsSqlParams(BaseModel):
    """Typed SQL params for api_get_analytics_profile_metrics_view_v4."""

    profile_id: UUID | None = None
    profile_ids: list[UUID] | None = None
    cohort_ids: list[UUID] | None = None
    simulation_ids: list[UUID] | None = None
    scenario_ids: list[UUID] | None = None
    attempt_type_filter: str | None = None
    is_archived_filter: bool = False
    min_attempts: int | None = None
    sort_by: str = "avg_score"
    sort_order: str = "desc"
    page_limit: int = 50
    page_offset: int = 0

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.profile_id,
            self.profile_ids,
            self.cohort_ids,
            self.simulation_ids,
            self.scenario_ids,
            self.attempt_type_filter,
            self.is_archived_filter,
            self.min_attempts,
            self.sort_by,
            self.sort_order,
            self.page_limit,
            self.page_offset,
        )


async def get_profile_metrics_internal(
    conn: asyncpg.Connection,
    request: GetProfileMetricsRequest,
    bypass_cache: bool = False,
) -> GetProfileMetricsResponse:
    """Internal function for fetching profile metrics from mv_profile_metrics."""
    cache_key_val = cache_key(
        "views/analytics/profile-metrics/get",
        request.model_dump(mode="json"),
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetProfileMetricsResponse.model_validate(cached)

    params = GetAnalyticsProfileMetricsSqlParams(
        profile_id=request.profile_id,
        profile_ids=request.profile_ids,
        cohort_ids=request.cohort_ids,
        simulation_ids=request.simulation_ids,
        scenario_ids=request.scenario_ids,
        attempt_type_filter=request.attempt_type,
        is_archived_filter=request.is_archived,
        min_attempts=request.min_attempts,
        sort_by=request.sort_by,
        sort_order=request.sort_order,
        page_limit=request.page_limit,
        page_offset=request.page_offset,
    )

    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[ProfileMetricsItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                ProfileMetricsItem(
                    profile_id=item.profile_id,
                    attempt_type=item.attempt_type or "general",
                    is_archived=item.is_archived or False,
                    total_attempts=item.total_attempts or 0,
                    avg_score=float(item.avg_score)
                    if item.avg_score is not None
                    else None,
                    highest_score=float(item.highest_score)
                    if item.highest_score is not None
                    else None,
                    completion_pct=float(item.completion_pct)
                    if item.completion_pct is not None
                    else None,
                    first_attempt_pass_rate=float(item.first_attempt_pass_rate)
                    if item.first_attempt_pass_rate is not None
                    else None,
                    avg_messages_per_session=float(item.avg_messages_per_session)
                    if item.avg_messages_per_session is not None
                    else None,
                    avg_persona_response_sec=float(item.avg_persona_response_sec)
                    if item.avg_persona_response_sec is not None
                    else None,
                    session_efficiency=float(item.session_efficiency)
                    if item.session_efficiency is not None
                    else None,
                    total_time_minutes=float(item.total_time_minutes)
                    if item.total_time_minutes is not None
                    else None,
                    improvement_rate=float(item.improvement_rate)
                    if item.improvement_rate is not None
                    else None,
                    perfect_score_count=item.perfect_score_count or 0,
                    quickest_pass_minutes=float(item.quickest_pass_minutes)
                    if item.quickest_pass_minutes is not None
                    else None,
                    first_attempt_at=item.first_attempt_at,
                    last_attempt_at=item.last_attempt_at,
                    simulation_ids=list(item.simulation_ids)
                    if item.simulation_ids
                    else [],
                    scenario_ids=list(item.scenario_ids) if item.scenario_ids else [],
                    cohort_ids=list(item.cohort_ids) if item.cohort_ids else [],
                )
            )

    response = GetProfileMetricsResponse(
        items=items,
        total_count=result.total_count or 0 if result else 0,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "analytics", "profile_metrics"],
    )

    return response


@router.post(
    "/get",
    response_model=GetProfileMetricsResponse,
    dependencies=[
        audit_activity(
            "views.analytics.profile_metrics.get",
            "{{ actor.name }} fetched analytics profile metrics data",
        )
    ],
)
async def get_profile_metrics(
    request: GetProfileMetricsRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetProfileMetricsResponse:
    """Get profile metrics data from mv_profile_metrics with filter/search only (no joins)."""
    tags = ["views", "analytics", "profile_metrics"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        result = await get_profile_metrics_internal(
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
            operation="views_analytics_profile_metrics_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
