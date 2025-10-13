"""Simulations v2 API endpoints."""

from typing import Annotated

from app.db import get_session
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
from sqlalchemy.orm import Session

router = APIRouter(prefix="/simulations", tags=["simulations"])


@router.post("/list", response_model=SimulationsListResponse)
async def get_simulations_list(
    filters: SimulationsFilters,
    db: Annotated[Session, Depends(get_session)],
) -> SimulationsListResponse:
    """Get simulations list with permissions and relationships."""
    try:
        repo = get_simulation_repository(db)
        return repo.get_simulations_list(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail", response_model=SimulationDetailResponse)
async def get_simulation_detail(
    request: SimulationDetailRequest,
    db: Annotated[Session, Depends(get_session)],
) -> SimulationDetailResponse:
    """Get detailed simulation information."""
    try:
        repo = get_simulation_repository(db)
        return repo.get_simulation_detail(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail-default", response_model=SimulationDetailResponse)
async def get_simulation_detail_default(
    request: SimulationDetailDefaultRequest,
    db: Annotated[Session, Depends(get_session)],
) -> SimulationDetailResponse:
    """Get default simulation details for a profile."""
    try:
        repo = get_simulation_repository(db)
        return repo.get_simulation_detail_default(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create", response_model=CreateSimulationResponse)
async def create_simulation(
    request: CreateSimulationRequest,
    db: Annotated[Session, Depends(get_session)],
) -> CreateSimulationResponse:
    """Create a new simulation."""
    try:
        repo = get_simulation_repository(db)
        return repo.create_simulation(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update", response_model=UpdateSimulationResponse)
async def update_simulation(
    request: UpdateSimulationRequest,
    db: Annotated[Session, Depends(get_session)],
) -> UpdateSimulationResponse:
    """Update an existing simulation."""
    try:
        repo = get_simulation_repository(db)
        return repo.update_simulation(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/duplicate", response_model=DuplicateSimulationResponse)
async def duplicate_simulation(
    request: DuplicateSimulationRequest,
    db: Annotated[Session, Depends(get_session)],
) -> DuplicateSimulationResponse:
    """Duplicate a simulation."""
    try:
        repo = get_simulation_repository(db)
        return repo.duplicate_simulation(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/delete", response_model=DeleteSimulationResponse)
async def delete_simulation(
    request: DeleteSimulationRequest,
    db: Annotated[Session, Depends(get_session)],
) -> DeleteSimulationResponse:
    """Delete a simulation."""
    try:
        repo = get_simulation_repository(db)
        return repo.delete_simulation(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

