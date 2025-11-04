"""Leaderboard bundle v3 API endpoint."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.db import get_db
from app.utils.analytics_query_builder import build_base_filter
from app.utils.schema import AnalyticsFilters
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

router = APIRouter()

# Inline schemas (moved from app.schemas.leaderboard)
class LeaderboardMetric(BaseModel):
    """Leaderboard metric."""

    hasData: bool
    method: str
    currentValue: int
    keyField: str | None = None
    trendData: list[Any]
    dataPoints: list[Any]
    hover: dict[str, Any]


class LeaderboardMetrics(BaseModel):
    """Leaderboard metrics."""

    totalAttempts: LeaderboardMetric
    highestScoreAvg: LeaderboardMetric
    messagesPerSession: LeaderboardMetric
    personaResponseSeconds: LeaderboardMetric
    timeSpentMinutes: LeaderboardMetric
    improvementRatePerDay: LeaderboardMetric
    perfectScoreCount: LeaderboardMetric
    quickestPassMinutes: LeaderboardMetric


class LeaderboardRow(BaseModel):
    """Leaderboard row."""

    profileId: str
    firstName: str
    lastName: str
    metrics: LeaderboardMetrics


class LeaderboardBundleResponse(BaseModel):
    """Leaderboard bundle response."""

    data: list[LeaderboardRow]


@router.post("/")
async def get_leaderboard(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> LeaderboardBundleResponse:
    """Get leaderboard bundle with all metrics and profile data."""
    try:
        # Build WHERE clause using analytics query builder utility
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

        # Load SQL template
        sql_template = load_sql("sql/v3/leaderboard/leaderboard_bundle.sql")
        
        # Replace WHERE clause placeholder
        query = sql_template.replace("{WHERE_CLAUSE}", where_clause)

        # Execute query and get JSON result
        result = await conn.fetchval(query, *params)

        # Parse any JSON strings in nested structures
        parsed_result = result or {}
        if isinstance(parsed_result, str):
            parsed_result = json.loads(parsed_result)

        # Recursively parse JSON strings
        def parse_json_strings_recursive(obj: Any) -> Any:
            """Recursively parse JSON strings in nested structures."""
            if isinstance(obj, str):
                try:
                    return json.loads(obj)
                except (json.JSONDecodeError, ValueError):
                    return obj
            elif isinstance(obj, dict):
                return {k: parse_json_strings_recursive(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [parse_json_strings_recursive(item) for item in obj]
            else:
                return obj

        parsed_result = parse_json_strings_recursive(parsed_result)

        # Validate and return response
        return LeaderboardBundleResponse.model_validate(parsed_result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
