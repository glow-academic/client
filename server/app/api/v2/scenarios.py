"""Scenarios API endpoints."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
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
from app.services.scenario_service import get_scenario_service
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


@router.post("/list", response_model=ScenariosListResponse)
async def get_scenarios_list(
    filters: ScenariosFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ScenariosListResponse:
    """Get scenarios list with all relationships."""
    try:
        service = get_scenario_service(conn)
        return await service.get_scenarios_list(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail", response_model=ScenarioDetailResponse)
async def get_scenario_detail(
    request: ScenarioDetailRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ScenarioDetailResponse:
    """Get detailed scenario information."""
    try:
        service = get_scenario_service(conn)
        return await service.get_scenario_detail(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail-default", response_model=ScenarioDetailResponse)
async def get_scenario_detail_default(
    request: ScenarioDetailDefaultRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ScenarioDetailResponse:
    """Get default scenario detail based on profile."""
    try:
        service = get_scenario_service(conn)
        return await service.get_scenario_detail_default(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create", response_model=CreateScenarioResponse)
async def create_scenario(
    request: CreateScenarioRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateScenarioResponse:
    """Create a new scenario."""
    try:
        service = get_scenario_service(conn)
        return await service.create_scenario(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update", response_model=UpdateScenarioResponse)
async def update_scenario(
    request: UpdateScenarioRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateScenarioResponse:
    """Update an existing scenario."""
    try:
        service = get_scenario_service(conn)
        return await service.update_scenario(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/duplicate", response_model=DuplicateScenarioResponse)
async def duplicate_scenario(
    request: DuplicateScenarioRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateScenarioResponse:
    """Duplicate a scenario."""
    try:
        service = get_scenario_service(conn)
        return await service.duplicate_scenario(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/delete", response_model=DeleteScenarioResponse)
async def delete_scenario(
    request: DeleteScenarioRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteScenarioResponse:
    """Delete a scenario."""
    try:
        service = get_scenario_service(conn)
        return await service.delete_scenario(request)
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
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GenerateScenarioAIResponse:
    """Generate AI scenario content (title, description, objectives)."""
    try:
        service = get_scenario_service(conn)
        return await service.generate_scenario_ai(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/randomize", response_model=RandomizeScenarioResponse)
async def randomize_scenario(
    request: RandomizeScenarioRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RandomizeScenarioResponse:
    """Suggest randomized scenario sections."""
    try:
        service = get_scenario_service(conn)
        return await service.randomize_scenario_sections(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

