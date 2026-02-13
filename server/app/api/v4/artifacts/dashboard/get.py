"""Get endpoint for dashboard artifact."""

import asyncio
from datetime import datetime
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.dashboard.permissions import build_dashboard_bundle
from app.api.v4.artifacts.dashboard.types import (
    DashboardBundleResponse,
    DashboardRequest,
)
from app.api.v4.artifacts.types import FilterOption
from app.api.v4.resources.fields.get import get_fields_internal
from app.api.v4.resources.parameter_fields.get import get_parameter_fields_internal
from app.api.v4.resources.parameters.get import get_parameters_internal
from app.api.v4.resources.personas.get import get_personas_internal
from app.api.v4.resources.profiles.get import get_profiles_internal
from app.api.v4.resources.rubrics.get import get_rubrics_batch_internal
from app.api.v4.resources.scenarios.get import get_scenarios_internal
from app.api.v4.resources.simulations.get import get_simulations_internal
from app.api.v4.views.analytics.attempts.get import get_attempt_facts_internal
from app.api.v4.views.analytics.chat_facts.get import (
    get_chat_facts_internal,
)
from app.api.v4.views.analytics.chat_facts.types import GetChatFactsRequest
from app.api.v4.views.analytics.daily_metrics.get import (
    get_daily_metrics_internal,
)
from app.api.v4.views.analytics.daily_metrics.types import GetDailyMetricsRequest
from app.api.v4.views.analytics.first_attempt_pass.get import (
    get_first_attempt_pass_internal,
)
from app.api.v4.views.analytics.first_attempt_pass.types import (
    GetFirstAttemptPassRequest,
)
from app.api.v4.views.analytics.profile_metrics.get import (
    get_profile_metrics_internal,
)
from app.api.v4.views.analytics.profile_metrics.types import GetProfileMetricsRequest
from app.api.v4.views.analytics.rubric_group_scores.get import (
    get_rubric_group_scores_internal,
)
from app.api.v4.views.analytics.simulation_scenario_counts.get import (
    get_simulation_scenario_counts_internal,
)
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
    response_model=DashboardBundleResponse,
    dependencies=[
        audit_activity(
            "artifacts.dashboard.get",
            "{{ actor.name }} fetched dashboard artifact data",
        )
    ],
)
async def get_dashboard(
    request: DashboardRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DashboardBundleResponse:
    """Get dashboard artifact data.

    Fetches analytics MV slices in parallel and assembles dashboard bundle.
    Business calculations are performed in permissions.py.
    """
    tags = ["artifacts", "dashboard", "views", "analytics"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database pool not initialized")

        simulation_ids_filter = request.simulation_ids
        cohort_ids_filter = request.cohort_ids
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
        is_archived = bool(
            request.simulation_filters and "archived" in request.simulation_filters
        )
        if request.simulation_filters and "general" in request.simulation_filters:
            attempt_type = "general"
        elif request.simulation_filters and "practice" in request.simulation_filters:
            attempt_type = "practice"
        else:
            attempt_type = None

        async def fetch_attempts() -> list:
            async with pool.acquire() as c:
                result = await get_attempt_facts_internal(
                    conn=c,
                    profile_id=request.target_profile_id,
                    attempt_type=attempt_type,
                    is_archived=is_archived,
                    simulation_ids=simulation_ids_filter,
                    cohort_ids=cohort_ids_filter,
                    department_ids=request.department_ids,
                    date_from=parsed_start_date,
                    date_to=parsed_end_date,
                    page_limit=request.page_limit,
                    page_offset=request.page_offset,
                    bypass_cache=bypass_cache,
                )
                return result.items

        async def fetch_chat_facts() -> list:
            async with pool.acquire() as c:
                result = await get_chat_facts_internal(
                    conn=c,
                    request=GetChatFactsRequest(
                        profile_id=request.target_profile_id,
                        simulation_ids=simulation_ids_filter,
                        cohort_ids=cohort_ids_filter,
                        department_ids=request.department_ids,
                        attempt_type=attempt_type,
                        is_archived=is_archived,
                        date_from=parsed_start_date,
                        date_to=parsed_end_date,
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
                        cohort_ids=cohort_ids_filter,
                        simulation_ids=simulation_ids_filter,
                        attempt_type=attempt_type,
                        is_archived=is_archived,
                        page_limit=request.page_limit,
                        page_offset=request.page_offset,
                    ),
                    bypass_cache=bypass_cache,
                )
                return result.items

        async def fetch_first_attempt_rows() -> list:
            async with pool.acquire() as c:
                result = await get_first_attempt_pass_internal(
                    conn=c,
                    request=GetFirstAttemptPassRequest(
                        profile_id=request.target_profile_id,
                        cohort_ids=cohort_ids_filter,
                        department_ids=request.department_ids,
                        attempt_type=attempt_type,
                        is_archived=is_archived,
                        date_from=parsed_start_date,
                        date_to=parsed_end_date,
                    ),
                )
                return result.items

        (
            attempts,
            chat_rows,
            daily_rows,
            profile_rows,
            first_attempt_rows,
        ) = await asyncio.gather(
            fetch_attempts(),
            fetch_chat_facts(),
            fetch_daily_metrics(),
            fetch_profile_metrics(),
            fetch_first_attempt_rows(),
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

        chat_ids = [row.chat_id for row in chat_rows]
        async with pool.acquire() as c:
            rubric_group_scores = await get_rubric_group_scores_internal(
                conn=c,
                chat_ids=chat_ids,
            )

        # Resource joins/hydration on top of MV slices
        simulation_ids: set = set()
        rubric_ids: set = set()
        parameter_field_ids: set = set()
        persona_ids: set = set()
        cohort_ids: set = set()
        scenario_ids: set = set()
        for item in attempts:
            if item.simulation_id:
                simulation_ids.add(item.simulation_id)
        for row in daily_rows:
            if row.simulation_id:
                simulation_ids.add(row.simulation_id)
            if row.cohort_id:
                cohort_ids.add(row.cohort_id)
        for row in chat_rows:
            if row.simulation_id:
                simulation_ids.add(row.simulation_id)
            if row.rubric_id:
                rubric_ids.add(row.rubric_id)
            if row.persona_id:
                persona_ids.add(row.persona_id)
            if row.cohort_id:
                cohort_ids.add(row.cohort_id)
            if row.scenario_id:
                scenario_ids.add(row.scenario_id)
            parameter_field_ids.update(
                pfid for pfid in row.parameter_field_ids if pfid is not None
            )
            parameter_field_ids.update(
                pfid for pfid in row.persona_parameter_field_ids if pfid is not None
            )
            parameter_field_ids.update(
                pfid for pfid in row.document_parameter_field_ids if pfid is not None
            )

        async with pool.acquire() as c:
            simulations = await get_simulations_internal(
                conn=c,
                ids=list(simulation_ids),
                bypass_cache=bypass_cache,
            )
            rubrics = await get_rubrics_batch_internal(
                conn=c,
                ids=list(rubric_ids),
                bypass_cache=bypass_cache,
            )
            parameter_fields = await get_parameter_fields_internal(
                conn=c,
                ids=list(parameter_field_ids),
                bypass_cache=bypass_cache,
            )
            simulation_scenario_counts = await get_simulation_scenario_counts_internal(
                conn=c,
                simulation_ids=list(simulation_ids),
            )

        parameter_ids: set = set()
        field_ids: set = set()
        field_parameter_map: dict = {}
        for pf in parameter_fields:
            if pf.parameter_id:
                parameter_ids.add(pf.parameter_id)
            if pf.field_id:
                field_ids.add(pf.field_id)
                if pf.parameter_id:
                    field_parameter_map[pf.field_id] = pf.parameter_id

        async with pool.acquire() as c:
            parameters = await get_parameters_internal(
                conn=c,
                ids=list(parameter_ids),
                bypass_cache=bypass_cache,
            )
            fields = await get_fields_internal(
                conn=c,
                ids=list(field_ids),
                bypass_cache=bypass_cache,
            )

        # Resolve resource names via batch fetch
        async with pool.acquire() as c:
            personas = await get_personas_internal(
                conn=c,
                ids=list(persona_ids),
                bypass_cache=bypass_cache,
            )
            cohort_name_rows = (
                await c.fetch(
                    """
                SELECT id, name FROM cohorts_resource
                WHERE id = ANY($1::uuid[])
                """,
                    list(cohort_ids),
                )
                if cohort_ids
                else []
            )
            scenarios = await get_scenarios_internal(
                conn=c,
                ids=list(scenario_ids),
                bypass_cache=bypass_cache,
            )
        persona_name_map: dict[str, str] = {
            str(p.persona_id): p.name for p in personas if p.persona_id and p.name
        }
        cohort_name_map: dict[str, str] = {
            str(r["id"]): r["name"] for r in cohort_name_rows if r["id"] and r["name"]
        }
        scenario_name_map: dict[str, str] = {
            str(s.scenario_id): s.name for s in scenarios if s.scenario_id and s.name
        }
        simulation_name_map: dict[str, str] = {
            str(s.simulation_id): s.name
            for s in simulations
            if s.simulation_id and s.name
        }

        # Assemble business calculations from MV slices (+ resource metadata for footer logic)
        bundle = build_dashboard_bundle(
            attempts=attempts,
            daily_rows=daily_rows,
            chat_rows=chat_rows,
            profile_rows=profile_rows,
            parameter_fields=parameter_fields,
            parameters=parameters,
            fields=fields,
            rubric_group_scores=rubric_group_scores.items,
            first_attempt_rows=first_attempt_rows,
            simulation_scenario_counts={
                str(i.simulation_id): i.scenario_count
                for i in simulation_scenario_counts.items
            },
            persona_name_map=persona_name_map,
            cohort_name_map=cohort_name_map,
            simulation_name_map=simulation_name_map,
            scenario_name_map=scenario_name_map,
            thresholds={
                "success": threshold_success,
                "warning": threshold_warning,
                "danger": threshold_danger,
            },
        )
        bundle.thresholds = {
            "success": threshold_success,
            "warning": threshold_warning,
            "danger": threshold_danger,
        }

        bundle.simulations = [
            {
                "simulation_id": str(item.simulation_id)
                if item.simulation_id
                else None,
                "name": item.name,
                "description": item.description,
                "department_ids": item.department_ids,
                "time_limit": None,  # TODO: time_limit not on simulations_resource
            }
            for item in simulations
        ]
        bundle.rubrics = [
            {
                "rubric_id": str(item.rubric_id) if item.rubric_id else None,
                "name": item.name,
                "description": item.description,
            }
            for item in rubrics
        ]
        parameter_name_map = {
            p.parameter_id: p.name for p in parameters if p.parameter_id is not None
        }
        bundle.parameters = [
            {
                "parameter_id": str(item.parameter_id) if item.parameter_id else None,
                "name": item.name,
                "description": item.description,
                "numerical": None,
                "document_parameter": item.document_parameter,
                "persona_parameter": item.persona_parameter,
            }
            for item in parameters
        ]
        bundle.fields = [
            {
                "field_id": str(item.field_id) if item.field_id else None,
                "name": item.name,
                "description": item.description,
                "parameter_id": (
                    str(field_parameter_map.get(item.field_id))
                    if item.field_id and field_parameter_map.get(item.field_id)
                    else None
                ),
                "parameter_name": (
                    parameter_name_map.get(field_parameter_map.get(item.field_id))
                    if item.field_id and field_parameter_map.get(item.field_id)
                    else None
                ),
            }
            for item in fields
        ]

        bundle.simulation_options = [
            FilterOption(
                value=str(item.simulation_id) if item.simulation_id else "",
                label=item.name,
            )
            for item in simulations
            if item.simulation_id
        ]

        # Hydrate target profile metadata (for single-profile report pages)
        if request.target_profile_id:
            async with pool.acquire() as c:
                target_profiles = await get_profiles_internal(
                    conn=c,
                    ids=[UUID(str(request.target_profile_id))],
                    bypass_cache=bypass_cache,
                )
                if target_profiles:
                    tp = target_profiles[0]
                    bundle.profile_name = tp.name
                    bundle.profile_emails = tp.emails
                    bundle.profile_primary_email = tp.primary_email

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return bundle

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="artifacts_dashboard_get",
            request=http_request,
        )
