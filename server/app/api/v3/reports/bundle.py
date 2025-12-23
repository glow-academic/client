"""Reports bundle v3 API endpoint."""

import json
from datetime import datetime
from enum import Enum
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.api.v3.dashboard.bundle import MetricResponse
from app.api.v3.reports.export import router as export_router
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import load_sql

router = APIRouter(prefix="/reports", tags=["reports"])
router.include_router(export_router)


# Inline filter schemas
class SimulationFilter(str, Enum):
    """Simulation filter types."""

    GENERAL = "general"
    PRACTICE = "practice"
    ARCHIVED = "archived"


class ReportsBundleFilters(BaseModel):
    """Reports bundle filter request schema."""

    startDate: str
    endDate: str
    cohortIds: list[str] | None = None
    roles: list[str] | None = None
    simulationFilters: list[str] | None = None
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


class SimulationMappingItem(BaseModel):
    """Simulation mapping item."""

    name: str
    description: str
    rubric_id: str | None = None
    rubric_points: int | None = None
    rubric_pass_points: int | None = None


class ScenarioMappingItem(BaseModel):
    """Scenario mapping item."""

    name: str
    description: str


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
    scenario_mapping: dict[str, ScenarioMappingItem]
    simulation_mapping: dict[str, SimulationMappingItem]


