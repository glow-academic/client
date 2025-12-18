"""Simulation delete endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.activity.audit import audit_activity, audit_set
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class DeleteSimulationRequest(BaseModel):
    """Request to delete simulation."""

    simulationId: str


class DeleteSimulationResponse(BaseModel):
    """Response from delete simulation."""

    success: bool
    message: str


router = APIRouter()


@router.post(
    "/delete",
    response_model=DeleteSimulationResponse,
    dependencies=[
        audit_activity(
            "simulation.deleted",
            "{{ actor.name }} deleted simulation '{{ simulation.name }}'",
        )
    ],
)
async def delete_simulation(
    request: DeleteSimulationRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteSimulationResponse:
    """Delete a simulation (with usage check)."""
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

        # Delete simulation with existence and usage checks in a single SQL file
        sql_query = load_sql("sql/v3/simulations/delete_simulation_complete.sql")
        sql_params = (request.simulationId, profile_id)
        result = await conn.fetchrow(sql_query, request.simulationId, profile_id)

        if not result:
            # Simulation doesn't exist
            raise HTTPException(
                status_code=404, detail=f"Simulation {request.simulationId} not found"
            )

        # Check if simulation was deleted or is in use
        if not result["deleted"]:
            # Simulation exists but is in use
            usage_count = result["usage_count"]
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete simulation: in use by {usage_count} cohort(s)",
            )

        simulation_name = result["title"]
        actor_name = result.get("actor_name")

        # Set audit context with data from SQL query
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
                simulation={"name": simulation_name, "id": request.simulationId},
            )

        result_data = DeleteSimulationResponse(
            success=True,
            message=f"Simulation '{simulation_name}' deleted successfully",
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
            operation="delete_simulation",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
