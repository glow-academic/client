"""Personas API endpoints."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.schemas.personas import (CreatePersonaRequest, CreatePersonaResponse,
                                  DeletePersonaRequest, DeletePersonaResponse,
                                  DuplicatePersonaRequest,
                                  DuplicatePersonaResponse,
                                  PersonaDetailDefaultRequest,
                                  PersonaDetailRequest, PersonaDetailResponse,
                                  PersonasFilters, PersonasListResponse,
                                  UpdatePersonaRequest, UpdatePersonaResponse)
from app.services.persona_service import get_persona_service
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter(prefix="/personas", tags=["personas"])


@router.post("/list", response_model=PersonasListResponse)
async def get_personas_list(
    filters: PersonasFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PersonasListResponse:
    """Get personas list with permissions and scenario details."""
    try:
        service = get_persona_service(conn)
        return await service.get_personas_list(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/duplicate", response_model=DuplicatePersonaResponse)
async def duplicate_persona(
    request: DuplicatePersonaRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicatePersonaResponse:
    """Duplicate a persona."""
    try:
        service = get_persona_service(conn)
        return await service.duplicate_persona(request)
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
        service = get_persona_service(conn)
        return await service.delete_persona(request)
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
        service = get_persona_service(conn)
        return await service.get_persona_detail(request)
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
        service = get_persona_service(conn)
        return await service.get_persona_detail_default(request)
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
        service = get_persona_service(conn)
        return await service.create_persona(request)
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
        service = get_persona_service(conn)
        return await service.update_persona(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

