"""Footer section endpoint for dashboard artifact."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.dashboard.permissions import compute_footer_metrics
from app.api.v4.artifacts.dashboard.shared import (
    build_field_meta,
    build_parameter_meta,
    build_simulation_meta,
    collect_resource_ids,
    fetch_base_mv_data,
    fetch_thresholds,
    hydrate_resources,
    parse_dashboard_filters,
)
from app.api.v4.artifacts.dashboard.types import (
    DashboardFooterRequest,
    DashboardFooterResponse,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool

router = APIRouter()


@router.post(
    "/footer",
    response_model=DashboardFooterResponse,
    dependencies=[
        audit_activity(
            "artifacts.dashboard.footer",
            "{{ actor.name }} fetched dashboard footer section",
        )
    ],
)
async def get_dashboard_footer(
    request: DashboardFooterRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DashboardFooterResponse:
    """Get dashboard footer section data."""
    tags = ["artifacts", "dashboard", "views", "analytics", "footer"]
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

        footer_metrics = compute_footer_metrics(
            attempts=mv_data.attempts,
            daily_rows=mv_data.daily_rows,
            chat_rows=mv_data.chat_rows,
            profile_rows=mv_data.profile_rows,
            parameter_fields=resources.parameter_fields,
            parameters=resources.parameters,
            fields=resources.fields,
            simulation_name_map=resources.simulation_name_map,
            scenario_name_map=resources.scenario_name_map,
            thresholds=thresholds.as_dict(),
        )

        # Apply picker filters (valid_*_ids stay intact for picker options)
        if request.scenario_perf_parameter_ids:
            filter_set = {str(pid) for pid in request.scenario_perf_parameter_ids}
            footer_metrics.scenario_performance.attribute_attempt_facts = [
                f
                for f in footer_metrics.scenario_performance.attribute_attempt_facts
                if f.parameter_id in filter_set
            ]
            footer_metrics.scenario_performance.attribute_scenario_facts = [
                f
                for f in footer_metrics.scenario_performance.attribute_scenario_facts
                if f.parameter_id in filter_set
            ]
        if request.scenario_stats_parameter_ids:
            filter_set = {str(pid) for pid in request.scenario_stats_parameter_ids}
            footer_metrics.scenario_stats.numeric_attempt_facts = [
                f
                for f in footer_metrics.scenario_stats.numeric_attempt_facts
                if f.parameter_id in filter_set
            ]
            footer_metrics.scenario_stats.numeric_scenario_facts = [
                f
                for f in footer_metrics.scenario_stats.numeric_scenario_facts
                if f.parameter_id in filter_set
            ]
        if request.sim_perf_simulation_ids:
            filter_set = {str(sid) for sid in request.sim_perf_simulation_ids}
            footer_metrics.simulation_performance.scenario_facts = [
                f
                for f in footer_metrics.simulation_performance.scenario_facts
                if f.simulation_id in filter_set
            ]

        simulations_meta = build_simulation_meta(resources.simulations)
        parameters_meta = build_parameter_meta(resources.parameters)
        fields_meta = build_field_meta(
            resources.fields,
            resources.field_parameter_map,
            resources.parameters,
        )

        # Apply search filters to metadata lists
        if request.sim_perf_simulation_search:
            q = request.sim_perf_simulation_search.lower()
            simulations_meta = [
                s for s in simulations_meta if q in (s.get("name") or "").lower()
            ]
        if request.scenario_perf_param_search or request.scenario_stats_param_search:
            q = (
                request.scenario_perf_param_search
                or request.scenario_stats_param_search
                or ""
            ).lower()
            parameters_meta = [
                p for p in parameters_meta if q in (p.get("name") or "").lower()
            ]

        result = DashboardFooterResponse(
            footer_metrics=footer_metrics,
            simulations=simulations_meta,
            parameters=parameters_meta,
            fields=fields_meta,
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
            operation="artifacts_dashboard_footer",
            request=http_request,
        )