@router.post(
    "",
    response_model=ReportsBundleResponse,
    dependencies=[
        audit_activity("reports.bundle", "{{ actor.name }} viewed reports bundle")
    ],
)
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
        sql_template = load_sql("app/sql/v3/reports/reports_bundle.sql")

        # Build separate WHERE clauses for profiles and analytics
        # This allows including all matching profiles even if they have no attempts
        # Build separate WHERE clauses for profiles and analytics inline
        # This allows including all matching profiles even if they have no attempts
        profile_conditions = []
        analytics_conditions = []
        params: list[Any] = []
        param_counter = 1

        # Date filters - only for analytics
        analytics_conditions.append(f"a.attempt_created_at >= ${param_counter}")
        params.append(datetime.fromisoformat(filters.startDate.replace("Z", "+00:00")))
        param_counter += 1

        analytics_conditions.append(f"a.attempt_created_at < ${param_counter}")
        params.append(datetime.fromisoformat(filters.endDate.replace("Z", "+00:00")))
        param_counter += 1

        # Simulation type filters - only for analytics
        sim_filters = filters.simulationFilters or ["general"]
        sim_conditions = []

        if "general" in sim_filters:
            sim_conditions.append("a.is_general = TRUE")
        if "practice" in sim_filters:
            sim_conditions.append("a.is_practice = TRUE")
        if "archived" in sim_filters:
            if "general" not in sim_filters and "practice" not in sim_filters:
                sim_conditions.append("a.is_archived = TRUE")
            else:
                sim_conditions.append(
                    "(a.is_archived = TRUE OR (a.is_general = FALSE AND a.is_practice = FALSE))"
                )

        if sim_conditions:
            analytics_conditions.append(f"({' OR '.join(sim_conditions)})")

        # Profile filter - not used for reports bundle

        # Role filter - only for profiles
        if filters.roles:
            profile_conditions.append(f"p.role = ANY(${param_counter}::profile_role[])")
            params.append(filters.roles)
            param_counter += 1

        # Cohort filter
        if filters.cohortIds:
            profile_conditions.append(
                f"EXISTS (SELECT 1 FROM cohort_profiles cp WHERE cp.profile_id = p.id AND cp.cohort_id = ANY(${param_counter}::uuid[]) AND cp.active = true)"
            )
            analytics_conditions.append(
                f"""a.simulation_id IN (
                    SELECT DISTINCT s.id
                    FROM simulations s
                    WHERE s.active = TRUE
                      AND (
                          EXISTS (
                              SELECT 1 
                              FROM cohort_simulations cs 
                              WHERE cs.simulation_id = s.id 
                                AND cs.cohort_id = ANY(${param_counter}::uuid[])
                                AND cs.active = TRUE
                          )
                          OR
                          (s.practice_simulation = TRUE 
                           AND NOT EXISTS (
                               SELECT 1 
                               FROM cohort_simulations cs2 
                               WHERE cs2.simulation_id = s.id 
                                 AND cs2.active = TRUE
                           ))
                      )
                )"""
            )
            params.append(filters.cohortIds)
            param_counter += 1

        # Department filter
        if filters.departmentIds:
            profile_conditions.append(
                f"EXISTS (SELECT 1 FROM profile_departments pd WHERE pd.profile_id = p.id AND pd.department_id = ANY(${param_counter}::uuid[]) AND pd.active = true)"
            )
            params.append(filters.departmentIds)
            param_counter += 1

        # Profile IDs filter
        if filters.profileIds:
            profile_conditions.append(f"p.id = ANY(${param_counter}::uuid[])")
            analytics_conditions.append(f"a.profile_id = ANY(${param_counter}::uuid[])")
            params.append(filters.profileIds)
            param_counter += 1

        # Simulation IDs filter
        if filters.simulationIds:
            analytics_conditions.append(f"a.simulation_id = ANY(${param_counter}::uuid[])")
            params.append(filters.simulationIds)
            param_counter += 1

        # Scenario IDs filter
        if filters.scenarioIds:
            analytics_conditions.append(f"a.scenario_id = ANY(${param_counter}::uuid[])")
            params.append(filters.scenarioIds)
            param_counter += 1

        # Text search filter
        if filters.search:
            search_pattern = f"%{filters.search}%"
            profile_conditions.append(
                f"(p.first_name ILIKE ${param_counter} OR p.last_name ILIKE ${param_counter})"
            )
            params.append(search_pattern)
            param_counter += 1

        profile_where = " AND ".join(profile_conditions) if profile_conditions else "TRUE"
        analytics_where = (
            " AND ".join(analytics_conditions) if analytics_conditions else "TRUE"
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

        # Replace SQL text (defaults ensure SQL compiles; route replaces with actual values)
        # WHERE clauses: Replace "WHERE TRUE" with actual filters
        sql_query = sql_template.replace("WHERE TRUE", f"WHERE {profile_where}", 1)  # First occurrence (filtered_profiles)
        sql_query = sql_query.replace("WHERE TRUE", f"WHERE {analytics_where}", 1)  # Second occurrence (filt)
        # ORDER BY: Replace default with actual sort column
        sql_query = sql_query.replace("ORDER BY created_at DESC NULLS LAST", order_by_clause, 1)  # First occurrence (paginated_metrics)
        sql_query = sql_query.replace("ORDER BY created_at DESC NULLS LAST", json_agg_order_by)  # Second occurrence (json_agg)
        # LIMIT/OFFSET: Replace default with actual pagination
        sql_query = sql_query.replace("LIMIT 100 OFFSET 0", limit_offset_clause)
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

        # Parse scenario mapping from JSONB
        scenario_mapping: dict[str, ScenarioMappingItem] = {}
        scenario_mapping_data = parsed_result.get("scenario_mapping", {})
        if isinstance(scenario_mapping_data, str):
            scenario_mapping_data = json.loads(scenario_mapping_data)
        if scenario_mapping_data and isinstance(scenario_mapping_data, dict):
            for scenario_id, scenario_data in scenario_mapping_data.items():
                if isinstance(scenario_data, dict):
                    scenario_mapping[scenario_id] = ScenarioMappingItem(
                        name=scenario_data.get("name", ""),
                        description=scenario_data.get("description", ""),
                    )

        # Parse simulation mapping from JSONB
        simulation_mapping: dict[str, SimulationMappingItem] = {}
        simulation_mapping_data = parsed_result.get("simulation_mapping", {})
        if isinstance(simulation_mapping_data, str):
            simulation_mapping_data = json.loads(simulation_mapping_data)
        if simulation_mapping_data and isinstance(simulation_mapping_data, dict):
            for sim_id, sim_data in simulation_mapping_data.items():
                if isinstance(sim_data, dict):
                    rubric_id = sim_data.get("rubric_id")
                    rubric_points = sim_data.get("rubric_points")
                    rubric_pass_points = sim_data.get("rubric_pass_points")
                    simulation_mapping[sim_id] = SimulationMappingItem(
                        name=sim_data.get("name", ""),
                        description=sim_data.get("description", ""),
                        rubric_id=str(rubric_id) if rubric_id else None,
                        rubric_points=int(rubric_points)
                        if rubric_points is not None
                        else None,
                        rubric_pass_points=int(rubric_pass_points)
                        if rubric_pass_points is not None
                        else None,
                    )

        # Build response
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

        # Get profile_id from header (set by router-level dependency)
        profile_id = request.state.profile_id

        # Fetch actor_name separately
        actor_name = None
        if profile_id:
            actor_name_row = await conn.fetchrow(
                "SELECT first_name || ' ' || last_name as actor_name FROM profiles WHERE id = $1",
                profile_id,
            )
            actor_name = actor_name_row["actor_name"] if actor_name_row else None

        # Set audit context
        if actor_name:
            audit_set(request, actor={"name": actor_name, "id": profile_id})

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
