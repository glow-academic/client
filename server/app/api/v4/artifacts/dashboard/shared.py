"""Shared data-fetching helpers for dashboard section endpoints.

Extracted from get.py to enable reuse across header/primary/secondary/footer.
"""

import asyncio
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from uuid import UUID

import asyncpg

from app.api.v4.artifacts.dashboard.types import DashboardSectionRequest
from app.api.v4.resources.fields.get import get_fields_internal
from app.api.v4.resources.parameter_fields.get import get_parameter_fields_internal
from app.api.v4.resources.parameters.get import get_parameters_internal
from app.api.v4.resources.personas.get import get_personas_internal
from app.api.v4.resources.rubrics.get import get_rubrics_batch_internal
from app.api.v4.resources.scenarios.get import get_scenarios_internal
from app.api.v4.resources.simulations.get import get_simulations_internal
from app.api.v4.views.analytics.attempts.get import get_attempt_facts_internal
from app.api.v4.views.analytics.attempts.types import AttemptFactsItem
from app.api.v4.views.analytics.chat_facts.get import get_chat_facts_internal
from app.api.v4.views.analytics.chat_facts.types import (
    ChatFactsItem,
    GetChatFactsRequest,
)
from app.api.v4.views.analytics.daily_metrics.get import get_daily_metrics_internal
from app.api.v4.views.analytics.daily_metrics.types import (
    DailyMetricsItem,
    GetDailyMetricsRequest,
)
from app.api.v4.views.analytics.first_attempt_pass.get import (
    get_first_attempt_pass_internal,
)
from app.api.v4.views.analytics.first_attempt_pass.types import (
    FirstAttemptPassItem,
    GetFirstAttemptPassRequest,
)
from app.api.v4.views.analytics.profile_metrics.get import (
    get_profile_metrics_internal,
)
from app.api.v4.views.analytics.profile_metrics.types import (
    GetProfileMetricsRequest,
    ProfileMetricsItem,
)
from app.api.v4.views.analytics.rubric_facts.types import GetRubricFactsResponse
from app.api.v4.views.analytics.rubric_group_scores.get import (
    get_rubric_group_scores_internal,
)
from app.api.v4.views.analytics.rubric_group_scores.types import RubricGroupScoreItem
from app.api.v4.views.analytics.simulation_facts.types import (
    GetSimulationFactsResponse,
)
from app.api.v4.views.analytics.simulation_scenario_counts.get import (
    get_simulation_scenario_counts_internal,
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
class BaseMvData:
    """Raw MV data fetched for dashboard computations."""

    attempts: list[AttemptFactsItem] = field(default_factory=list)
    chat_rows: list[ChatFactsItem] = field(default_factory=list)
    daily_rows: list[DailyMetricsItem] = field(default_factory=list)
    profile_rows: list[ProfileMetricsItem] = field(default_factory=list)
    first_attempt_rows: list[FirstAttemptPassItem] = field(default_factory=list)


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


@dataclass
class ResourceIds:
    """Collected resource IDs from MV data."""

    simulation_ids: set = field(default_factory=set)
    rubric_ids: set = field(default_factory=set)
    parameter_field_ids: set = field(default_factory=set)
    persona_ids: set = field(default_factory=set)
    cohort_ids: set = field(default_factory=set)
    scenario_ids: set = field(default_factory=set)


@dataclass
class HydratedResources:
    """Hydrated resource data from batch fetches."""

    simulations: list[Any] = field(default_factory=list)
    rubrics: list[Any] = field(default_factory=list)
    parameter_fields: list[Any] = field(default_factory=list)
    parameters: list[Any] = field(default_factory=list)
    fields: list[Any] = field(default_factory=list)
    personas: list[Any] = field(default_factory=list)
    scenarios: list[Any] = field(default_factory=list)
    simulation_scenario_counts: dict[str, int] = field(default_factory=dict)
    persona_name_map: dict[str, str] = field(default_factory=dict)
    cohort_name_map: dict[str, str] = field(default_factory=dict)
    scenario_name_map: dict[str, str] = field(default_factory=dict)
    simulation_name_map: dict[str, str] = field(default_factory=dict)
    field_parameter_map: dict = field(default_factory=dict)
    rubric_group_scores: list[RubricGroupScoreItem] = field(default_factory=list)


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


async def fetch_base_mv_data(
    pool: asyncpg.Pool,
    request: DashboardSectionRequest,
    filters: ParsedFilters,
    bypass_cache: bool = False,
    include_first_attempt: bool = True,
) -> BaseMvData:
    """Fetch all base MV data in parallel."""

    async def fetch_attempts() -> list:
        async with pool.acquire() as c:
            result = await get_attempt_facts_internal(
                conn=c,
                profile_id=request.target_profile_id,
                attempt_type=filters.attempt_type,
                is_archived=filters.is_archived,
                simulation_ids=filters.simulation_ids,
                cohort_ids=filters.cohort_ids,
                department_ids=request.department_ids,
                date_from=filters.parsed_start_date,
                date_to=filters.parsed_end_date,
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
                    simulation_ids=filters.simulation_ids,
                    cohort_ids=filters.cohort_ids,
                    department_ids=request.department_ids,
                    attempt_type=filters.attempt_type,
                    is_archived=filters.is_archived,
                    date_from=filters.parsed_start_date,
                    date_to=filters.parsed_end_date,
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
                    cohort_ids=filters.cohort_ids,
                    simulation_ids=filters.simulation_ids,
                    attempt_type=filters.attempt_type,
                    is_archived=filters.is_archived,
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
                    cohort_ids=filters.cohort_ids,
                    simulation_ids=filters.simulation_ids,
                    attempt_type=filters.attempt_type,
                    is_archived=filters.is_archived,
                    page_limit=request.page_limit,
                    page_offset=request.page_offset,
                ),
                bypass_cache=bypass_cache,
            )
            return result.items

    async def fetch_first_attempt_rows() -> list:
        if not include_first_attempt:
            return []
        async with pool.acquire() as c:
            result = await get_first_attempt_pass_internal(
                conn=c,
                request=GetFirstAttemptPassRequest(
                    profile_id=request.target_profile_id,
                    cohort_ids=filters.cohort_ids,
                    department_ids=request.department_ids,
                    attempt_type=filters.attempt_type,
                    is_archived=filters.is_archived,
                    date_from=filters.parsed_start_date,
                    date_to=filters.parsed_end_date,
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

    return BaseMvData(
        attempts=attempts,
        chat_rows=chat_rows,
        daily_rows=daily_rows,
        profile_rows=profile_rows,
        first_attempt_rows=first_attempt_rows,
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


def collect_resource_ids(mv_data: BaseMvData) -> ResourceIds:
    """Collect unique resource IDs from MV data for hydration."""
    ids = ResourceIds()
    for item in mv_data.attempts:
        if item.simulation_id:
            ids.simulation_ids.add(item.simulation_id)
    for row in mv_data.daily_rows:
        if row.simulation_id:
            ids.simulation_ids.add(row.simulation_id)
        if row.cohort_id:
            ids.cohort_ids.add(row.cohort_id)
    for row in mv_data.chat_rows:
        if row.simulation_id:
            ids.simulation_ids.add(row.simulation_id)
        if row.rubric_id:
            ids.rubric_ids.add(row.rubric_id)
        if row.persona_id:
            ids.persona_ids.add(row.persona_id)
        if row.cohort_id:
            ids.cohort_ids.add(row.cohort_id)
        if row.scenario_id:
            ids.scenario_ids.add(row.scenario_id)
        ids.parameter_field_ids.update(
            pfid for pfid in row.parameter_field_ids if pfid is not None
        )
        ids.parameter_field_ids.update(
            pfid for pfid in row.persona_parameter_field_ids if pfid is not None
        )
        ids.parameter_field_ids.update(
            pfid for pfid in row.document_parameter_field_ids if pfid is not None
        )
    return ids


async def hydrate_resources(
    pool: asyncpg.Pool,
    mv_data: BaseMvData,
    resource_ids: ResourceIds,
    bypass_cache: bool = False,
) -> HydratedResources:
    """Hydrate all resources from collected IDs. Returns HydratedResources."""
    result = HydratedResources()

    # First batch: simulations, rubrics, parameter_fields, simulation_scenario_counts
    async with pool.acquire() as c:
        result.simulations = await get_simulations_internal(
            conn=c,
            ids=list(resource_ids.simulation_ids),
            bypass_cache=bypass_cache,
        )
        result.rubrics = await get_rubrics_batch_internal(
            conn=c,
            ids=list(resource_ids.rubric_ids),
            bypass_cache=bypass_cache,
        )
        result.parameter_fields = await get_parameter_fields_internal(
            conn=c,
            ids=list(resource_ids.parameter_field_ids),
            bypass_cache=bypass_cache,
        )
        ssc = await get_simulation_scenario_counts_internal(
            conn=c,
            simulation_ids=list(resource_ids.simulation_ids),
        )
        result.simulation_scenario_counts = {
            str(i.simulation_id): i.scenario_count for i in ssc.items
        }

    # Derive parameter_ids, field_ids, field_parameter_map
    parameter_ids: set = set()
    field_ids: set = set()
    for pf in result.parameter_fields:
        if pf.parameter_id:
            parameter_ids.add(pf.parameter_id)
        if pf.field_id:
            field_ids.add(pf.field_id)
            if pf.parameter_id:
                result.field_parameter_map[pf.field_id] = pf.parameter_id

    # Second batch: parameters, fields
    async with pool.acquire() as c:
        result.parameters = await get_parameters_internal(
            conn=c,
            ids=list(parameter_ids),
            bypass_cache=bypass_cache,
        )
        result.fields = await get_fields_internal(
            conn=c,
            ids=list(field_ids),
            bypass_cache=bypass_cache,
        )

    # Third batch: personas, cohort names, scenarios
    async with pool.acquire() as c:
        result.personas = await get_personas_internal(
            conn=c,
            ids=list(resource_ids.persona_ids),
            bypass_cache=bypass_cache,
        )
        cohort_name_rows = (
            await c.fetch(
                """
            SELECT id, name FROM cohorts_resource
            WHERE id = ANY($1::uuid[])
            """,
                list(resource_ids.cohort_ids),
            )
            if resource_ids.cohort_ids
            else []
        )
        result.scenarios = await get_scenarios_internal(
            conn=c,
            ids=list(resource_ids.scenario_ids),
            bypass_cache=bypass_cache,
        )

    # Build name maps
    result.persona_name_map = {
        str(p.persona_id): p.name for p in result.personas if p.persona_id and p.name
    }
    result.cohort_name_map = {
        str(r["id"]): r["name"] for r in cohort_name_rows if r["id"] and r["name"]
    }
    result.scenario_name_map = {
        str(s.scenario_id): s.name for s in result.scenarios if s.scenario_id and s.name
    }
    result.simulation_name_map = {
        str(s.simulation_id): s.name
        for s in result.simulations
        if s.simulation_id and s.name
    }

    # Rubric group scores
    chat_ids = [row.chat_id for row in mv_data.chat_rows]
    async with pool.acquire() as c:
        rgs = await get_rubric_group_scores_internal(
            conn=c,
            chat_ids=chat_ids,
        )
        result.rubric_group_scores = rgs.items

    return result


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
