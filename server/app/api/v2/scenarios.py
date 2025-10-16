"""Scenarios API endpoints."""

from typing import Annotated

from app.db import get_db
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
import asyncpg  # type: ignore

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


@router.post("/list", response_model=ScenariosListResponse)
async def get_scenarios_list(
    filters: ScenariosFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ScenariosListResponse:
    """Get scenarios list with all relationships."""
    try:
        repo = get_scenario_repository(conn)
        return await repo.get_scenarios_list(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail", response_model=ScenarioDetailResponse)
async def get_scenario_detail(
    request: ScenarioDetailRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ScenarioDetailResponse:
    """Get detailed scenario information."""
    try:
        repo = get_scenario_repository(conn)
        return await repo.get_scenario_detail(request)
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
        repo = get_scenario_repository(conn)
        return await repo.get_scenario_detail_default(request)
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
        repo = get_scenario_repository(conn)
        return await repo.create_scenario(request)
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
        repo = get_scenario_repository(conn)
        return await repo.update_scenario(request)
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
        repo = get_scenario_repository(conn)
        return await repo.duplicate_scenario(request)
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
        repo = get_scenario_repository(conn)
        return await repo.delete_scenario(request)
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
        repo = get_scenario_repository(conn)
        return await await repo.generate_scenario_ai(request)
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
        repo = get_scenario_repository(conn)
        return await repo.randomize_scenario_sections(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

