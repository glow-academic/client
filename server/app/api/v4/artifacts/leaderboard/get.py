"""Get endpoint for leaderboard artifact."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.leaderboard.types import (
    LeaderboardRequest,
    LeaderboardResponse,
    LeaderboardViews,
    LeaderboardResources,
)
from app.api.v4.views.analytics.attempts.get import get_attempt_facts_internal
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db

router = APIRouter()


@router.post(
    "/get",
    response_model=LeaderboardResponse,
    dependencies=[
        audit_activity(
            "artifacts.leaderboard.get",
            "{{ actor.name }} fetched leaderboard artifact data",
        )
    ],
)
async def get_leaderboard(
    request: LeaderboardRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> LeaderboardResponse:
    """Get leaderboard artifact data."""
    tags = ["artifacts", "leaderboard"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        attempt_facts_result = await get_attempt_facts_internal(
            conn=conn,
            simulation_ids=[request.simulation_id] if request.simulation_id else None,
            cohort_ids=[request.cohort_id] if request.cohort_id else None,
            attempt_type="general",
            is_archived=False,
            sort_by="score",
            sort_order="desc",
            page_limit=request.page_limit,
            page_offset=request.page_offset,
            bypass_cache=bypass_cache,
        )

        profile_ids: set[str] = set()
        simulation_ids: set[str] = set()

        for item in attempt_facts_result.items:
            if item.profile_id:
                profile_ids.add(str(item.profile_id))
            if item.simulation_id:
                simulation_ids.add(str(item.simulation_id))

        views = LeaderboardViews(attempt_facts=attempt_facts_result.items)
        resources = LeaderboardResources(
            profiles={pid: {} for pid in profile_ids},
            simulations={sid: {} for sid in simulation_ids},
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return LeaderboardResponse(
            views=views,
            resources=resources,
            total_count=attempt_facts_result.total_count,
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="artifacts_leaderboard_get",
            request=http_request,
        )
