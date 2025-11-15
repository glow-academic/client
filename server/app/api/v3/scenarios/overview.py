"""Scenario overview endpoint - v3 API."""

import json
import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_pool
from app.main import server
from app.utils.error_handler import handle_route_error
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class ScenarioOverviewRequest(BaseModel):
    """Request to get scenario overview."""

    scenario_id: str


class ScenarioOverviewResponse(BaseModel):
    """Response with scenario overview data."""

    id: str
    title: str
    simulations: list[dict[str, Any]]
    persona_ids: list[str] | None


@router.post("/overview", response_model=ScenarioOverviewResponse)
@server.tool()
async def scenario_overview(
    request: ScenarioOverviewRequest,
) -> ScenarioOverviewResponse:
    """
    🎭 Scenario overview with metadata & usage
    -----------------------------------------
    Show scenario details and associated simulations.

    Input
      • scenario_id – UUID of the scenario

    Returns
      { "id": "…", "title": "…", "simulations": […], … }

    Quick-start
      ask:  "Show me details for scenario X"
      call: scenario_overview("uuid-here")

    See also 👉 simulation_overview() for sim details.
    """
    try:
        scenario_uuid = uuid.UUID(request.scenario_id)
    except ValueError:
        raise HTTPException(
            status_code=400, detail=f"Invalid scenario_id format: {request.scenario_id}"
        )

    pool = get_pool()
    if not pool:
        raise HTTPException(
            status_code=500, detail="Database connection pool not available"
        )

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with pool.acquire() as conn:
            sql_query = load_sql("sql/v3/scenarios/overview.sql")
            sql_params = (scenario_uuid,)
            result = await conn.fetchrow(sql_query, scenario_uuid)

            if not result:
                raise HTTPException(
                    status_code=404, detail=f"Scenario not found: {request.scenario_id}"
                )

            # Parse simulations
            simulations = []
            simulations_data = result["simulations"]
            if isinstance(simulations_data, str):
                simulations_data = json.loads(simulations_data)
            if simulations_data and isinstance(simulations_data, list):
                simulations = [
                    {
                        "id": str(s["id"]),
                        "title": s["title"],
                        "active": s["active"],
                        "time_limit": s["time_limit"],
                        "created_at": s["created_at"].isoformat()
                        if s.get("created_at")
                        else None,
                    }
                    for s in simulations_data
                ]

            persona_ids = result["persona_ids"] or []

            return ScenarioOverviewResponse(
                id=str(result["id"]),
                title=result["name"],
                simulations=simulations,
                persona_ids=persona_ids if persona_ids else None,
            )
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path="/api/v3/scenarios/overview",  # Constructed path for tool endpoint
            operation="scenario_overview",
            sql_query=sql_query,
            sql_params=sql_params,
            request=None,  # Tool endpoints don't have Request
        )
