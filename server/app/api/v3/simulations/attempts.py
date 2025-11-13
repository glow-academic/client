"""Simulation attempts endpoint - v3 API."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.db import get_db
from app.mcp import server
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

router = APIRouter()


class SimulationAttemptsRequest(BaseModel):
    """Request to get simulation attempts."""

    sim_id: str
    limit: int = 200


class SimulationAttemptResult(BaseModel):
    """Simulation attempt result."""

    id: str
    student: str
    score: float | None
    passed: bool | None
    time_taken: int | None
    created_at: str


@router.post("/attempts", response_model=list[SimulationAttemptResult])
@server.tool()
async def simulation_attempts(
    request: SimulationAttemptsRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> list[SimulationAttemptResult]:
    """
    Flat list of attempts (who, when, score)
    List all attempts for a specific simulation.

    Input
      • sim_id - UUID of the simulation
      • limit - Max results (default: 200)

    Returns
      [ { "id": "…", "student": "…", "score": 85, … }, … ]

    Quick-start
      ask:  "List last 200 attempts on Sim Y"
      call: simulation_attempts("uuid-here")

    See also simulation_overview() for aggregate stats.
    """
    try:
        sql = load_sql("sql/v3/simulations/attempts.sql")
        rows = await conn.fetch(sql, request.sim_id, request.limit)

        results = []
        for row in rows:
            first = row["first_name"] or ""
            last = row["last_name"] or ""
            alias = row["alias"] or ""
            student_name = (
                " ".join(x for x in (first, last) if x).strip()
                or alias
                or "Unknown"
            )

            results.append(
                SimulationAttemptResult(
                    id=str(row["id"]),
                    student=student_name,
                    score=float(row["score"]) if row["score"] else None,
                    passed=row["passed"],
                    time_taken=row["time_taken"],
                    created_at=row["created_at"].isoformat()
                    if row["created_at"]
                    else "",
                )
            )

        return results
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}"
        )

