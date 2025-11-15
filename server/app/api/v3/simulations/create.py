"""Simulation create endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db, transaction
from app.utils.error_handler import handle_route_error
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
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
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateSimulationResponse:
    """Create a new simulation."""
    tags = ["simulations"]  # From router tags
    
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    
    try:
        async with transaction(conn):
            # Extract scenario IDs and active flags for SQL
            scenario_ids: list[str] = []
            scenario_active_flags: list[bool] = []
            
            for scenario_item in request.scenario_ids:
                if isinstance(scenario_item, str):
                    scenario_ids.append(scenario_item)
                    scenario_active_flags.append(True)
                else:
                    scenario_ids.append(scenario_item.scenario_id)
                    scenario_active_flags.append(scenario_item.active)

            # Ensure arrays are always arrays (empty arrays if None/empty)
            dept_ids = request.department_ids if request.department_ids else []
            scenario_ids_array = scenario_ids if scenario_ids else []
            scenario_flags_array = scenario_active_flags if scenario_active_flags else []

            # Create simulation with departments, time limit, and scenarios in single SQL (DHH style)
            sql_query = load_sql("sql/v3/simulations/create_simulation_complete.sql")
            sql_params = (
                request.title,
                request.description,
                request.active,
                request.practice_simulation,
                request.rubric_id,
                dept_ids,  # Always pass array (empty array if no departments)
                request.time_limit,
                scenario_ids_array,
                scenario_flags_array,
            )
            result = await conn.fetchrow(sql_query, *sql_params)

            if not result:
                raise ValueError("Failed to create simulation")

            simulation_id = result["simulation_id"]

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
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_simulation",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

