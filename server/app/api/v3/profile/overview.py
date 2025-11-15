"""Profile overview endpoint - v3 API."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_pool
from app.main import server
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class ProfileOverviewRequest(BaseModel):
    """Request to get profile overview."""

    profile_id: str


class ProfileOverviewResponse(BaseModel):
    """Response with profile overview data."""

    profile: dict[str, Any]
    latest_grades: list[dict[str, Any]]


@router.post("/overview", response_model=ProfileOverviewResponse)
@server.tool()
async def profile_overview(
    request: ProfileOverviewRequest,
) -> ProfileOverviewResponse:
    """
    Profile overview
    ----------------
    Profile + last login, classes, dashboard flags, latest grades.
    Accepts UUID or name.

    Input
      • profile_id - UUID or name/alias to search for

    Returns
      { "profile": { … }, "latest_grades": [ … ] }

    Quick-start
      ask:  "Show me Nina Park's profile"
      call: profile_overview("Nina Park")

    See also 👉 student_sim_report() for per-chat detail.
    """
    pool = get_pool()
    if not pool:
        raise HTTPException(
            status_code=500, detail="Database connection pool not available"
        )

    try:
        async with pool.acquire() as conn:
            sql = load_sql("sql/v3/profile/overview.sql")
            search_pattern = f"%{request.profile_id.lower()}%"
            result = await conn.fetchrow(sql, request.profile_id, search_pattern, 5)

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
                "last_login": result["last_login"].isoformat()
                if result["last_login"]
                else None,
                "viewed_intro": result["viewed_intro"],
                "active": result["active"],
                "created_at": result["created_at"].isoformat()
                if result["created_at"]
                else None,
            }

            # Transform latest grades (jsonb array to list of dicts) - may be string or list
            latest_grades = []
            latest_grades_data = result["latest_grades"]
            if isinstance(latest_grades_data, str):
                latest_grades_data = json.loads(latest_grades_data)
            if latest_grades_data and isinstance(latest_grades_data, list):
                for grade in latest_grades_data:
                    if isinstance(grade, dict):
                        latest_grades.append(
                            {
                                "simulation_title": grade.get("simulation_title"),
                                "score": float(grade["score"])
                                if grade.get("score")
                                else None,
                                "passed": grade.get("passed"),
                                "time_taken": grade.get("time_taken"),
                                "created_at": grade.get("created_at"),
                            }
                        )

            return ProfileOverviewResponse(
                profile=profile_data, latest_grades=latest_grades
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
