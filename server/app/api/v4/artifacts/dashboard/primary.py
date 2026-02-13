"""Primary section endpoint for dashboard artifact."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.dashboard.permissions import compute_primary_metrics
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
    DashboardPrimaryRequest,
    DashboardPrimaryResponse,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool

router = APIRouter()


@router.post(
    "/primary",
    response_model=DashboardPrimaryResponse,
    dependencies=[
        audit_activity(
            "artifacts.dashboard.primary",
            "{{ actor.name }} fetched dashboard primary section",
        )
    ],
)
async def get_dashboard_primary(
    request: DashboardPrimaryRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DashboardPrimaryResponse:
    """Get dashboard primary section data."""
    tags = ["artifacts", "dashboard", "views", "analytics", "primary"]
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

        primary_metrics = compute_primary_metrics(
            attempts=mv_data.attempts,
            daily_rows=mv_data.daily_rows,
            chat_rows=mv_data.chat_rows,
            profile_rows=mv_data.profile_rows,
            rubric_group_scores=resources.rubric_group_scores,
            persona_name_map=resources.persona_name_map,
            thresholds=thresholds.as_dict(),
        )

        # Apply picker filters (valid_*_ids stay intact for picker options)
        if request.persona_simulation_ids:
            filter_set = {str(sid) for sid in request.persona_simulation_ids}
            primary_metrics.persona_performance.chart_data = [
                row
                for row in primary_metrics.persona_performance.chart_data
                if any(sid in filter_set for sid in (row.simulation_ids or []))
            ]
        if request.heatmap_rubric_ids:
            filter_set = {str(rid) for rid in request.heatmap_rubric_ids}
            primary_metrics.rubric_heatmap.matrices = [
                m
                for m in primary_metrics.rubric_heatmap.matrices
                if m.rubric_id in filter_set
            ]

        simulations_meta = build_simulation_meta(resources.simulations)
        rubrics_meta = build_rubric_meta(resources.rubrics)

        # Apply search filters to metadata lists
        if request.persona_simulations_search:
            q = request.persona_simulations_search.lower()
            simulations_meta = [
                s for s in simulations_meta if q in (s.get("name") or "").lower()
            ]
        if request.heatmap_rubric_search:
            q = request.heatmap_rubric_search.lower()
            rubrics_meta = [
                r for r in rubrics_meta if q in (r.get("name") or "").lower()
            ]

        result = DashboardPrimaryResponse(
            primary_metrics=primary_metrics,
            simulations=simulations_meta,
            rubrics=rubrics_meta,
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
            operation="artifacts_dashboard_primary",
            request=http_request,
        )
