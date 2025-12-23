"""Simulation duplicate endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import load_sql


# Inline request/response schemas
class DuplicateSimulationRequest(BaseModel):
    """Request to duplicate simulation."""

    simulationId: str


class DuplicateSimulationResponse(BaseModel):
    """Response from duplicate simulation."""

    success: bool
    simulationId: str
    message: str


router = APIRouter()


@router.post(
    "/duplicate",
    response_model=DuplicateSimulationResponse,
    dependencies=[
        audit_activity(
            "simulation.duplicated",
            "{{ actor.name }} duplicated simulation '{{ simulation.name }}'",
        )
    ],
)
async def duplicate_simulation(
    request: DuplicateSimulationRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateSimulationResponse:
    """Duplicate a simulation."""
    tags = ["simulations"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Use single comprehensive SQL file (DHH style)
        sql_query = load_sql("app/sql/v3/simulations/duplicate_simulation.sql")
        sql_params = (request.simulationId, profile_id)
        new_simulation_row = await conn.fetchrow(
            sql_query, request.simulationId, profile_id
        )

        if not new_simulation_row:
            raise HTTPException(
                status_code=404, detail=f"Simulation {request.simulationId} not found"
            )

        new_simulation_id = new_simulation_row["simulation_id"]
        simulation_name = new_simulation_row.get("scenario_name", "Unknown")
        actor_name = new_simulation_row.get("actor_name")

        # Set audit context with data from SQL query
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
                simulation={"name": simulation_name, "id": new_simulation_id},
            )

        result_data = DuplicateSimulationResponse(
            success=True,
            simulationId=new_simulation_id,
            message=f"Simulation '{simulation_name}' duplicated successfully",
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return result_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="duplicate_simulation",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
