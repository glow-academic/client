"""Personas API endpoints."""

from typing import Annotated

from app.db import get_db
from app.repositories.persona_repository import get_persona_repository
from app.schemas.personas import (CreatePersonaRequest, CreatePersonaResponse,
                                  DeletePersonaRequest, DeletePersonaResponse,
                                  DuplicatePersonaRequest,
                                  DuplicatePersonaResponse,
                                  PersonaDetailDefaultRequest,
                                  PersonaDetailRequest, PersonaDetailResponse,
                                  PersonasFilters, PersonasListResponse,
                                  UpdatePersonaRequest, UpdatePersonaResponse)
from fastapi import APIRouter, Depends, HTTPException
import asyncpg  # type: ignore

router = APIRouter(prefix="/personas", tags=["personas"])


@router.post("/list", response_model=PersonasListResponse)
async def get_personas_list(
    filters: PersonasFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PersonasListResponse:
    """Get personas list with permissions and scenario details."""
    try:
        repo = get_persona_repository(conn)
        return await repo.get_personas_list(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/duplicate", response_model=DuplicatePersonaResponse)
async def duplicate_persona(
    request: DuplicatePersonaRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicatePersonaResponse:
    """Duplicate a persona."""
    try:
        repo = get_persona_repository(conn)
        return await repo.duplicate_persona(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/delete", response_model=DeletePersonaResponse)
async def delete_persona(
    request: DeletePersonaRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeletePersonaResponse:
    """Delete a persona."""
    try:
        repo = get_persona_repository(conn)
        return await repo.delete_persona(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail", response_model=PersonaDetailResponse)
async def get_persona_detail(
    request: PersonaDetailRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PersonaDetailResponse:
    """Get detailed persona information."""
    try:
        repo = get_persona_repository(conn)
        return await repo.get_persona_detail(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail-default", response_model=PersonaDetailResponse)
async def get_persona_detail_default(
    request: PersonaDetailDefaultRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PersonaDetailResponse:
    """Get default persona detail based on profile."""
    try:
        repo = get_persona_repository(conn)
        return await repo.get_persona_detail_default(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create", response_model=CreatePersonaResponse)
async def create_persona(
    request: CreatePersonaRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreatePersonaResponse:
    """Create a new persona."""
    try:
        repo = get_persona_repository(conn)
        return await repo.create_persona(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update", response_model=UpdatePersonaResponse)
async def update_persona(
    request: UpdatePersonaRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdatePersonaResponse:
    """Update an existing persona."""
    try:
        repo = get_persona_repository(conn)
        return await repo.update_persona(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

