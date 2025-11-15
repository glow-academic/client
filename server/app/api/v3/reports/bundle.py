"""Reports bundle v3 API endpoint."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.analytics_query_builder import build_base_filter
from app.utils.error.handle_route_error import handle_route_error
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.schema import (
    AnalyticsFilters,
    MetricResponse,
    ScenarioMapping,
    ScenarioMappingItem,
    SimulationMapping,
    SimulationMappingItem,
)
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

router = APIRouter(prefix="/reports", tags=["reports"])


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
    alias: str | None
    role: str
    metrics: ProfileMetrics


class ReportsBundleResponse(BaseModel):
    """Reports bundle response with entity mappings."""

    data: list[ProfileDataEnhanced]
    scenario_mapping: ScenarioMapping
    simulation_mapping: SimulationMapping


@router.post("", response_model=ReportsBundleResponse)
async def get_reports(
    filters: AnalyticsFilters,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ReportsBundleResponse:
    """Get reports bundle with aggregated metrics per profile and entity mappings."""
    tags = ["reports"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = filters.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return ReportsBundleResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Load SQL template
        sql_template = load_sql("sql/v3/reports/reports_bundle.sql")

        # Build WHERE clause dynamically using analytics query builder utility
        where_clause, params = build_base_filter(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters]
            if filters.simulationFilters
            else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )

        # Replace WHERE clause placeholder in SQL template
        sql_query = sql_template.replace("{WHERE_CLAUSE}", where_clause)
        sql_params = tuple(params)

        # Execute query
        result = await conn.fetchval(sql_query, *sql_params)

        # Handle empty results gracefully - return empty structure instead of error
        # Parse JSONB result (may be string or dict)
        parsed_result = result or {}
        if isinstance(parsed_result, str):
            parsed_result = json.loads(parsed_result)
        # Ensure parsed_result is a dict (handle case where result is None or empty)
        if not isinstance(parsed_result, dict):
            parsed_result = {}

        # Extract data array (replicate v2 logic)
        bundle_data = parsed_result.get("data", []) if parsed_result else []

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
