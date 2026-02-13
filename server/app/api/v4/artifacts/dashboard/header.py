"""Header section endpoint for dashboard artifact."""

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.dashboard.permissions import compute_header_metrics
from app.api.v4.artifacts.dashboard.shared import (
    collect_resource_ids,
    fetch_base_mv_data,
    fetch_thresholds,
    hydrate_resources,
    parse_dashboard_filters,
)
from app.api.v4.artifacts.dashboard.types import (
    DashboardHeaderRequest,
    DashboardHeaderResponse,
)
from app.api.v4.artifacts.types import FilterOption
from app.api.v4.resources.profiles.get import get_profiles_internal
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool

router = APIRouter()


@router.post(
    "/header",
    response_model=DashboardHeaderResponse,
    dependencies=[
        audit_activity(
            "artifacts.dashboard.header",
            "{{ actor.name }} fetched dashboard header section",
        )
    ],
)
async def get_dashboard_header(
    request: DashboardHeaderRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DashboardHeaderResponse:
    """Get dashboard header section data."""
    tags = ["artifacts", "dashboard", "views", "analytics", "header"]
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
            include_first_attempt=True,
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

        header_metrics = compute_header_metrics(
            attempts=mv_data.attempts,
            daily_rows=mv_data.daily_rows,
            chat_rows=mv_data.chat_rows,
            profile_rows=mv_data.profile_rows,
            first_attempt_rows=mv_data.first_attempt_rows,
            simulation_scenario_counts=resources.simulation_scenario_counts,
            thresholds=thresholds.as_dict(),
        )

        simulation_options = [
            FilterOption(
                value=str(item.simulation_id) if item.simulation_id else "",
                label=item.name,
            )
            for item in resources.simulations
            if item.simulation_id
        ]

        result = DashboardHeaderResponse(
            header_metrics=header_metrics,
            thresholds=thresholds.as_dict(),
            simulation_options=simulation_options,
        )

        if request.target_profile_id:
            async with pool.acquire() as c:
                target_profiles = await get_profiles_internal(
                    conn=c,
                    ids=[UUID(str(request.target_profile_id))],
                    bypass_cache=bypass_cache,
                )
                if target_profiles:
                    tp = target_profiles[0]
                    result.profile_name = tp.name
                    result.profile_emails = tp.emails
                    result.profile_primary_email = tp.primary_email

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
            operation="artifacts_dashboard_header",
            request=http_request,
        )
