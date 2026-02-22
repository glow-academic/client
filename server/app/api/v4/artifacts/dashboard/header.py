"""Header section endpoint for dashboard artifact."""

import asyncio
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.dashboard.get import fetch_dashboard_history_data
from app.api.v4.artifacts.dashboard.permissions import compute_header_metrics_v2
from app.api.v4.artifacts.dashboard.shared import (
    fetch_chats_data,
    fetch_thresholds,
    get_message_stats_internal,
    parse_dashboard_filters,
)
from app.api.v4.artifacts.dashboard.types import (
    DashboardHeaderRequest,
    DashboardHeaderResponse,
)
from app.api.v4.artifacts.types import FilterOption
from app.api.v4.resources.profiles.get import get_profiles_internal
from app.api.v4.resources.simulations.get import get_simulations_internal
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

        profile_id = http_request.state.profile_id

        # 1. Parse filters
        filters = parse_dashboard_filters(request)

        # 2. Fetch chats + thresholds + optional history in parallel
        parallel_tasks: list = [
            fetch_chats_data(
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
        ]

        parallel_tasks.append(
            fetch_dashboard_history_data(
                pool,
                profile_resource_id=profile_id,
                target_profile_id=request.target_profile_id,
                start_date=request.start_date,
                end_date=request.end_date,
                cohort_ids=request.cohort_ids,
                department_ids=request.department_ids,
                history_practice=request.history_practice,
                history_scenario_ids=request.history_scenario_ids,
                history_infinite_mode=request.history_infinite_mode,
                history_show_archived=request.history_show_archived,
                history_sort_by=request.history_sort_by,
                history_sort_order=request.history_sort_order,
                history_page=request.history_page,
                history_page_size=request.history_page_size,
                history_simulation_search=request.history_simulation_search,
                history_scenario_search=request.history_scenario_search,
                history_profile_search=request.history_profile_search,
                bypass_cache=bypass_cache,
            )
        )

        parallel_results = await asyncio.gather(*parallel_tasks)
        chats_result = parallel_results[0]
        thresholds = parallel_results[1]
        history_data = parallel_results[2]

        chat_items = chats_result.items

        # 3. Enrich with message stats
        chat_ids = [item.chat_id for item in chat_items]
        if chat_ids:
            async with pool.acquire() as c:
                message_stats = await get_message_stats_internal(
                    conn=c,
                    chat_ids=chat_ids,
                    bypass_cache=bypass_cache,
                )
            for item in chat_items:
                stats = message_stats.get(item.chat_id)
                if stats:
                    item.num_messages_total = stats.num_messages_total
                    item.avg_response_sec = stats.avg_response_sec

        # 4. Collect simulation IDs from chat items
        simulation_ids_set = {item.simulation_id for item in chat_items}

        # 5. Hydrate simulations + compute scenario counts
        async with pool.acquire() as c:
            simulations = await get_simulations_internal(
                conn=c,
                ids=list(simulation_ids_set),
                bypass_cache=bypass_cache,
            )
            # Compute simulation → scenario count from scenarios_resource
            scenario_count_rows = (
                await c.fetch(
                    """
                    SELECT simulation_id, COUNT(*)::int AS scenario_count
                    FROM simulation_scenarios_junction
                    WHERE simulation_id = ANY($1::uuid[]) AND active = true
                    GROUP BY simulation_id
                    """,
                    list(simulation_ids_set),
                )
                if simulation_ids_set
                else []
            )
        simulation_scenario_counts = {
            str(r["simulation_id"]): r["scenario_count"] for r in scenario_count_rows
        }

        # 6. Compute header metrics
        header_metrics = compute_header_metrics_v2(
            profile_facts_items=chat_items,
            simulation_scenario_counts=simulation_scenario_counts,
            thresholds=thresholds.as_dict(),
        )

        # 7. Build simulation_options
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
            history=history_data,
        )

        # 8. Fetch target profile info if present
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
