"""Scenarios API endpoints."""

from typing import Annotated

from app.db import get_session
from app.repositories.scenario_repository import get_scenario_repository
from app.schemas.scenarios import (CreateScenarioRequest,
                                   CreateScenarioResponse,
                                   DeleteScenarioRequest,
                                   DeleteScenarioResponse,
                                   DuplicateScenarioRequest,
                                   DuplicateScenarioResponse,
                                   GenerateScenarioAIRequest,
                                   GenerateScenarioAIResponse,
                                   RandomizeScenarioRequest,
                                   RandomizeScenarioResponse,
                                   ScenarioDetailDefaultRequest,
                                   ScenarioDetailRequest,
                                   ScenarioDetailResponse, ScenariosFilters,
                                   ScenariosListResponse,
                                   UpdateScenarioRequest,
                                   UpdateScenarioResponse)
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


@router.post("/list", response_model=ScenariosListResponse)
async def get_scenarios_list(
    filters: ScenariosFilters,
    db: Annotated[Session, Depends(get_session)],
) -> ScenariosListResponse:
    """Get scenarios list with all relationships."""
    try:
        repo = get_scenario_repository(db)
        return repo.get_scenarios_list(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail", response_model=ScenarioDetailResponse)
async def get_scenario_detail(
    request: ScenarioDetailRequest,
    db: Annotated[Session, Depends(get_session)],
) -> ScenarioDetailResponse:
    """Get detailed scenario information."""
    try:
        repo = get_scenario_repository(db)
        return repo.get_scenario_detail(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail-default", response_model=ScenarioDetailResponse)
async def get_scenario_detail_default(
    request: ScenarioDetailDefaultRequest,
    db: Annotated[Session, Depends(get_session)],
) -> ScenarioDetailResponse:
    """Get default scenario detail based on profile."""
    try:
        repo = get_scenario_repository(db)
        return repo.get_scenario_detail_default(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create", response_model=CreateScenarioResponse)
async def create_scenario(
    request: CreateScenarioRequest,
    db: Annotated[Session, Depends(get_session)],
) -> CreateScenarioResponse:
    """Create a new scenario."""
    try:
        repo = get_scenario_repository(db)
        return repo.create_scenario(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update", response_model=UpdateScenarioResponse)
async def update_scenario(
    request: UpdateScenarioRequest,
    db: Annotated[Session, Depends(get_session)],
) -> UpdateScenarioResponse:
    """Update an existing scenario."""
    try:
        repo = get_scenario_repository(db)
        return repo.update_scenario(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/duplicate", response_model=DuplicateScenarioResponse)
async def duplicate_scenario(
    request: DuplicateScenarioRequest,
    db: Annotated[Session, Depends(get_session)],
) -> DuplicateScenarioResponse:
    """Duplicate a scenario."""
    try:
        repo = get_scenario_repository(db)
        return repo.duplicate_scenario(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/delete", response_model=DeleteScenarioResponse)
async def delete_scenario(
    request: DeleteScenarioRequest,
    db: Annotated[Session, Depends(get_session)],
) -> DeleteScenarioResponse:
    """Delete a scenario."""
    try:
        repo = get_scenario_repository(db)
        return repo.delete_scenario(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# AI GENERATION AND RANDOMIZATION
# ============================================================================

@router.post("/generate-ai", response_model=GenerateScenarioAIResponse)
async def generate_scenario_ai(
    request: GenerateScenarioAIRequest,
    db: Annotated[Session, Depends(get_session)],
) -> GenerateScenarioAIResponse:
    """Generate AI scenario content (title, description, objectives)."""
    try:
        repo = get_scenario_repository(db)
        return await repo.generate_scenario_ai(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/randomize", response_model=RandomizeScenarioResponse)
async def randomize_scenario(
    request: RandomizeScenarioRequest,
    db: Annotated[Session, Depends(get_session)],
) -> RandomizeScenarioResponse:
    """Suggest randomized scenario sections."""
    try:
        repo = get_scenario_repository(db)
        return repo.randomize_scenario_sections(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

