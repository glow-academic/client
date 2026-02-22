"""Insights endpoint — returns historical insights for the current page."""

from __future__ import annotations

from typing import Annotated, Any

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request

from app.api.v4.auth.route_permissions import compute_page_metadata
from app.api.v4.auth.types import GetInsightsApiResponse, InsightItem
from app.api.v4.entries.activity_insights.search import (
    search_activity_insights_entries_internal,
)
from app.api.v4.entries.attempt_insights.search import (
    search_attempt_insights_entries_internal,
)
from app.api.v4.entries.benchmark_insights.search import (
    search_benchmark_insights_entries_internal,
)
from app.api.v4.entries.dashboard_insights.search import (
    search_dashboard_insights_entries_internal,
)
from app.api.v4.entries.health_insights.search import (
    search_health_insights_entries_internal,
)
from app.api.v4.entries.home_insights.search import (
    search_home_insights_entries_internal,
)
from app.api.v4.entries.leaderboard_insights.search import (
    search_leaderboard_insights_entries_internal,
)
from app.api.v4.entries.practice_insights.search import (
    search_practice_insights_entries_internal,
)
from app.api.v4.entries.pricing_insights.search import (
    search_pricing_insights_entries_internal,
)
from app.api.v4.entries.record_insights.search import (
    search_record_insights_entries_internal,
)
from app.api.v4.entries.reports_insights.search import (
    search_reports_insights_entries_internal,
)
from app.api.v4.entries.test_insights.search import (
    search_test_insights_entries_internal,
)
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool

router = APIRouter()

# Artifact type → per-artifact insights search internal function
_ARTIFACT_INSIGHTS_FN = {
    "activity": search_activity_insights_entries_internal,
    "attempt": search_attempt_insights_entries_internal,
    "benchmark": search_benchmark_insights_entries_internal,
    "dashboard": search_dashboard_insights_entries_internal,
    "health": search_health_insights_entries_internal,
    "home": search_home_insights_entries_internal,
    "leaderboard": search_leaderboard_insights_entries_internal,
    "practice": search_practice_insights_entries_internal,
    "pricing": search_pricing_insights_entries_internal,
    "record": search_record_insights_entries_internal,
    "reports": search_reports_insights_entries_internal,
    "test": search_test_insights_entries_internal,
}


def _convert_insight(item: Any) -> InsightItem:
    """Convert a search result dict to the API response format."""
    if isinstance(item, dict):
        created_at_raw = item.get("created_at")
        return InsightItem(
            id=str(item["id"]) if item.get("id") else None,
            created_at=created_at_raw.isoformat()
            if hasattr(created_at_raw, "isoformat")
            else str(created_at_raw)
            if created_at_raw
            else None,
            group_id=str(item["group_id"]) if item.get("group_id") else None,
            content=item.get("content"),
        )
    # Attribute-style access fallback
    created_at_raw = getattr(item, "created_at", None)
    return InsightItem(
        id=str(item.id) if getattr(item, "id", None) else None,
        created_at=created_at_raw.isoformat()
        if hasattr(created_at_raw, "isoformat")
        else str(created_at_raw)
        if created_at_raw
        else None,
        group_id=str(item.group_id) if getattr(item, "group_id", None) else None,
        content=getattr(item, "content", None),
    )


@router.post("/insights", response_model=GetInsightsApiResponse)
async def get_insights(
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetInsightsApiResponse:
    """Return historical insights for the current page's artifact type."""
    try:
        try:
            profile_id_str = http_request.state.profile_id
        except AttributeError:
            profile_id_str = None

        if not profile_id_str:
            return GetInsightsApiResponse(insights=[])

        pathname = http_request.headers.get("X-Pathname", "")
        metadata = compute_page_metadata(pathname, [])
        artifact_type = metadata.artifact_type
        if not artifact_type:
            return GetInsightsApiResponse(insights=[])

        internal_fn = _ARTIFACT_INSIGHTS_FN.get(artifact_type)
        if not internal_fn:
            return GetInsightsApiResponse(insights=[])

        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

        pool = get_pool()
        if not pool:
            raise HTTPException(status_code=500, detail="Database pool not available")

        async with pool.acquire() as c:
            items = await internal_fn(
                c,
                limit_count=20,
                offset_count=0,
                bypass_cache=bypass_cache,
            )

        return GetInsightsApiResponse(
            insights=[_convert_insight(item) for item in items]
        )

    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_insights",
            request=http_request,
        )
