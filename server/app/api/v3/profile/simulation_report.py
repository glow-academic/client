"""Profile simulation report endpoint - v3 API."""

import json
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.main import get_pool, server
from app.utils.sql_helper import load_sql

router = APIRouter()


class StudentSimReportRequest(BaseModel):
    """Request to get student simulation report."""

    profile_id: str
    recent: int = 50


class StudentSimReportResponse(BaseModel):
    """Response with student simulation report."""

    profile: dict[str, Any]
    attempts: list[dict[str, Any]]


@router.post("/simulation-report", response_model=StudentSimReportResponse)
@server.tool()
async def student_sim_report(
    request: StudentSimReportRequest,
) -> StudentSimReportResponse:
    """
    Deep dive: every attempt, chat, grade, feedback
    Comprehensive student simulation report.

    Input
      • profile_id - UUID of the student profile
      • recent - Limit messages per chat (default: 50)

    Returns
      { "profile": { … }, "attempts": [ … ] }

    Quick-start
      ask:  "Full report on student X"
      call: student_sim_report("uuid-here")

    See also profile_overview() for summary view.
    """
    pool = get_pool()
    if not pool:
        raise HTTPException(
            status_code=500, detail="Database connection pool not available"
        )

    try:
        async with pool.acquire() as conn:
            sql = load_sql("sql/v3/profile/simulation_report.sql")
            result = await conn.fetchrow(sql, request.profile_id, request.recent)

            if not result:
                raise HTTPException(
                    status_code=404, detail=f"Profile not found: {request.profile_id}"
                )

            profile_data = {
                "id": str(result["id"]),
                "first_name": result["first_name"],
                "last_name": result["last_name"],
                "alias": result["alias"],
                "role": result["role"],
                "created_at": result["created_at"].isoformat()
                if result["created_at"]
                else None,
            }

            # Parse attempts (jsonb array to list of dicts)
            attempts = []
            attempts_data = result["attempts"]
            if isinstance(attempts_data, str):
                attempts_data = json.loads(attempts_data)
            if attempts_data and isinstance(attempts_data, list):
                attempts = attempts_data

            return StudentSimReportResponse(profile=profile_data, attempts=attempts)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
