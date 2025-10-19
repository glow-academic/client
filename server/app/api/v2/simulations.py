"""Simulations v2 API endpoints."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException

from app.db import get_db
from app.schemas.simulations import (
    CreateSimulationRequest,
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
    UpdateSimulationResponse,
)
from app.services.simulation_service import get_simulation_service

router = APIRouter(prefix="/simulations", tags=["simulations"])


@router.post("/list", response_model=SimulationsListResponse)
async def get_simulations_list(
    filters: SimulationsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SimulationsListResponse:
    """Get simulations list with permissions and relationships."""
    try:
        service = get_simulation_service(conn)
        return await service.get_simulations_list(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail", response_model=SimulationDetailResponse)
async def get_simulation_detail(
    request: SimulationDetailRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SimulationDetailResponse:
    """Get detailed simulation information."""
    try:
        service = get_simulation_service(conn)
        return await service.get_simulation_detail(request)
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
        service = get_simulation_service(conn)
        return await service.get_simulation_detail_default(request)
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
        service = get_simulation_service(conn)
        return await service.create_simulation(request)
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
        service = get_simulation_service(conn)
        return await service.update_simulation(request)
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
        service = get_simulation_service(conn)
        return await service.duplicate_simulation(request)
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
        service = get_simulation_service(conn)
        return await service.delete_simulation(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
