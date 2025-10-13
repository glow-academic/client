"""Personas API endpoints."""

from typing import Annotated

from app.db import get_session
from app.schemas.personas import (CreatePersonaRequest, CreatePersonaResponse,
                                  DeletePersonaRequest, DeletePersonaResponse,
                                  DuplicatePersonaRequest,
                                  DuplicatePersonaResponse,
                                  PersonaDetailDefaultRequest,
                                  PersonaDetailRequest, PersonaDetailResponse,
                                  PersonasFilters, PersonasListResponse)
from app.services.persona_service import PersonaService
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

router = APIRouter(prefix="/personas", tags=["personas"])


@router.post("/list", response_model=PersonasListResponse)
async def get_personas_list(
    filters: PersonasFilters,
    db: Annotated[Session, Depends(get_session)],
) -> PersonasListResponse:
    """Get personas list with permissions and scenario details."""
    try:
        service = PersonaService(db)
        return service.get_personas_list(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/duplicate", response_model=DuplicatePersonaResponse)
async def duplicate_persona(
    request: DuplicatePersonaRequest,
    db: Annotated[Session, Depends(get_session)],
) -> DuplicatePersonaResponse:
    """Duplicate a persona."""
    try:
        service = PersonaService(db)
        return service.duplicate_persona(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/delete", response_model=DeletePersonaResponse)
async def delete_persona(
    request: DeletePersonaRequest,
    db: Annotated[Session, Depends(get_session)],
) -> DeletePersonaResponse:
    """Delete a persona."""
    try:
        service = PersonaService(db)
        return service.delete_persona(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail", response_model=PersonaDetailResponse)
async def get_persona_detail(
    request: PersonaDetailRequest,
    db: Annotated[Session, Depends(get_session)],
) -> PersonaDetailResponse:
    """Get detailed persona information."""
    try:
        service = PersonaService(db)
        return service.get_persona_detail(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail-default", response_model=PersonaDetailResponse)
async def get_persona_detail_default(
    request: PersonaDetailDefaultRequest,
    db: Annotated[Session, Depends(get_session)],
) -> PersonaDetailResponse:
    """Get default persona detail based on profile."""
    try:
        service = PersonaService(db)
        return service.get_persona_detail_default(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create", response_model=CreatePersonaResponse)
async def create_persona(
    request: CreatePersonaRequest,
    db: Annotated[Session, Depends(get_session)],
) -> CreatePersonaResponse:
    """Create a new persona."""
    try:
        service = PersonaService(db)
        return service.create_persona(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

