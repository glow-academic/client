"""Get endpoint for leaderboard artifact."""

import asyncio
from datetime import datetime
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.leaderboard.permissions import (
    build_leaderboard_rows,
    build_leaderboard_sections,
)
from app.api.v4.artifacts.leaderboard.types import (
    LeaderboardProfileResource,
    LeaderboardRequest,
    LeaderboardResources,
    LeaderboardResponse,
    LeaderboardScenarioResource,
    LeaderboardSections,
    LeaderboardSimulationResource,
    LeaderboardViews,
)
from app.api.v4.resources.profiles.get import get_profiles_internal
from app.api.v4.resources.scenarios.get import get_scenarios_internal
from app.api.v4.resources.simulations.get import get_simulations_batch_internal
from app.api.v4.views.analytics.attempts.get import get_attempt_facts_internal
from app.api.v4.views.analytics.chat_facts.get import get_chat_facts_internal
from app.api.v4.views.analytics.chat_facts.types import GetChatFactsRequest
from app.api.v4.views.analytics.daily_metrics.get import get_daily_metrics_internal
from app.api.v4.views.analytics.daily_metrics.types import GetDailyMetricsRequest
from app.api.v4.views.analytics.profile_metrics.get import get_profile_metrics_internal
from app.api.v4.views.analytics.profile_metrics.types import GetProfileMetricsRequest
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import GetActiveSettingsSqlParams, GetActiveSettingsSqlRow
from app.utils.sql_helper import execute_sql_typed

router = APIRouter()
ACTIVE_SETTINGS_SQL_PATH = (
    "app/sql/v4/queries/settings/get_active_settings_complete.sql"
)


