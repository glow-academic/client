"""Simulations v2 API endpoints."""

from typing import Annotated

from app.db import get_db
from app.repositories.simulation_repository import get_simulation_repository
from app.schemas.simulations import (CreateSimulationRequest,
                                     CreateSimulationResponse,
                                     DeleteSimulationRequest,
                                     DeleteSimulationResponse,
                                     DuplicateSimulationRequest,
                                     DuplicateSimulationResponse,
                                     SimulationDetailDefaultRequest,
                                     SimulationDetailRequest,
                                     SimulationDetailResponse,
                                     SimulationsFilters,
                                     SimulationsListResponse,
                                     UpdateSimulationRequest,
                                     UpdateSimulationResponse)
from fastapi import APIRouter, Depends, HTTPException
import asyncpg  # type: ignore

router = APIRouter(prefix="/simulations", tags=["simulations"])


@router.post("/list", response_model=SimulationsListResponse)
async def get_simulations_list(
    filters: SimulationsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SimulationsListResponse:
    """Get simulations list with permissions and relationships."""
    try:
        repo = get_simulation_repository(conn)
        return await repo.get_simulations_list(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail", response_model=SimulationDetailResponse)
async def get_simulation_detail(
    request: SimulationDetailRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SimulationDetailResponse:
    """Get detailed simulation information."""
    try:
        repo = get_simulation_repository(conn)
        return await repo.get_simulation_detail(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail-default", response_model=SimulationDetailResponse)
async def get_simulation_detail_default(
    request: SimulationDetailDefaultRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SimulationDetailResponse:
    """Get default simulation details for a profile."""
    try:
        repo = get_simulation_repository(conn)
        return await repo.get_simulation_detail_default(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create", response_model=CreateSimulationResponse)
async def create_simulation(
    request: CreateSimulationRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateSimulationResponse:
    """Create a new simulation."""
    try:
        repo = get_simulation_repository(conn)
        return await repo.create_simulation(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update", response_model=UpdateSimulationResponse)
async def update_simulation(
    request: UpdateSimulationRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateSimulationResponse:
    """Update an existing simulation."""
    try:
        repo = get_simulation_repository(conn)
        return await repo.update_simulation(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/duplicate", response_model=DuplicateSimulationResponse)
async def duplicate_simulation(
    request: DuplicateSimulationRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateSimulationResponse:
    """Duplicate a simulation."""
    try:
        repo = get_simulation_repository(conn)
        return await repo.duplicate_simulation(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/delete", response_model=DeleteSimulationResponse)
async def delete_simulation(
    request: DeleteSimulationRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteSimulationResponse:
    """Delete a simulation."""
    try:
        repo = get_simulation_repository(conn)
        return await repo.delete_simulation(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

