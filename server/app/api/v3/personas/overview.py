"""Persona overview endpoint - v3 API."""

import json
import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.db import get_pool
from app.main import server
from app.utils.error_handler import handle_route_error
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class PersonaOverviewRequest(BaseModel):
    """Request to get persona overview."""

    persona_id: str


class PersonaOverviewResponse(BaseModel):
    """Response with persona overview data."""

    id: str
    name: str
    scenarios: list[dict[str, Any]]


@router.post("/overview", response_model=PersonaOverviewResponse)
@server.tool()
async def persona_overview(
    request: PersonaOverviewRequest,
) -> PersonaOverviewResponse:
    """
    Persona overview
    --------------
    Show persona details and associated simulations.

    Input
      • persona_id - UUID of the persona

    Returns
      { "id": "…", "name": "…", "scenarios": […], … }

    Quick-start
      ask:  "Show me details for persona X"
      call: persona_overview("uuid-here")

    See also 👉 simulation_overview() for sim details.
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

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with pool.acquire() as conn:
            sql_query = load_sql("sql/v3/personas/overview.sql")
            sql_params = (persona_uuid,)
            result = await conn.fetchrow(sql_query, persona_uuid)

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
                scenarios = [
                    {
                        "id": str(s["id"]),
                        "name": s["name"],
                        "problem_statement": s["problem_statement"],
                        "default_scenario": s["default_scenario"],
                        "created_at": s["created_at"].isoformat()
                        if s.get("created_at")
                        else None,
                    }
                    for s in scenarios_data
                ]

            return PersonaOverviewResponse(
                id=str(result["id"]),
                name=result["name"],
                scenarios=scenarios,
            )
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path="/api/v3/personas/overview",  # Constructed path for tool endpoint
            operation="persona_overview",
            sql_query=sql_query,
            sql_params=sql_params,
            request=None,  # Tool endpoints don't have Request
        )