@router.post(
    "/get",
    response_model=LeaderboardResponse,
    dependencies=[
        audit_activity(
            "artifacts.leaderboard.get",
            "{{ actor.name }} fetched leaderboard artifact data",
        )
    ],
)
async def get_leaderboard(
    request: LeaderboardRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> LeaderboardResponse:
    """Get leaderboard artifact data.

    Pulls four analytics MV slices in parallel and computes leaderboard
    section skeletons.
    """
    tags = ["artifacts", "leaderboard", "views", "analytics"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database pool not initialized")

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

        simulation_ids_filter = (
            request.simulation_ids
            if request.simulation_ids
            else ([request.simulation_id] if request.simulation_id else None)
        )
        cohort_ids_filter = (
            request.cohort_ids
            if request.cohort_ids
            else ([request.cohort_id] if request.cohort_id else None)
        )

        is_archived = bool(
            request.simulation_filters and "archived" in request.simulation_filters
        )
        if request.simulation_filters and "general" in request.simulation_filters:
            attempt_type = "general"
        elif request.simulation_filters and "practice" in request.simulation_filters:
            attempt_type = "practice"
        else:
            attempt_type = "general"

        async def fetch_attempts() -> tuple[list, int]:
            async with pool.acquire() as c:
                result = await get_attempt_facts_internal(
                    conn=c,
                    profile_id=request.target_profile_id,
                    attempt_type=attempt_type,
                    is_archived=is_archived,
                    simulation_ids=simulation_ids_filter,
                    cohort_ids=cohort_ids_filter,
                    department_ids=request.department_ids,
                    scenario_ids=request.scenario_ids,
                    date_from=parsed_start_date,
                    date_to=parsed_end_date,
                    search=request.search,
                    sort_by=request.sort_by
                    if request.sort_by in {"date", "score"}
                    else "score",
                    sort_order=request.sort_order,
                    page_limit=request.page_limit,
                    page_offset=request.page_offset,
                    bypass_cache=bypass_cache,
                )
                return result.items, result.total_count

        async def fetch_chat_facts() -> list:
            async with pool.acquire() as c:
                result = await get_chat_facts_internal(
                    conn=c,
                    request=GetChatFactsRequest(
                        profile_id=request.target_profile_id,
                        profile_ids=request.profile_ids,
                        simulation_ids=simulation_ids_filter,
                        cohort_ids=cohort_ids_filter,
                        department_ids=request.department_ids,
                        scenario_ids=request.scenario_ids,
                        attempt_type=attempt_type,
                        is_archived=is_archived,
                        date_from=parsed_start_date,
                        date_to=parsed_end_date,
                        search=request.search,
                        sort_by="date",
                        sort_order=request.sort_order,
                        page_limit=request.page_limit,
                        page_offset=request.page_offset,
                    ),
                    bypass_cache=bypass_cache,
                )
                return result.items

        async def fetch_daily_metrics() -> list:
            async with pool.acquire() as c:
                result = await get_daily_metrics_internal(
                    conn=c,
                    request=GetDailyMetricsRequest(
                        cohort_ids=cohort_ids_filter,
                        simulation_ids=simulation_ids_filter,
                        attempt_type=attempt_type,
                        is_archived=is_archived,
                        date_from=parsed_start_day,
                        date_to=parsed_end_day,
                    ),
                    bypass_cache=bypass_cache,
                )
                return result.items

        async def fetch_profile_metrics() -> tuple[list, int]:
            async with pool.acquire() as c:
                profile_sort_by = (
                    request.sort_by
                    if request.sort_by
                    in {
                        "avg_score",
                        "highest_score",
                        "total_attempts",
                        "improvement",
                        "last_attempt_at",
                    }
                    else "highest_score"
                )
                result = await get_profile_metrics_internal(
                    conn=c,
                    request=GetProfileMetricsRequest(
                        profile_id=request.target_profile_id,
                        profile_ids=request.profile_ids,
                        cohort_ids=cohort_ids_filter,
                        simulation_ids=simulation_ids_filter,
                        scenario_ids=request.scenario_ids,
                        attempt_type=attempt_type,
                        is_archived=is_archived,
                        sort_by=profile_sort_by,
                        sort_order=request.sort_order,
                        page_limit=request.page_limit,
                        page_offset=request.page_offset,
                    ),
                    bypass_cache=bypass_cache,
                )
                return result.items, result.total_count

        (
            (attempts, _attempt_total_count),
            chat_rows,
            daily_rows,
            (profile_rows, profile_total_count),
        ) = await asyncio.gather(
            fetch_attempts(),
            fetch_chat_facts(),
            fetch_daily_metrics(),
            fetch_profile_metrics(),
        )

        primary_color = "#171717"
        accent_color = "#f5f5f5"
        actor_profile_for_settings = (
            request.actor_profile_id or request.target_profile_id
        )
        if actor_profile_for_settings:
            async with pool.acquire() as c:
                settings_row_raw = await execute_sql_typed(
                    c,
                    ACTIVE_SETTINGS_SQL_PATH,
                    params=GetActiveSettingsSqlParams(
                        profile_id=str(actor_profile_for_settings),
                        department_id=(
                            str(request.department_ids[0])
                            if request.department_ids
                            else None
                        ),
                    ),
                )
                if settings_row_raw:
                    settings = GetActiveSettingsSqlRow.model_validate(settings_row_raw)
                    primary_color = settings.primary_color or primary_color
                    accent_color = settings.accent or accent_color

        profile_id_set = {row.profile_id for row in profile_rows}
        simulation_id_set = {
            simulation_id
            for row in profile_rows
            for simulation_id in row.simulation_ids
        }
        scenario_id_set = {
            scenario_id for row in profile_rows for scenario_id in row.scenario_ids
        }

        for item in attempts:
            if item.profile_id:
                profile_id_set.add(item.profile_id)
            if item.simulation_id:
                simulation_id_set.add(item.simulation_id)
            if item.scenario_ids:
                for scenario_id in item.scenario_ids:
                    scenario_id_set.add(scenario_id)
        for item in chat_rows:
            if item.profile_id:
                profile_id_set.add(item.profile_id)
            if item.simulation_id:
                simulation_id_set.add(item.simulation_id)
            if item.scenario_id:
                scenario_id_set.add(item.scenario_id)

        async def fetch_profiles() -> list:
            async with pool.acquire() as c:
                return await get_profiles_internal(
                    conn=c,
                    ids=list(profile_id_set),
                    bypass_cache=bypass_cache,
                )

        async def fetch_simulations() -> list:
            async with pool.acquire() as c:
                return await get_simulations_batch_internal(
                    conn=c,
                    ids=list(simulation_id_set),
                    bypass_cache=bypass_cache,
                )

        async def fetch_scenarios() -> list:
            async with pool.acquire() as c:
                return await get_scenarios_internal(
                    conn=c,
                    ids=list(scenario_id_set),
                    bypass_cache=bypass_cache,
                )

        profiles, simulations, scenarios = await asyncio.gather(
            fetch_profiles(),
            fetch_simulations(),
            fetch_scenarios(),
        )

        profile_name_by_id = {
            str(item.profile_id): item.name
            for item in profiles
            if item.profile_id is not None
        }
        data = build_leaderboard_rows(
            profile_rows,
            profile_name_by_id=profile_name_by_id,
            attempts=attempts,
            chat_rows=chat_rows,
            sort_by=request.sort_by,
            sort_order=request.sort_order,
            rank_offset=request.page_offset,
        )

        sections: LeaderboardSections = build_leaderboard_sections(
            attempts=attempts,
            chat_rows=chat_rows,
            daily_rows=daily_rows,
            profile_rows=profile_rows,
            rows=data,
        )

        views = LeaderboardViews(
            attempt_facts=attempts,
            chat_facts=chat_rows,
            daily_metrics=daily_rows,
            profile_metrics=profile_rows,
        )

        profile_resources = {
            str(item.profile_id): LeaderboardProfileResource(
                profile_id=str(item.profile_id),
                name=item.name,
                role=None,
            )
            for item in profiles
            if item.profile_id is not None
        }
        simulation_resources = {
            str(item.simulation_id): LeaderboardSimulationResource(
                simulation_id=str(item.simulation_id),
                name=item.title,
                description=item.description,
            )
            for item in simulations
            if item.simulation_id is not None
        }
        scenario_resources = {
            str(item.scenario_id): LeaderboardScenarioResource(
                scenario_id=str(item.scenario_id),
                name=item.name,
                description=item.description,
            )
            for item in scenarios
            if item.scenario_id is not None
        }

        resources = LeaderboardResources(
            profiles=profile_resources,
            simulations=simulation_resources,
            scenarios=scenario_resources,
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return LeaderboardResponse(
            sections=sections,
            data=data,
            views=views,
            resources=resources,
            primary_color=primary_color,
            accent_color=accent_color,
            total_count=profile_total_count,
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="artifacts_leaderboard_get",
            request=http_request,
        )
