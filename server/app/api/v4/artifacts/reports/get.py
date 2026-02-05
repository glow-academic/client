"""Get endpoint for reports artifact."""

import asyncio
from datetime import datetime
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.reports.permissions import build_reports_sections
from app.api.v4.artifacts.reports.types import (
    ReportsCohortResource,
    ReportsPersonaResource,
    ReportsProfileResource,
    ReportsRequest,
    ReportsResources,
    ReportsResponse,
    ReportsRubricResource,
    ReportsScenarioResource,
    ReportsSections,
    ReportsSimulationResource,
    ReportsViews,
)
from app.api.v4.artifacts.types import FilterOption
from app.api.v4.resources.cohorts.get import get_cohorts_internal
from app.api.v4.resources.personas.get import get_personas_internal
from app.api.v4.resources.profiles.get import get_profiles_internal
from app.api.v4.resources.rubrics.get import get_rubrics_batch_internal
from app.api.v4.resources.scenarios.get import get_scenarios_internal
from app.api.v4.resources.simulations.get import get_simulations_batch_internal
from app.api.v4.views.analytics.attempts.get import get_attempt_facts_internal
from app.api.v4.views.analytics.chat_facts.get import get_chat_facts_internal
from app.api.v4.views.analytics.chat_facts.types import GetChatFactsRequest
from app.api.v4.views.analytics.daily_metrics.get import get_daily_metrics_internal
from app.api.v4.views.analytics.daily_metrics.types import GetDailyMetricsRequest
from app.api.v4.views.analytics.profile_metrics.get import (
    get_profile_metrics_internal,
)
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
    response_model=ReportsResponse,
    dependencies=[
        audit_activity(
            "artifacts.reports.get",
            "{{ actor.name }} fetched reports artifact data",
        )
    ],
)
async def get_reports(
    request: ReportsRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ReportsResponse:
    """Get reports artifact data.

    Pulls four analytics MV slices in parallel and computes section skeletons.
    """
    tags = ["artifacts", "reports", "views", "analytics"]
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

        is_archived = bool(
            request.simulation_filters and "archived" in request.simulation_filters
        )
        if request.simulation_filters and "general" in request.simulation_filters:
            attempt_type = "general"
        elif request.simulation_filters and "practice" in request.simulation_filters:
            attempt_type = "practice"
        else:
            attempt_type = None
        profile_sort_map = {
            "averageScore": "avg_score",
            "avg_score": "avg_score",
            "highestScore": "highest_score",
            "highest_score": "highest_score",
            "completionPercentage": "completion_pct",
            "completion_pct": "completion_pct",
            "firstAttemptPassRate": "first_attempt_pass_rate",
            "first_attempt_pass_rate": "first_attempt_pass_rate",
            "messagesPerSession": "avg_messages_per_session",
            "avg_messages_per_session": "avg_messages_per_session",
            "personaResponseTimes": "avg_persona_response_sec",
            "avg_persona_response_sec": "avg_persona_response_sec",
            "sessionEfficiency": "session_efficiency",
            "session_efficiency": "session_efficiency",
            "timeSpent": "total_time_minutes",
            "total_time_minutes": "total_time_minutes",
            "improvement": "improvement",
            "lastAttemptAt": "last_attempt_at",
            "last_attempt_at": "last_attempt_at",
            "totalAttempts": "total_attempts",
            "total_attempts": "total_attempts",
        }
        profile_sort_by = profile_sort_map.get(request.sort_by, "avg_score")

        async def fetch_attempts() -> tuple[list, int]:
            async with pool.acquire() as c:
                result = await get_attempt_facts_internal(
                    conn=c,
                    profile_id=request.target_profile_id,
                    attempt_type=attempt_type,
                    is_archived=is_archived,
                    simulation_ids=request.simulation_ids,
                    cohort_ids=request.cohort_ids,
                    department_ids=request.department_ids,
                    scenario_ids=request.scenario_ids,
                    date_from=parsed_start_date,
                    date_to=parsed_end_date,
                    search=request.search,
                    sort_by=request.sort_by,
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
                        simulation_ids=request.simulation_ids,
                        cohort_ids=request.cohort_ids,
                        department_ids=request.department_ids,
                        scenario_ids=request.scenario_ids,
                        attempt_type=attempt_type,
                        is_archived=is_archived,
                        date_from=parsed_start_date,
                        date_to=parsed_end_date,
                        search=request.search,
                        sort_by=request.sort_by,
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
                        cohort_ids=request.cohort_ids,
                        simulation_ids=request.simulation_ids,
                        attempt_type=attempt_type,
                        is_archived=is_archived,
                        date_from=parsed_start_day,
                        date_to=parsed_end_day,
                    ),
                    bypass_cache=bypass_cache,
                )
                return result.items

        async def fetch_profile_metrics() -> list:
            async with pool.acquire() as c:
                result = await get_profile_metrics_internal(
                    conn=c,
                    request=GetProfileMetricsRequest(
                        profile_id=request.target_profile_id,
                        profile_ids=request.profile_ids,
                        cohort_ids=request.cohort_ids,
                        simulation_ids=request.simulation_ids,
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
                return result.items

        (
            (attempts, total_count),
            chat_rows,
            daily_rows,
            profile_rows,
        ) = await asyncio.gather(
            fetch_attempts(),
            fetch_chat_facts(),
            fetch_daily_metrics(),
            fetch_profile_metrics(),
        )

        threshold_success = 85
        threshold_warning = 80
        threshold_danger = 70
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
                    threshold_success = settings.success_threshold or threshold_success
                    threshold_warning = settings.warning_threshold or threshold_warning
                    threshold_danger = settings.danger_threshold or threshold_danger

        sections: ReportsSections = build_reports_sections(
            attempts=attempts,
            chat_rows=chat_rows,
            daily_rows=daily_rows,
            profile_rows=profile_rows,
            total_count=total_count,
            thresholds={
                "success": threshold_success,
                "warning": threshold_warning,
                "danger": threshold_danger,
            },
        )

        views = ReportsViews(
            attempt_facts=attempts,
            chat_facts=chat_rows,
            daily_metrics=daily_rows,
            profile_metrics=profile_rows,
        )

        simulation_ids: set[str] = set()
        profile_ids: set[str] = set()
        scenario_ids: set[str] = set()
        cohort_ids: set[str] = set()
        persona_ids: set[str] = set()
        rubric_ids: set[str] = set()

        for item in attempts:
            if item.simulation_id:
                simulation_ids.add(str(item.simulation_id))
            if item.profile_id:
                profile_ids.add(str(item.profile_id))
            if item.cohort_id:
                cohort_ids.add(str(item.cohort_id))
            if item.scenario_ids:
                for scenario_id in item.scenario_ids:
                    scenario_ids.add(str(scenario_id))
            if item.persona_ids:
                for persona_id in item.persona_ids:
                    persona_ids.add(str(persona_id))

        for row in profile_rows:
            if row.simulation_ids:
                for simulation_id in row.simulation_ids:
                    simulation_ids.add(str(simulation_id))
            if row.scenario_ids:
                for scenario_id in row.scenario_ids:
                    scenario_ids.add(str(scenario_id))
            if row.cohort_ids:
                for cohort_id in row.cohort_ids:
                    cohort_ids.add(str(cohort_id))

        for row in chat_rows:
            if row.profile_id:
                profile_ids.add(str(row.profile_id))
            if row.simulation_id:
                simulation_ids.add(str(row.simulation_id))
            if row.cohort_id:
                cohort_ids.add(str(row.cohort_id))
            if row.scenario_id:
                scenario_ids.add(str(row.scenario_id))
            if row.persona_id:
                persona_ids.add(str(row.persona_id))
            if row.rubric_id:
                rubric_ids.add(str(row.rubric_id))

        resources = ReportsResources(
            simulations={
                simulation_id: ReportsSimulationResource(simulation_id=simulation_id)
                for simulation_id in simulation_ids
            },
            profiles={
                profile_id: ReportsProfileResource(profile_id=profile_id)
                for profile_id in profile_ids
            },
            scenarios={
                scenario_id: ReportsScenarioResource(scenario_id=scenario_id)
                for scenario_id in scenario_ids
            },
            cohorts={
                cohort_id: ReportsCohortResource(cohort_id=cohort_id)
                for cohort_id in cohort_ids
            },
            personas={
                persona_id: ReportsPersonaResource(persona_id=persona_id)
                for persona_id in persona_ids
            },
            rubrics={
                rubric_id: ReportsRubricResource(rubric_id=rubric_id)
                for rubric_id in rubric_ids
            },
        )

        # Hydrate minimal metadata for normalized resources
        async with pool.acquire() as c:
            simulations = await get_simulations_batch_internal(
                conn=c,
                ids=[UUID(simulation_id) for simulation_id in simulation_ids],
                bypass_cache=bypass_cache,
            )
            profiles = await get_profiles_internal(
                conn=c,
                ids=[UUID(profile_id) for profile_id in profile_ids],
                bypass_cache=bypass_cache,
            )
            scenarios = await get_scenarios_internal(
                conn=c,
                ids=[UUID(scenario_id) for scenario_id in scenario_ids],
                bypass_cache=bypass_cache,
            )
            cohorts = await get_cohorts_internal(
                conn=c,
                ids=[UUID(cohort_id) for cohort_id in cohort_ids],
                bypass_cache=bypass_cache,
            )
            personas = await get_personas_internal(
                conn=c,
                ids=[UUID(persona_id) for persona_id in persona_ids],
                bypass_cache=bypass_cache,
            )
            rubrics = await get_rubrics_batch_internal(
                conn=c,
                ids=[UUID(rubric_id) for rubric_id in rubric_ids],
                bypass_cache=bypass_cache,
            )

        for item in simulations:
            if item.simulation_id:
                key = str(item.simulation_id)
                resources.simulations[key] = ReportsSimulationResource(
                    simulation_id=key,
                    name=item.title,
                    description=item.description,
                )

        for item in profiles:
            if item.profile_id:
                key = str(item.profile_id)
                resources.profiles[key] = ReportsProfileResource(
                    profile_id=key,
                    name=item.name,
                    role=None,
                )

        for item in scenarios:
            if item.scenario_id:
                key = str(item.scenario_id)
                resources.scenarios[key] = ReportsScenarioResource(
                    scenario_id=key,
                    name=item.name,
                    description=item.description,
                )

        for item in cohorts:
            if item.cohort_id:
                key = str(item.cohort_id)
                resources.cohorts[key] = ReportsCohortResource(
                    cohort_id=key,
                    name=item.title,
                )

        for item in personas:
            if item.persona_id:
                key = str(item.persona_id)
                resources.personas[key] = ReportsPersonaResource(
                    persona_id=key,
                    name=item.name,
                    color=item.color,
                    icon=item.icon,
                )

        for item in rubrics:
            if item.rubric_id:
                key = str(item.rubric_id)
                resources.rubrics[key] = ReportsRubricResource(
                    rubric_id=key,
                    name=item.name,
                    description=item.description,
                )

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
