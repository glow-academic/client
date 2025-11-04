"""Simulation delete endpoint - v3 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db, transaction
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


@router.post("/delete", response_model=DeleteSimulationResponse)
async def delete_simulation(
    request: DeleteSimulationRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteSimulationResponse:
    """Delete a simulation."""
    try:
        async with transaction(conn):
            # Check if simulation is in use
            check_usage_sql = load_sql("sql/v3/simulations/check_simulation_usage.sql")
            usage = await conn.fetchrow(check_usage_sql, request.simulationId)

            if not usage:
                raise ValueError("Failed to check simulation usage")

            usage_count = usage.get("usage_count", 0)
            if usage_count > 0:
                raise ValueError("Cannot delete simulation that is in use")

            # Get simulation name
            get_name_sql = load_sql("sql/v3/simulations/get_simulation_name.sql")
            simulation = await conn.fetchrow(get_name_sql, request.simulationId)

            if not simulation:
                raise ValueError(f"Simulation not found: {request.simulationId}")

            # Delete simulation (cascades to related tables)
            delete_sql = load_sql("sql/v3/simulations/delete_simulation.sql")
            await conn.execute(delete_sql, request.simulationId)

            return DeleteSimulationResponse(
                success=True,
                message=f"Simulation '{simulation['title']}' deleted successfully",
            )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

