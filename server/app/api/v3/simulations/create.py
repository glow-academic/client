"""Simulation create endpoint - v3 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db, transaction
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel


# Inline request/response schemas
class ScenarioInRequest(BaseModel):
    """Scenario in request format."""

    scenario_id: str
    active: bool = True


class CreateSimulationRequest(BaseModel):
    """Request to create a simulation."""

    title: str
    description: str
    department_ids: list[str] | None
    active: bool
    practice_simulation: bool
    time_limit: int | None
    rubric_id: str
    scenario_ids: list[str] | list[ScenarioInRequest]


class CreateSimulationResponse(BaseModel):
    """Response from create simulation."""

    success: bool
    simulationId: str
    message: str


router = APIRouter()


@router.post("/create", response_model=CreateSimulationResponse)
async def create_simulation(
    request: CreateSimulationRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateSimulationResponse:
    """Create a new simulation."""
    tags = ["simulations"]  # From router tags
    
    try:
        async with transaction(conn):
            # Create simulation
            create_sql = load_sql("sql/v3/simulations/create_simulation.sql")
            result = await conn.fetchrow(
                create_sql,
                request.title,
                request.description,
                request.active,
                request.practice_simulation,
                request.rubric_id,
            )

            if not result:
                raise ValueError("Failed to create simulation")

            simulation_id = str(result["id"])

            # Insert department links if department_ids provided
            if request.department_ids:
                dept_sql = load_sql("sql/v3/simulations/create_simulation_departments.sql")
                await conn.execute(dept_sql, simulation_id, request.department_ids)

            # Insert time limit if provided
            if request.time_limit is not None:
                time_limit_sql = load_sql("sql/v3/simulations/insert_simulation_time_limit.sql")
                await conn.execute(time_limit_sql, simulation_id, request.time_limit)

            # Insert scenario relationships with active-first ordering
            scenario_sql = load_sql("sql/v3/simulations/insert_simulation_scenario.sql")

            # Sort scenarios: active first, then inactive
            active_scenarios: list[tuple[str, bool]] = []
            inactive_scenarios: list[tuple[str, bool]] = []

            for scenario_item in request.scenario_ids:
                # Handle both string IDs and ScenarioInRequest objects
                scenario_id: str
                active: bool
                if isinstance(scenario_item, str):
                    scenario_id = scenario_item
                    active = True
                else:
                    scenario_id = scenario_item.scenario_id
                    active = scenario_item.active

                if active:
                    active_scenarios.append((scenario_id, active))
                else:
                    inactive_scenarios.append((scenario_id, active))

            # Combine: active first, then inactive
            sorted_scenarios = active_scenarios + inactive_scenarios

            # Insert with proper position indices (1-indexed)
            for idx, (scenario_id, active) in enumerate(sorted_scenarios, start=1):
                await conn.execute(
                    scenario_sql,
                    simulation_id,
                    scenario_id,
                    active,
                    idx,
                )

            result_data = CreateSimulationResponse(
                success=True,
                simulationId=simulation_id,
                message=f"Simulation '{request.title}' created successfully",
            )
            
            # Invalidate cache after mutation
            await invalidate_tags(tags)
            response.headers["X-Invalidate-Tags"] = ",".join(tags)
            
            return result_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

