"""Header section endpoint for dashboard artifact."""

import asyncio
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.dashboard.permissions import compute_header_metrics_v2
from app.api.v4.artifacts.dashboard.shared import (
    fetch_profile_facts_data,
    fetch_thresholds,
    parse_dashboard_filters,
)
from app.api.v4.artifacts.dashboard.types import (
    DashboardHeaderRequest,
    DashboardHeaderResponse,
)
from app.api.v4.artifacts.types import FilterOption
from app.api.v4.resources.profiles.get import get_profiles_internal
from app.api.v4.resources.simulations.get import get_simulations_internal
from app.api.v4.views.analytics.simulation_scenario_counts.get import (
    get_simulation_scenario_counts_internal,
)
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

        # 1. Parse filters
        filters = parse_dashboard_filters(request)

        # 2. Fetch profile facts + thresholds in parallel
        profile_facts_result, thresholds = await asyncio.gather(
            fetch_profile_facts_data(
                pool=pool,
                request=request,
                filters=filters,
                bypass_cache=bypass_cache,
            ),
            fetch_thresholds(
                pool=pool,
                actor_profile_id=request.actor_profile_id,
                target_profile_id=request.target_profile_id,
                department_ids=request.department_ids,
            ),
        )
        profile_facts_items = profile_facts_result.items

        # 3. Collect simulation IDs from profile facts
        simulation_ids_set = {item.simulation_id for item in profile_facts_items}

        # 4. Hydrate simulations + simulation_scenario_counts
        async with pool.acquire() as c:
            simulations, ssc = await asyncio.gather(
                get_simulations_internal(
                    conn=c,
                    ids=list(simulation_ids_set),
                    bypass_cache=bypass_cache,
                ),
                get_simulation_scenario_counts_internal(
                    conn=c,
                    simulation_ids=list(simulation_ids_set),
                ),
            )
        simulation_scenario_counts = {
            str(i.simulation_id): i.scenario_count for i in ssc.items
        }

        # 5. Compute header metrics
        header_metrics = compute_header_metrics_v2(
            profile_facts_items=profile_facts_items,
            simulation_scenario_counts=simulation_scenario_counts,
            thresholds=thresholds.as_dict(),
        )

        # 6. Build simulation_options
        simulation_options = [
            FilterOption(
                value=str(item.simulation_id) if item.simulation_id else "",
                label=item.name,
            )
            for item in simulations
            if item.simulation_id
        ]

        result = DashboardHeaderResponse(
            header_metrics=header_metrics,
            thresholds=thresholds.as_dict(),
            simulation_options=simulation_options,
        )

        # 7. Fetch target profile info if present
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
