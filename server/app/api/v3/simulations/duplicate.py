"""Simulation duplicate endpoint - v3 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db, transaction
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException
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
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateSimulationResponse:
    """Duplicate a simulation."""
    try:
        async with transaction(conn):
            # Get original simulation data
            get_sql = load_sql("sql/v3/simulations/get_simulation_for_duplicate.sql")
            result = await conn.fetchrow(get_sql, request.simulationId)

            if not result:
                raise ValueError(f"Simulation not found: {request.simulationId}")

            # Create duplicate simulation
            duplicate_sql = load_sql("sql/v3/simulations/insert_duplicate_simulation.sql")
            new_sim = await conn.fetchrow(
                duplicate_sql,
                result["title"],
                result["description"],
                result["rubric_id"],
            )

            if not new_sim:
                raise ValueError("Failed to create duplicate simulation")

            new_simulation_id = str(new_sim["id"])

            # Copy scenario relationships
            copy_scenarios_sql = load_sql("sql/v3/simulations/copy_simulation_scenarios.sql")
            await conn.execute(copy_scenarios_sql, new_simulation_id, request.simulationId)

            result_data = DuplicateSimulationResponse(
                success=True,
                simulationId=new_simulation_id,
                message=f"Simulation '{result['title']}' duplicated successfully",
            )
            
            # Invalidate cache after mutation
            await invalidate_tags(tags)
            response.headers["X-Invalidate-Tags"] = ",".join(tags)
            
            return result_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

