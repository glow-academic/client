"""Primary section endpoint for dashboard artifact."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.dashboard.permissions import compute_primary_metrics_v2
from app.api.v4.artifacts.dashboard.shared import (
    build_rubric_meta,
    fetch_rubric_scores_data,
    fetch_thresholds,
    hydrate_rubric_resources,
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
    """Get dashboard primary section data.

    Primary section is rubric-focused:
    - Rubric Heatmap (correlation matrix)
    - Rubric Trend (score over time by standard group)
    - Skill Performance (radar chart per rubric)

    All sourced from mv_rubric_facts.
    """
    tags = ["artifacts", "dashboard", "views", "analytics", "primary"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database pool not initialized")

        filters = parse_dashboard_filters(request)

        # Single MV call: fetch rubric scores
        rubric_facts_response = await fetch_rubric_scores_data(
            pool=pool,
            request=request,
            filters=filters,
            bypass_cache=bypass_cache,
        )

        thresholds = await fetch_thresholds(
            pool=pool,
            actor_profile_id=request.actor_profile_id,
            target_profile_id=request.target_profile_id,
            department_ids=request.department_ids,
        )

        # Collect unique rubric IDs for hydration
        rubric_ids = list(
            {item.rubric_id for item in rubric_facts_response.items if item.rubric_id}
        )

        # Hydrate rubric resources (rubrics + standard_group_name_map)
        rubrics, standard_group_name_map = await hydrate_rubric_resources(
            pool=pool,
            rubric_ids=rubric_ids,
            bypass_cache=bypass_cache,
        )

        # Compute primary metrics from rubric facts
        primary_metrics = compute_primary_metrics_v2(
            rubric_facts=rubric_facts_response.items,
            standard_group_name_map=standard_group_name_map,
            thresholds=thresholds.as_dict(),
        )

        # Apply picker filters (valid_*_ids stay intact for picker options)
        if request.heatmap_rubric_ids:
            filter_set = {str(rid) for rid in request.heatmap_rubric_ids}
            primary_metrics.rubric_heatmap.matrices = [
                m
                for m in primary_metrics.rubric_heatmap.matrices
                if m.rubric_id in filter_set
            ]
        if request.trend_rubric_ids:
            filter_set = {str(rid) for rid in request.trend_rubric_ids}
            primary_metrics.rubric_trend.trend_data = [
                t
                for t in primary_metrics.rubric_trend.trend_data
                # Keep all trend data when rubric filter is applied
                # (trend aggregates across rubrics by standard_group)
            ]
        if request.skill_rubric_ids:
            filter_set = {str(rid) for rid in request.skill_rubric_ids}
            primary_metrics.skill_performance.packages = [
                p
                for p in primary_metrics.skill_performance.packages
                if p.rubric_id in filter_set
            ]

        rubrics_meta = build_rubric_meta(rubrics)

        # Apply search filters to metadata lists
        if (
            request.heatmap_rubric_search
            or request.trend_rubric_search
            or request.skill_rubric_search
        ):
            q = (
                request.heatmap_rubric_search
                or request.trend_rubric_search
                or request.skill_rubric_search
                or ""
            ).lower()
            rubrics_meta = [
                r for r in rubrics_meta if q in (r.get("name") or "").lower()
            ]

        result = DashboardPrimaryResponse(
            primary_metrics=primary_metrics,
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
