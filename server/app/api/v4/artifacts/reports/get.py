"""Get endpoint for reports artifact."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.reports.types import (
    ReportsRequest,
    ReportsResponse,
    ReportsViews,
    ReportsResources,
)
from app.api.v4.views.analytics.attempts.get import get_attempt_facts_internal
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db

router = APIRouter()


@router.post(
    "/get",
    response_model=ReportsResponse,
    dependencies=[
        audit_activity(
            "artifacts.reports.get",
            "{{ actor.name }} fetched reports artifact data",
        )
    ],
)
async def get_reports(
    request: ReportsRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ReportsResponse:
    """Get reports artifact data."""
    tags = ["artifacts", "reports"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        attempt_facts_result = await get_attempt_facts_internal(
            conn=conn,
            profile_id=request.profile_id,
            simulation_ids=[request.simulation_id] if request.simulation_id else None,
            cohort_ids=[request.cohort_id] if request.cohort_id else None,
            is_archived=False,
            page_limit=request.page_limit,
            page_offset=request.page_offset,
            bypass_cache=bypass_cache,
        )

        simulation_ids: set[str] = set()
        profile_ids: set[str] = set()
        scenario_ids: set[str] = set()

        for item in attempt_facts_result.items:
            if item.simulation_id:
                simulation_ids.add(str(item.simulation_id))
            if item.profile_id:
                profile_ids.add(str(item.profile_id))
            if item.scenario_ids:
                for sid in item.scenario_ids:
                    scenario_ids.add(str(sid))

        views = ReportsViews(attempt_facts=attempt_facts_result.items)
        resources = ReportsResources(
            simulations={sid: {} for sid in simulation_ids},
            profiles={pid: {} for pid in profile_ids},
            scenarios={sid: {} for sid in scenario_ids},
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return ReportsResponse(
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
            operation="artifacts_reports_get",
            request=http_request,
        )
