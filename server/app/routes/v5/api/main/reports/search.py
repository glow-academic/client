"""Search endpoint for reports artifact — composable infra pattern."""

from datetime import datetime
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_pool, get_redis_client
from app.infra.reports_context import resolve_reports_context
from app.infra.reports_permissions import build_reports_sections_v2
from app.routes.v5.api.main.reports.types import (
    ReportsCohortResource,
    ReportsProfileResource,
    ReportsRequest,
    ReportsResources,
    ReportsResponse,
    ReportsScenarioResource,
    ReportsSections,
    ReportsSimulationResource,
    ReportsViews,
)
from app.routes.v5.api.main.types import FilterOption
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/get", response_model=ReportsResponse)
async def get_reports(
    request: ReportsRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ReportsResponse:
    """Get reports artifact data via composable context resolver."""
    tags = ["artifacts", "reports", "views", "analytics"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database pool not initialized")

        # ── Parse filters ─────────────────────────────────────────────
        parsed_start_date = (
            datetime.fromisoformat(request.start_date.replace("Z", "+00:00"))
            if request.start_date
            else None
        )
        parsed_end_date = (
            datetime.fromisoformat(request.end_date.replace("Z", "+00:00"))
            if request.end_date
            else None
        )
        parsed_start_day = parsed_start_date.date() if parsed_start_date else None
        parsed_end_day = parsed_end_date.date() if parsed_end_date else None

        is_archived = bool(
            request.simulation_filters and "archived" in request.simulation_filters
        )
        if request.simulation_filters and "general" in request.simulation_filters:
            attempt_type = "general"
        elif request.simulation_filters and "practice" in request.simulation_filters:
            attempt_type = "practice"
        else:
            attempt_type = None

        # ── Resolve context (entries + resources) ─────────────────────
        ctx = await resolve_reports_context(
            pool,
            get_redis_client(),
            target_profile_id=request.target_profile_id,
            actor_profile_id=request.actor_profile_id,
            cohort_ids=request.cohort_ids,
            department_ids=request.department_ids,
            simulation_ids=request.simulation_ids,
            attempt_type=attempt_type,
            is_archived=is_archived,
            date_from=parsed_start_day,
            date_to=parsed_end_day,
            bypass_cache=bypass_cache,
        )

        # ── Extract entries ───────────────────────────────────────────
        chat_items = ctx.entries.get("chat_items", [])
        thresholds = ctx.entries.get("thresholds", [{}])[0]
        total_count = len(chat_items)

        # ── Build sections (pure Python) ──────────────────────────────
        sections: ReportsSections = build_reports_sections_v2(
            profile_facts_items=chat_items,
            total_count=total_count,
            thresholds=thresholds,
        )

        views = ReportsViews(
            attempt_facts=[],
            chat_facts=[],
            daily_metrics=[],
            profile_metrics=[],
        )

        # ── Build resources from context ──────────────────────────────
        simulations_list = ctx.resources.get("simulations", None)
        profiles_list = ctx.resources.get("profiles", None)
        scenarios_list = ctx.resources.get("scenarios", None)
        cohorts_list = ctx.resources.get("cohorts", None)

        sim_selected = simulations_list.selected if simulations_list else []
        prof_selected = profiles_list.selected if profiles_list else []
        scen_selected = scenarios_list.selected if scenarios_list else []
        coh_selected = cohorts_list.selected if cohorts_list else []

        resources = ReportsResources(
            simulations={
                str(s.id): ReportsSimulationResource(
                    simulation_id=str(s.id),
                    name=s.name,
                    description=s.description,
                )
                for s in sim_selected
            },
            profiles={
                str(p.id): ReportsProfileResource(
                    profile_id=str(p.id),
                    name=p.name,
                    role=None,
                    emails=p.emails or [],
                    primary_email=p.primary_email,
                )
                for p in prof_selected
            },
            scenarios={
                str(s.id): ReportsScenarioResource(
                    scenario_id=str(s.id),
                    name=s.name,
                    description=s.description,
                )
                for s in scen_selected
            },
            cohorts={
                str(c.id): ReportsCohortResource(
                    cohort_id=str(c.id),
                    name=c.name,
                )
                for c in coh_selected
            },
            personas={},
            rubrics={},
        )

        # ── Build filter options ──────────────────────────────────────
        simulation_options = [
            FilterOption(value=sid, label=resources.simulations[sid].name)
            for sid in resources.simulations
            if resources.simulations[sid].name
        ]
        profile_options = [
            FilterOption(value=pid, label=resources.profiles[pid].name)
            for pid in resources.profiles
            if resources.profiles[pid].name
        ]
        scenario_options = [
            FilterOption(value=sid, label=resources.scenarios[sid].name)
            for sid in resources.scenarios
            if resources.scenarios[sid].name
        ]

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return ReportsResponse(
            sections=sections,
            views=views,
            resources=resources,
            total_count=total_count,
            simulation_options=simulation_options,
            profile_options=profile_options,
            scenario_options=scenario_options,
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
