"""Providers v2 API endpoints."""

from typing import Annotated

from app.db import get_session
from app.repositories.provider_repository import get_provider_repository
from app.schemas.providers import (CreateModelRequest, CreateModelResponse,
                                   CreateProviderRequest,
                                   CreateProviderResponse, DeleteModelRequest,
                                   DeleteModelResponse, DeleteProviderRequest,
                                   DeleteProviderResponse, ModelDetailRequest,
                                   ModelDetailResponse, ProviderDetailRequest,
                                   ProviderDetailResponse, ProvidersFilters,
                                   ProvidersListResponse, UpdateModelRequest,
                                   UpdateModelResponse, UpdateProviderRequest,
                                   UpdateProviderResponse)
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

router = APIRouter(prefix="/providers", tags=["providers"])


# ============================================================================
# PROVIDER ENDPOINTS
# ============================================================================


@router.post("/list", response_model=ProvidersListResponse)
async def get_providers_list(
    filters: ProvidersFilters,
    db: Annotated[Session, Depends(get_session)],
) -> ProvidersListResponse:
    """Get providers list with nested models (hierarchical)."""
    try:
        repo = get_provider_repository(db)
        return repo.get_providers_list(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail", response_model=ProviderDetailResponse)
async def get_provider_detail(
    request: ProviderDetailRequest,
    db: Annotated[Session, Depends(get_session)],
) -> ProviderDetailResponse:
    """Get detailed provider information."""
    try:
        repo = get_provider_repository(db)
        return repo.get_provider_detail(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create", response_model=CreateProviderResponse)
async def create_provider(
    request: CreateProviderRequest,
    db: Annotated[Session, Depends(get_session)],
) -> CreateProviderResponse:
    """Create a new provider."""
    try:
        repo = get_provider_repository(db)
        return repo.create_provider(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update", response_model=UpdateProviderResponse)
async def update_provider(
    request: UpdateProviderRequest,
    db: Annotated[Session, Depends(get_session)],
) -> UpdateProviderResponse:
    """Update an existing provider."""
    try:
        repo = get_provider_repository(db)
        return repo.update_provider(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/delete", response_model=DeleteProviderResponse)
async def delete_provider(
    request: DeleteProviderRequest,
    db: Annotated[Session, Depends(get_session)],
) -> DeleteProviderResponse:
    """Delete a provider."""
    try:
        repo = get_provider_repository(db)
        return repo.delete_provider(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# MODEL ENDPOINTS
# ============================================================================


@router.post("/models/detail", response_model=ModelDetailResponse)
async def get_model_detail(
    request: ModelDetailRequest,
    db: Annotated[Session, Depends(get_session)],
) -> ModelDetailResponse:
    """Get detailed model information."""
    try:
        repo = get_provider_repository(db)
        return repo.get_model_detail(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/models/create", response_model=CreateModelResponse)
async def create_model(
    request: CreateModelRequest,
    db: Annotated[Session, Depends(get_session)],
) -> CreateModelResponse:
    """Create a new model."""
    try:
        repo = get_provider_repository(db)
        return repo.create_model(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/models/update", response_model=UpdateModelResponse)
async def update_model(
    request: UpdateModelRequest,
    db: Annotated[Session, Depends(get_session)],
) -> UpdateModelResponse:
    """Update an existing model."""
    try:
        repo = get_provider_repository(db)
        return repo.update_model(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/models/delete", response_model=DeleteModelResponse)
async def delete_model(
    request: DeleteModelRequest,
    db: Annotated[Session, Depends(get_session)],
) -> DeleteModelResponse:
    """Delete a model."""
    try:
        repo = get_provider_repository(db)
        return repo.delete_model(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

