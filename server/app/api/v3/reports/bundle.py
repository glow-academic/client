"""Reports bundle v3 API endpoint."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.api.v3.reports.export import router as export_router
from app.main import get_db
from app.utils.analytics_query_builder import (
    build_profile_and_analytics_filters,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql
from enum import Enum
from typing import Literal


# Inline mapping types (DHH style - no shared types)
class ScenarioMappingItem(BaseModel):
    """Scenario mapping item."""

    name: str
    description: str


class SimulationMappingItem(BaseModel):
    """Simulation mapping item."""

    name: str
    description: str
    time_limit: int | None = None
    department_ids: list[str] | None = None


class SimulationFilter(str, Enum):
    """Simulation filter types."""

    GENERAL = "general"
    PRACTICE = "practice"
    ARCHIVED = "archived"


class TrendData(BaseModel):
    """Trend data point."""

    date: str
    value: float
    count: int


class DataPoint(BaseModel):
    """Individual data point."""

    profileId: str
    date: str | None = None
    value: float | None = None
    attemptId: str | None = None
    simulationId: str | None = None
    scenarioId: str | None = None
    count: int | None = None


class Method(str, Enum):
    """Analytics computation methods."""

    AVG = "avg"
    MAX = "max"
    SUM = "sum"
    RATE = "rate"
    COUNT_DISTINCT = "countDistinct"
    MIN = "min"
    SLOPE = "slope"


class MetricResponse(BaseModel):
    """Standard metric response."""

    hasData: bool
    method: Method
    currentValue: int
    status: Literal["success", "warning", "danger", "neutral"]
    trendAnalysis: str | None = None
    valueField: str | None = None
    keyField: str | None = None
    trendData: list[TrendData]
    dataPoints: list[DataPoint]
    hover: dict[str, Any] | None = None


# Type aliases for Dict mappings
ScenarioMapping = dict[str, ScenarioMappingItem]
SimulationMapping = dict[str, SimulationMappingItem]

router = APIRouter(prefix="/reports", tags=["reports"])
router.include_router(export_router)


# Inline filter schemas
class ReportsBundleFilters(BaseModel):
    """Reports bundle filter request schema."""

    startDate: str
    endDate: str
    cohortIds: list[str] | None = None
    roles: list[str] | None = None
    simulationFilters: list[SimulationFilter] | None = None
    departmentIds: list[str] | None = None
    # Pagination, search, sorting, and additional filters
    page: int | None = None
    pageSize: int | None = None
    search: str | None = None  # Text search across profile names
    sortBy: str | None = None  # Column to sort by (e.g., "averageScore", "profileName")
    sortOrder: str | None = None  # "asc" or "desc"
    profileIds: list[str] | None = None  # Filter by specific profiles
    simulationIds: list[str] | None = None  # Filter by specific simulations
    scenarioIds: list[str] | None = None  # Filter by specific scenarios


# Inline schemas
class ProfileMetrics(BaseModel):
    """Profile metrics - each metric is a full MetricResponse object."""

    averageScore: MetricResponse
    completionPercentage: MetricResponse
    firstAttemptPassRate: MetricResponse
    highestScore: MetricResponse
    messagesPerSession: MetricResponse
    personaResponseTimes: MetricResponse
    sessionEfficiency: MetricResponse
    stagnationRate: MetricResponse
    timeSpent: MetricResponse
    totalAttempts: MetricResponse


class ProfileDataEnhanced(BaseModel):
    """Enhanced profile data row."""

    profileId: str
    firstName: str
    lastName: str
    emails: list[str] = []  # Array of emails
    primaryEmail: str | None  # Primary email
    role: str
    simulationIds: list[str] = []
    scenarioIds: list[str] = []
    metrics: ProfileMetrics


class FilterOption(BaseModel):
    """Filter option with count."""

    value: str
    label: str
    count: int


class ReportsBundleResponse(BaseModel):
    """Reports bundle response with entity mappings."""

    data: list[ProfileDataEnhanced]
    totalCount: int
    page: int
    pageSize: int
    totalPages: int
    profileOptions: list[FilterOption] = []
    simulationOptions: list[FilterOption] = []
    scenarioOptions: list[FilterOption] = []
    scenario_mapping: ScenarioMapping
    simulation_mapping: SimulationMapping


@router.post("", response_model=ReportsBundleResponse)
async def get_reports(
    filters: ReportsBundleFilters,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ReportsBundleResponse:
    """Get reports bundle with aggregated metrics per profile and entity mappings."""
    tags = ["reports"]  # From router tags

    # Check for cache bypass header (for hard refresh)
    bypass_cache = request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    body_dict = filters.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            # Ensure cached data has new fields (for backward compatibility with old cache entries)
            cached_data = cached["data"]
            if "profileOptions" not in cached_data:
                cached_data["profileOptions"] = []
            if "simulationOptions" not in cached_data:
                cached_data["simulationOptions"] = []
            if "scenarioOptions" not in cached_data:
                cached_data["scenarioOptions"] = []
            return ReportsBundleResponse.model_validate(cached_data)

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Load SQL template
        sql_template = load_sql("sql/v3/reports/reports_bundle.sql")

        # Build separate WHERE clauses for profiles and analytics
        # This allows including all matching profiles even if they have no attempts
        profile_where, analytics_where, params = build_profile_and_analytics_filters(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters]
            if filters.simulationFilters
            else None,
            profile_id=None,  # Reports bundle doesn't filter by profileId
            department_ids=filters.departmentIds,
            profile_ids=filters.profileIds,
            simulation_ids=filters.simulationIds,
            scenario_ids=filters.scenarioIds,
            search=filters.search,
        )

        # Build ORDER BY clause
        sort_by = filters.sortBy or "averageScore"
        sort_order = (filters.sortOrder or "desc").upper()

        # Map sortBy to actual column names
        sort_column_map = {
            "averageScore": "avg_score",
            "highestScore": "highest_score",
            "completionPercentage": "completion_pct",
            "firstAttemptPassRate": "first_attempt_pass_rate",
            "messagesPerSession": "avg_messages",
            "personaResponseTimes": "persona_response_time",
            "sessionEfficiency": "session_efficiency",
            "stagnationRate": "stagnation_rate",
            "timeSpent": "total_time_minutes",
            "totalAttempts": "total_attempts",
            "profileName": "LOWER(first_name || ' ' || last_name)",
        }

        sort_column = sort_column_map.get(sort_by, "avg_score")
        # Add NULLS LAST to ensure NULL values (shown as "N/A" in UI) are sorted to the end
        order_by_clause = f"ORDER BY {sort_column} {sort_order} NULLS LAST"
        # Also need ORDER BY in json_agg to preserve sort order
        json_agg_order_by = f"ORDER BY {sort_column} {sort_order} NULLS LAST"

        # Build LIMIT/OFFSET clause
        page = filters.page or 0
        page_size = filters.pageSize or 100
        offset = page * page_size
        limit_offset_clause = f"LIMIT {page_size} OFFSET {offset}"

        # Replace placeholders in SQL template
        sql_query = sql_template.replace("{PROFILE_WHERE_CLAUSE}", profile_where)
        sql_query = sql_query.replace("{ANALYTICS_WHERE_CLAUSE}", analytics_where)
        sql_query = sql_query.replace("{ORDER_BY_CLAUSE}", order_by_clause)
        sql_query = sql_query.replace("{LIMIT_OFFSET_CLAUSE}", limit_offset_clause)
        sql_query = sql_query.replace("{JSON_AGG_ORDER_BY}", json_agg_order_by)
        sql_params = tuple(params)

        # Disable JIT compilation for this complex query to avoid re-compilation overhead
        # JIT compilation overhead can be significant for large JSONB aggregation queries
        async with conn.transaction():
            await conn.execute("SET LOCAL jit = off;")
            result = await conn.fetchval(sql_query, *sql_params)

        # Handle empty results gracefully - return empty structure instead of error
        # Parse JSONB result (may be string or dict)
        parsed_result = result or {}
        if isinstance(parsed_result, str):
            parsed_result = json.loads(parsed_result)
        # Ensure parsed_result is a dict (handle case where result is None or empty)
        if not isinstance(parsed_result, dict):
            parsed_result = {}

        # Extract data array and pagination metadata
        bundle_data = parsed_result.get("data", []) if parsed_result else []
        total_count = parsed_result.get("totalCount", 0) if parsed_result else 0
        page = filters.page or 0
        page_size = filters.pageSize or 100
        total_pages = (total_count + page_size - 1) // page_size if page_size > 0 else 0

        # Parse filter options
        profile_options_data = parsed_result.get("profileOptions", [])
        if isinstance(profile_options_data, str):
            profile_options_data = json.loads(profile_options_data)
        profile_options = [
            FilterOption(
                value=opt.get("value", ""),
                label=opt.get("label", ""),
                count=opt.get("count", 0),
            )
            for opt in (
                profile_options_data if isinstance(profile_options_data, list) else []
            )
        ]

        simulation_options_data = parsed_result.get("simulationOptions", [])
        if isinstance(simulation_options_data, str):
            simulation_options_data = json.loads(simulation_options_data)
        simulation_options = [
            FilterOption(
                value=opt.get("value", ""),
                label=opt.get("label", ""),
                count=opt.get("count", 0),
            )
            for opt in (
                simulation_options_data
                if isinstance(simulation_options_data, list)
                else []
            )
        ]

        scenario_options_data = parsed_result.get("scenarioOptions", [])
        if isinstance(scenario_options_data, str):
            scenario_options_data = json.loads(scenario_options_data)
        scenario_options = [
            FilterOption(
                value=opt.get("value", ""),
                label=opt.get("label", ""),
                count=opt.get("count", 0),
            )
            for opt in (
                scenario_options_data if isinstance(scenario_options_data, list) else []
            )
        ]

        # Parse scenario mapping from JSONB (replicate v2 logic)
        scenario_mapping: ScenarioMapping = {}
        scenario_mapping_data = parsed_result.get("scenario_mapping", {})
        if isinstance(scenario_mapping_data, str):
            scenario_mapping_data = json.loads(scenario_mapping_data)
        if scenario_mapping_data and isinstance(scenario_mapping_data, dict):
            for scenario_id, scenario_data in scenario_mapping_data.items():
                if isinstance(scenario_data, dict):
                    scenario_mapping[scenario_id] = ScenarioMappingItem(
                        name=scenario_data.get("name", ""),
                        description=scenario_data.get("description", ""),
                        persona_ids=[],
                        persona_mapping={},
                        document_mapping={},
                        parameter_item_mapping={},
                        parameter_item_ids=[],
                        document_ids=[],
                    )

        # Parse simulation mapping from JSONB (replicate v2 logic)
        simulation_mapping: SimulationMapping = {}
        simulation_mapping_data = parsed_result.get("simulation_mapping", {})
        if isinstance(simulation_mapping_data, str):
            simulation_mapping_data = json.loads(simulation_mapping_data)
        if simulation_mapping_data and isinstance(simulation_mapping_data, dict):
            for sim_id, sim_data in simulation_mapping_data.items():
                if isinstance(sim_data, dict):
                    simulation_mapping[sim_id] = SimulationMappingItem(
                        name=sim_data.get("name", ""),
                        description=sim_data.get("description", ""),
                    )

        # Build response (replicate v2 logic)
        response_data = ReportsBundleResponse(
            data=bundle_data,
            totalCount=total_count,
            page=page,
            pageSize=page_size,
            totalPages=total_pages,
            profileOptions=profile_options,
            simulationOptions=simulation_options,
            scenarioOptions=scenario_options,
            scenario_mapping=scenario_mapping,
            simulation_mapping=simulation_mapping,
        )

        # Cache response
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump()},
            ttl=300,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return response_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=request.url.path,
            operation="get_reports",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
