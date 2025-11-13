"""Persona response times endpoint - v3 API."""

import json
import uuid
from datetime import datetime, timedelta
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.db import get_pool
from app.main import server
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class PersonaResponseTimesRequest(BaseModel):
    """Request to get persona response times."""

    persona_id: str
    window_days: int = 30


class PersonaResponseTimesResponse(BaseModel):
    """Response with persona response times data."""

    persona: dict[str, Any]
    stats: dict[str, Any]
    recent_responses: list[dict[str, Any]]


@router.post("/response-times", response_model=PersonaResponseTimesResponse)
@server.tool()
async def persona_response_times(
    request: PersonaResponseTimesRequest,
) -> PersonaResponseTimesResponse:
    """
    Persona response time analysis
    Analyze response times for a specific persona.

    Input
      • persona_id - UUID of the persona
      • window_days - Analysis window in days (default: 30)

    Returns
      { "persona": {…}, "stats": {…}, "recent_responses": […] }

    Quick-start
      ask:  "How fast does persona X respond?"
      call: persona_response_times("uuid-here")

    See also persona_overview() for persona details.
    """
    try:
        persona_uuid = uuid.UUID(request.persona_id)
    except ValueError:
        raise HTTPException(
            status_code=400, detail=f"Invalid persona_id format: {request.persona_id}"
        )

    pool = get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database connection pool not available")

    try:
        async with pool.acquire() as conn:
            cutoff_date = datetime.now() - timedelta(days=request.window_days)
            sql = load_sql("sql/v3/personas/response_times.sql")
            result = await conn.fetchrow(sql, persona_uuid, cutoff_date)

            if not result:
                raise HTTPException(
                    status_code=404, detail=f"Persona not found: {request.persona_id}"
                )

            # Parse scenarios
            scenarios = []
            scenarios_data = result["scenarios"]
            if isinstance(scenarios_data, str):
                scenarios_data = json.loads(scenarios_data)
            if scenarios_data and isinstance(scenarios_data, list):
                scenarios = scenarios_data

            # Parse response data
            recent_responses = []
            response_data = result["response_data"]
            if isinstance(response_data, str):
                response_data = json.loads(response_data)
            if response_data and isinstance(response_data, list):
                recent_responses = response_data

            # Calculate stats
            if recent_responses:
                response_times = [
                    r.get("response_time_seconds", 0) for r in recent_responses
                ]
                avg_response_time = sum(response_times) / len(response_times) if response_times else 0
                min_response_time = min(response_times) if response_times else 0
                max_response_time = max(response_times) if response_times else 0
            else:
                avg_response_time = 0
                min_response_time = 0
                max_response_time = 0

            stats = {
                "total_responses": len(recent_responses),
                "average_response_time_seconds": round(avg_response_time, 2),
                "min_response_time_seconds": round(min_response_time, 2),
                "max_response_time_seconds": round(max_response_time, 2),
            }

            return PersonaResponseTimesResponse(
                persona={
                    "id": result["persona_id"],
                    "name": result["persona_name"],
                    "description": result["persona_description"],
                    "scenarios": scenarios,
                },
                stats=stats,
                recent_responses=recent_responses,
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

