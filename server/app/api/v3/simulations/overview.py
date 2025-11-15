"""Simulation overview endpoint - v3 API."""

import json
import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_pool
from app.main import server
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class SimulationOverviewRequest(BaseModel):
    """Request to get simulation overview."""

    sim_id: str


class SimulationOverviewResponse(BaseModel):
    """Response with simulation overview data."""

    simulation: dict[str, Any]
    rubric: dict[str, Any] | None
    cohorts: list[dict[str, Any]]
    scenarios: list[dict[str, Any]]
    stats: dict[str, Any]


@router.post("/overview", response_model=SimulationOverviewResponse)
@server.tool()
async def simulation_overview(
    request: SimulationOverviewRequest,
) -> SimulationOverviewResponse:
    """
    🔎 Simulation overview
    ----------------------
    Sim meta, rubric, cohorts, scenarios, pass stats.

    Input
      • sim_id – UUID of the simulation

    Returns
      { "simulation": { … }, "rubric": { … }, "cohorts": [ … ], "stats": { … } }

    Quick-start
      ask:  "Give me the Induction Homework sim stats"
      call: simulation_overview("uuid-here")

    See also 👉 simulation_attempts() for detailed attempt list.
    """
    try:
        simulation_uuid = uuid.UUID(request.sim_id)
    except ValueError:
        raise HTTPException(
            status_code=400, detail=f"Invalid sim_id format: {request.sim_id}"
        )

    pool = get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database connection pool not available")

    try:
        async with pool.acquire() as conn:
            sql = load_sql("sql/v3/simulations/overview.sql")
            result = await conn.fetchrow(sql, simulation_uuid)

            if not result:
                raise HTTPException(
                    status_code=404, detail=f"Simulation not found: {request.sim_id}"
                )

            simulation_data = {
                "id": str(result["id"]),
                "title": result["title"],
                "active": result["active"],
                "time_limit": result["time_limit"],
                "created_at": result["created_at"].isoformat()
                if result["created_at"]
                else None,
            }

            # Parse rubric
            rubric_data = result["rubric"]
            if isinstance(rubric_data, str):
                rubric_data = json.loads(rubric_data)

            # Parse cohorts
            cohorts = []
            cohorts_data = result["cohorts"]
            if isinstance(cohorts_data, str):
                cohorts_data = json.loads(cohorts_data)
            if cohorts_data and isinstance(cohorts_data, list):
                cohorts = [
                    {
                        "id": str(c["id"]),
                        "title": c["title"],
                        "active": c["active"],
                    }
                    for c in cohorts_data
                ]

            # Parse scenarios
            scenarios = []
            scenarios_data = result["scenarios"]
            if isinstance(scenarios_data, str):
                scenarios_data = json.loads(scenarios_data)
            if scenarios_data and isinstance(scenarios_data, list):
                scenarios = [
                    {
                        "id": str(s["id"]),
                        "name": s["name"],
                        "problem_statement": s["problem_statement"],
                        "position": s["position"],
                    }
                    for s in scenarios_data
                ]

            stats = {
                "total_attempts": int(result["total_attempts"] or 0),
                "total_graded": int(result["total_graded"] or 0),
                "total_passed": int(result["total_passed"] or 0),
            }

            return SimulationOverviewResponse(
                simulation=simulation_data,
                rubric=rubric_data if rubric_data else None,
                cohorts=cohorts,
                scenarios=scenarios,
                stats=stats,
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

