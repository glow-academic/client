"""Simulation duplicate endpoint - v3 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel


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


@router.post("/duplicate", response_model=DuplicateSimulationResponse)
async def duplicate_simulation(
    request: DuplicateSimulationRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateSimulationResponse:
    """Duplicate a simulation."""
    tags = ["simulations"]  # From router tags
    
    try:
        # Use single comprehensive SQL file (DHH style)
        duplicate_sql = load_sql("sql/v3/simulations/duplicate_simulation.sql")
        new_simulation_row = await conn.fetchrow(duplicate_sql, request.simulationId)

        if not new_simulation_row:
            raise HTTPException(status_code=404, detail=f"Simulation {request.simulationId} not found")

        new_simulation_id = new_simulation_row["simulation_id"]

        # Get original title for message
        original_title = await conn.fetchval(
            "SELECT title FROM simulations WHERE id = $1", request.simulationId
        )

        result_data = DuplicateSimulationResponse(
            success=True,
            simulationId=new_simulation_id,
            message=f"Simulation '{original_title}' duplicated successfully",
        )
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

