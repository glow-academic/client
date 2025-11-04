"""Reports bundle v3 API endpoint."""

import json
from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.utils.analytics_query_builder import build_base_filter
from app.utils.http_cache import cache_key, get_cached, set_cached
from app.utils.schema import (AnalyticsFilters, MetricResponse,
                              ScenarioMapping, SimulationMapping)
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

router = APIRouter(prefix="/reports", tags=["reports"])

# Inline schemas (moved from app.schemas.reports)
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
        sql = sql_template.replace("{WHERE_CLAUSE}", where_clause)

        # Execute query
        result = await conn.fetchval(sql, *params)

        # Parse JSONB result (may be string or dict)
        parsed_result = result or {}
        if isinstance(parsed_result, str):
            parsed_result = json.loads(parsed_result)

        # Validate and return response
        response_data = ReportsBundleResponse.model_validate(parsed_result)
        
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
