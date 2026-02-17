"""Secondary section endpoint for dashboard artifact."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.dashboard.permissions import compute_secondary_metrics_v2
from app.api.v4.artifacts.dashboard.shared import (
    build_simulation_meta,
    fetch_simulation_facts_data,
    fetch_thresholds,
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
    """Get dashboard secondary section data.

    Secondary section is simulation-focused:
    - Persona Performance (avg score per persona, trend by date)
    - Cohort Performance (pass rate, avg score per cohort x simulation)
    - Attempt Improvement (score progression by attempt number)

    All sourced from mv_attempt_facts (renamed from mv_cohort_facts).
    """
    tags = ["artifacts", "dashboard", "views", "analytics", "secondary"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database pool not initialized")

        filters = parse_dashboard_filters(request)

        # Single MV call: fetch simulation facts
        sim_facts_response = await fetch_simulation_facts_data(
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

        # Collect unique IDs for hydration
        persona_ids = list(
            {item.persona_id for item in sim_facts_response.items if item.persona_id}
        )
        simulation_ids = list(
            {
                item.simulation_id
                for item in sim_facts_response.items
                if item.simulation_id
            }
        )
        cohort_ids = list(
            {item.cohort_id for item in sim_facts_response.items if item.cohort_id}
        )

        # Hydrate resources
        from app.api.v4.resources.personas.get import get_personas_internal
        from app.api.v4.resources.simulations.get import get_simulations_internal

        async with pool.acquire() as c:
            personas = await get_personas_internal(
                conn=c, ids=persona_ids, bypass_cache=bypass_cache
            )
            simulations = await get_simulations_internal(
                conn=c, ids=simulation_ids, bypass_cache=bypass_cache
            )
            cohort_name_rows = (
                await c.fetch(
                    """
                SELECT id, name FROM cohorts_resource
                WHERE id = ANY($1::uuid[])
                """,
                    cohort_ids,
                )
                if cohort_ids
                else []
            )

        persona_name_map = {
            str(p.persona_id): p.name for p in personas if p.persona_id and p.name
        }
        cohort_name_map = {
            str(r["id"]): r["name"] for r in cohort_name_rows if r["id"] and r["name"]
        }

        # Compute secondary metrics from simulation facts
        secondary_metrics = compute_secondary_metrics_v2(
            simulation_facts=sim_facts_response.items,
            persona_name_map=persona_name_map,
            cohort_name_map=cohort_name_map,
            thresholds=thresholds.as_dict(),
        )

        # Apply picker filters (valid_*_ids stay intact for picker options)
        if request.persona_simulation_ids:
            filter_set = {str(sid) for sid in request.persona_simulation_ids}
            secondary_metrics.persona_performance.chart_data = [
                row
                for row in secondary_metrics.persona_performance.chart_data
                if any(sid in filter_set for sid in (row.simulation_ids or []))
            ]
        if request.cohort_simulation_ids:
            filter_set = {str(sid) for sid in request.cohort_simulation_ids}
            secondary_metrics.cohort_performance.simulation_facts = [
                f
                for f in secondary_metrics.cohort_performance.simulation_facts
                if f.simulation_id in filter_set
            ]
            secondary_metrics.cohort_performance.daily_facts = [
                f
                for f in secondary_metrics.cohort_performance.daily_facts
                if f.simulation_id in filter_set
            ]
        if request.improvement_simulation_ids:
            filter_set = {str(sid) for sid in request.improvement_simulation_ids}
            secondary_metrics.attempt_improvement.facts = [
                f
                for f in secondary_metrics.attempt_improvement.facts
                if f.simulation_id in filter_set
            ]

        simulations_meta = build_simulation_meta(simulations)

        # Apply search filters to metadata lists
        if (
            request.persona_simulations_search
            or request.cohort_simulations_search
            or request.improvement_simulations_search
        ):
            q = (
                request.persona_simulations_search
                or request.cohort_simulations_search
                or request.improvement_simulations_search
                or ""
            ).lower()
            simulations_meta = [
                s for s in simulations_meta if q in (s.get("name") or "").lower()
            ]

        result = DashboardSecondaryResponse(
            secondary_metrics=secondary_metrics,
            simulations=simulations_meta,
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
