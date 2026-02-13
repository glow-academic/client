"""Secondary section endpoint for dashboard artifact."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.dashboard.permissions import compute_secondary_metrics
from app.api.v4.artifacts.dashboard.shared import (
    build_rubric_meta,
    build_simulation_meta,
    collect_resource_ids,
    fetch_base_mv_data,
    fetch_thresholds,
    hydrate_resources,
    parse_dashboard_filters,
)
from app.api.v4.artifacts.dashboard.types import (
    DashboardSecondaryRequest,
    DashboardSecondaryResponse,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool

router = APIRouter()


@router.post(
    "/secondary",
    response_model=DashboardSecondaryResponse,
    dependencies=[
        audit_activity(
            "artifacts.dashboard.secondary",
            "{{ actor.name }} fetched dashboard secondary section",
        )
    ],
)
async def get_dashboard_secondary(
    request: DashboardSecondaryRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DashboardSecondaryResponse:
    """Get dashboard secondary section data."""
    tags = ["artifacts", "dashboard", "views", "analytics", "secondary"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database pool not initialized")

        filters = parse_dashboard_filters(request)
        mv_data = await fetch_base_mv_data(
            pool=pool,
            request=request,
            filters=filters,
            bypass_cache=bypass_cache,
            include_first_attempt=False,
        )
        thresholds = await fetch_thresholds(
            pool=pool,
            actor_profile_id=request.actor_profile_id,
            target_profile_id=request.target_profile_id,
            department_ids=request.department_ids,
        )

        resource_ids = collect_resource_ids(mv_data)
        resources = await hydrate_resources(
            pool=pool,
            mv_data=mv_data,
            resource_ids=resource_ids,
            bypass_cache=bypass_cache,
        )

        secondary_metrics = compute_secondary_metrics(
            attempts=mv_data.attempts,
            daily_rows=mv_data.daily_rows,
            chat_rows=mv_data.chat_rows,
            profile_rows=mv_data.profile_rows,
            cohort_name_map=resources.cohort_name_map,
            rubric_group_scores=resources.rubric_group_scores,
            thresholds=thresholds.as_dict(),
        )

        result = DashboardSecondaryResponse(
            secondary_metrics=secondary_metrics,
            simulations=build_simulation_meta(resources.simulations),
            rubrics=build_rubric_meta(resources.rubrics),
            thresholds=thresholds.as_dict(),
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
            operation="artifacts_dashboard_secondary",
            request=http_request,
        )
