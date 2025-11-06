"""Simulation delete endpoint - v3 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel


# Inline request/response schemas
class DeleteSimulationRequest(BaseModel):
    """Request to delete simulation."""

    simulationId: str


class DeleteSimulationResponse(BaseModel):
    """Response from delete simulation."""

    success: bool
    message: str


router = APIRouter()


@router.post("/delete", response_model=DeleteSimulationResponse)
async def delete_simulation(
    request: DeleteSimulationRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteSimulationResponse:
    """Delete a simulation (with usage check)."""
    tags = ["simulations"]  # From router tags
    
    try:
        # Delete simulation with existence and usage checks in a single SQL file
        sql = load_sql("sql/v3/simulations/delete_simulation_complete.sql")
        result = await conn.fetchrow(sql, request.simulationId)

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

        result_data = DeleteSimulationResponse(
            success=True,
            message=f"Simulation '{result['title']}' deleted successfully",
        )
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

