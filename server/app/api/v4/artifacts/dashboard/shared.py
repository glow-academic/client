"""Shared data-fetching helpers for dashboard section endpoints.

Extracted from get.py to enable reuse across header/primary/secondary/footer.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

import asyncpg

from app.api.v4.artifacts.dashboard.types import DashboardSectionRequest
from app.api.v4.resources.rubrics.get import get_rubrics_batch_internal
from app.api.v4.views.analytics.profile_facts.types import GetProfileFactsResponse
from app.api.v4.views.analytics.rubric_facts.types import GetRubricFactsResponse
from app.api.v4.views.analytics.scenario_facts.types import GetScenarioFactsResponse
from app.api.v4.views.analytics.simulation_facts.types import (
    GetSimulationFactsResponse,
)
from app.sql.types import GetActiveSettingsSqlParams, GetActiveSettingsSqlRow
from app.utils.sql_helper import execute_sql_typed

ACTIVE_SETTINGS_SQL_PATH = (
    "app/sql/v4/queries/settings/get_active_settings_complete.sql"
)


@dataclass
class ParsedFilters:
    """Parsed filter values from a dashboard section request."""

    simulation_ids: list[UUID] | None
    cohort_ids: list[UUID] | None
    parsed_start_date: datetime | None
    parsed_end_date: datetime | None
    is_archived: bool
    attempt_type: str | None


@dataclass
class Thresholds:
    """Dashboard threshold values."""

    success: int | float = 85
    warning: int | float = 80
    danger: int | float = 70

    def as_dict(self) -> dict[str, int | float]:
        return {
            "success": self.success,
            "warning": self.warning,
            "danger": self.danger,
        }


def parse_dashboard_filters(request: DashboardSectionRequest) -> ParsedFilters:
    """Parse common filter values from a dashboard section request."""
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

    return ParsedFilters(
        simulation_ids=None,  # Section requests don't have simulation_ids field
        cohort_ids=request.cohort_ids,
        parsed_start_date=parsed_start_date,
        parsed_end_date=parsed_end_date,
        is_archived=is_archived,
        attempt_type=attempt_type,
    )


async def fetch_thresholds(
    pool: asyncpg.Pool,
    actor_profile_id: UUID | None,
    target_profile_id: UUID | None,
    department_ids: list[UUID] | None,
) -> Thresholds:
    """Fetch threshold settings for the given profile/department."""
    thresholds = Thresholds()
    profile_for_settings = actor_profile_id or target_profile_id
    if profile_for_settings:
        async with pool.acquire() as c:
            settings_row_raw = await execute_sql_typed(
                c,
                ACTIVE_SETTINGS_SQL_PATH,
                params=GetActiveSettingsSqlParams(
                    profile_id=str(profile_for_settings),
                    department_id=(str(department_ids[0]) if department_ids else None),
                ),
            )
            if settings_row_raw:
                settings = GetActiveSettingsSqlRow.model_validate(settings_row_raw)
                thresholds.success = settings.success_threshold or thresholds.success
                thresholds.warning = settings.warning_threshold or thresholds.warning
                thresholds.danger = settings.danger_threshold or thresholds.danger
    return thresholds


async def fetch_rubric_facts_data(
    pool: asyncpg.Pool,
    request: DashboardSectionRequest,
    filters: ParsedFilters,
    bypass_cache: bool = False,
) -> "GetRubricFactsResponse":
    """Fetch rubric facts from mv_rubric_facts for primary section."""
    from app.api.v4.views.analytics.rubric_facts.get import get_rubric_facts_internal

    async with pool.acquire() as c:
        return await get_rubric_facts_internal(
            conn=c,
            profile_id=request.target_profile_id,
            cohort_ids=filters.cohort_ids,
            department_ids=request.department_ids,
            attempt_type=filters.attempt_type,
            is_archived=filters.is_archived,
            date_from=filters.parsed_start_date.date()
            if filters.parsed_start_date
            else None,
            date_to=filters.parsed_end_date.date() if filters.parsed_end_date else None,
            bypass_cache=bypass_cache,
        )


async def fetch_simulation_facts_data(
    pool: asyncpg.Pool,
    request: DashboardSectionRequest,
    filters: ParsedFilters,
    bypass_cache: bool = False,
) -> "GetSimulationFactsResponse":
    """Fetch simulation facts from mv_simulation_facts for secondary section."""
    from app.api.v4.views.analytics.simulation_facts.get import (
        get_simulation_facts_internal,
    )

    async with pool.acquire() as c:
        return await get_simulation_facts_internal(
            conn=c,
            profile_id=request.target_profile_id,
            cohort_ids=filters.cohort_ids,
            department_ids=request.department_ids,
            attempt_type=filters.attempt_type,
            is_archived=filters.is_archived,
            date_from=filters.parsed_start_date.date()
            if filters.parsed_start_date
            else None,
            date_to=filters.parsed_end_date.date() if filters.parsed_end_date else None,
            bypass_cache=bypass_cache,
        )


async def fetch_profile_facts_data(
    pool: asyncpg.Pool,
    request: DashboardSectionRequest,
    filters: ParsedFilters,
    bypass_cache: bool = False,
) -> "GetProfileFactsResponse":
    """Fetch profile facts from mv_profile_facts for header/leaderboard/reports."""
    from app.api.v4.views.analytics.profile_facts.get import (
        get_profile_facts_internal,
    )

    async with pool.acquire() as c:
        return await get_profile_facts_internal(
            conn=c,
            profile_id=request.target_profile_id,
            cohort_ids=filters.cohort_ids,
            department_ids=request.department_ids,
            simulation_ids=filters.simulation_ids,
            attempt_type=filters.attempt_type,
            is_archived=filters.is_archived,
            date_from=filters.parsed_start_date.date()
            if filters.parsed_start_date
            else None,
            date_to=filters.parsed_end_date.date() if filters.parsed_end_date else None,
            bypass_cache=bypass_cache,
        )


async def fetch_scenario_facts_data(
    pool: asyncpg.Pool,
    request: DashboardSectionRequest,
    filters: ParsedFilters,
    bypass_cache: bool = False,
) -> "GetScenarioFactsResponse":
    """Fetch scenario facts from mv_scenario_facts for footer section."""
    from app.api.v4.views.analytics.scenario_facts.get import (
        get_scenario_facts_internal,
    )

    async with pool.acquire() as c:
        return await get_scenario_facts_internal(
            conn=c,
            profile_id=request.target_profile_id,
            cohort_ids=filters.cohort_ids,
            department_ids=request.department_ids,
            attempt_type=filters.attempt_type,
            is_archived=filters.is_archived,
            date_from=filters.parsed_start_date.date()
            if filters.parsed_start_date
            else None,
            date_to=filters.parsed_end_date.date() if filters.parsed_end_date else None,
            bypass_cache=bypass_cache,
        )


async def hydrate_rubric_resources(
    pool: asyncpg.Pool,
    rubric_ids: list,
    bypass_cache: bool = False,
) -> tuple[list[Any], dict[str, str]]:
    """Hydrate rubric metadata and build standard_group_name_map.

    Returns:
        (rubrics, standard_group_name_map)
    """
    async with pool.acquire() as c:
        rubrics = await get_rubrics_batch_internal(
            conn=c,
            ids=rubric_ids,
            bypass_cache=bypass_cache,
        )

    # Build standard_group_name_map from rubric standard_groups
    standard_group_name_map: dict[str, str] = {}
    for rubric in rubrics:
        standard_groups = getattr(rubric, "standard_groups", None) or []
        for sg in standard_groups:
            sg_id = getattr(sg, "id", None) or getattr(sg, "standard_group_id", None)
            sg_name = getattr(sg, "name", None)
            if sg_id and sg_name:
                standard_group_name_map[str(sg_id)] = sg_name

    return rubrics, standard_group_name_map


def build_simulation_meta(simulations: list[Any]) -> list[dict]:
    """Build simulation metadata list from hydrated simulations."""
    return [
        {
            "simulation_id": str(item.simulation_id) if item.simulation_id else None,
            "name": item.name,
            "description": item.description,
            "department_ids": item.department_ids,
            "time_limit": None,
        }
        for item in simulations
    ]


def build_rubric_meta(rubrics: list[Any]) -> list[dict]:
    """Build rubric metadata list from hydrated rubrics."""
    return [
        {
            "rubric_id": str(item.rubric_id) if item.rubric_id else None,
            "name": item.name,
            "description": item.description,
        }
        for item in rubrics
    ]


def build_parameter_meta(parameters: list[Any]) -> list[dict]:
    """Build parameter metadata list from hydrated parameters."""
    return [
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


def build_field_meta(
    fields: list[Any],
    field_parameter_map: dict,
    parameters: list[Any],
) -> list[dict]:
    """Build field metadata list from hydrated fields."""
    parameter_name_map = {
        p.parameter_id: p.name for p in parameters if p.parameter_id is not None
    }
    return [
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
