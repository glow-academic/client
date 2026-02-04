"""Get endpoint for dashboard artifact."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.dashboard.types import (
    DashboardRequest,
    DashboardResponse,
    DashboardViews,
    DashboardResources,
)
from app.api.v4.views.analytics.attempts.get import get_attempt_facts_internal
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db

router = APIRouter()


@router.post(
    "/get",
    response_model=DashboardResponse,
    dependencies=[
        audit_activity(
            "artifacts.dashboard.get",
            "{{ actor.name }} fetched dashboard artifact data",
        )
    ],
)
async def get_dashboard(
    request: DashboardRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DashboardResponse:
    """Get dashboard artifact data.

    Combines attempt facts with resource metadata for the dashboard UI.
    """
    tags = ["artifacts", "dashboard"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        # Fetch attempt facts
        attempt_facts_result = await get_attempt_facts_internal(
            conn=conn,
            cohort_ids=[request.cohort_id] if request.cohort_id else None,
            simulation_ids=[request.simulation_id] if request.simulation_id else None,
            attempt_type="general",
            is_archived=False,
            page_limit=request.page_limit,
            page_offset=request.page_offset,
            bypass_cache=bypass_cache,
        )

        # Collect resource IDs
        simulation_ids: set[str] = set()
        cohort_ids: set[str] = set()
        profile_ids: set[str] = set()

        for item in attempt_facts_result.items:
            if item.simulation_id:
                simulation_ids.add(str(item.simulation_id))
            if item.cohort_id:
                cohort_ids.add(str(item.cohort_id))
            if item.profile_id:
                profile_ids.add(str(item.profile_id))

        # Build response
        views = DashboardViews(attempt_facts=attempt_facts_result.items)
        resources = DashboardResources(
            simulations={sid: {} for sid in simulation_ids},
            cohorts={cid: {} for cid in cohort_ids},
            profiles={pid: {} for pid in profile_ids},
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return DashboardResponse(
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
            operation="artifacts_dashboard_get",
            request=http_request,
        )
