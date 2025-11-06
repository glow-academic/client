"""Simulation update endpoint - v3 API following DHH principles."""

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


class UpdateSimulationRequest(BaseModel):
    """Request to update simulation."""

    simulationId: str
    title: str
    description: str
    department_ids: list[str] | None
    active: bool
    practice_simulation: bool
    time_limit: int | None
    rubric_id: str
    scenario_ids: list[str] | list[ScenarioInRequest]


class UpdateSimulationResponse(BaseModel):
    """Response from update simulation."""

    success: bool
    message: str


router = APIRouter()


@router.post("/update", response_model=UpdateSimulationResponse)
async def update_simulation(
    request: UpdateSimulationRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateSimulationResponse:
    """Update an existing simulation."""
    tags = ["simulations"]  # From router tags
    
    try:
        async with transaction(conn):
            # Check if simulation exists
            get_name_sql = load_sql("sql/v3/simulations/get_simulation_name.sql")
            existing = await conn.fetchrow(get_name_sql, request.simulationId)

            if not existing:
                raise ValueError(f"Simulation not found: {request.simulationId}")

            # Update simulation
            update_sql = load_sql("sql/v3/simulations/update_simulation.sql")
            await conn.execute(
                update_sql,
                request.title,
                request.description,
                request.active,
                request.practice_simulation,
                request.rubric_id,
                request.simulationId,
            )

            # Update time limit in junction table
            # First delete existing, then insert if provided
            delete_time_limit_sql = load_sql("sql/v3/simulations/delete_simulation_time_limit.sql")
            await conn.execute(delete_time_limit_sql, request.simulationId)

            if request.time_limit is not None:
                insert_time_limit_sql = load_sql("sql/v3/simulations/insert_simulation_time_limit.sql")
                await conn.execute(insert_time_limit_sql, request.simulationId, request.time_limit)

            # Update department links
            # First deactivate all existing
            delete_dept_sql = load_sql("sql/v3/simulations/delete_simulation_departments.sql")
            await conn.execute(delete_dept_sql, request.simulationId)

            # Then insert new ones if provided
            if request.department_ids:
                create_dept_sql = load_sql("sql/v3/simulations/create_simulation_departments.sql")
                await conn.execute(create_dept_sql, request.simulationId, request.department_ids)

            # Update scenario relationships
            # Delete existing scenarios
            delete_scenarios_sql = load_sql("sql/v3/simulations/delete_simulation_scenarios.sql")
            await conn.execute(delete_scenarios_sql, request.simulationId)

            # Insert new scenarios with active-first ordering
            scenario_sql = load_sql("sql/v3/simulations/insert_simulation_scenario.sql")

            # Sort scenarios: active first, then inactive
            active_scenarios: list[tuple[str, bool]] = []
            inactive_scenarios: list[tuple[str, bool]] = []

            for scenario_item in request.scenario_ids:
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
                    request.simulationId,
                    scenario_id,
                    active,
                    idx,
                )

            result_data = UpdateSimulationResponse(
                success=True,
                message=f"Simulation '{request.title}' updated successfully",
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

