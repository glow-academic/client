"""Providers v2 API endpoints."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.schemas.providers import (CreateModelRequest, CreateModelResponse,
                                   CreateProviderRequest,
                                   CreateProviderResponse,
                                   DecryptProviderKeyRequest,
                                   DecryptProviderKeyResponse,
                                   DeleteModelRequest, DeleteModelResponse,
                                   DeleteProviderRequest,
                                   DeleteProviderResponse, ModelDetailRequest,
                                   ModelDetailResponse, ProviderDetailRequest,
                                   ProviderDetailResponse, ProvidersFilters,
                                   ProvidersListResponse, UpdateModelRequest,
                                   UpdateModelResponse, UpdateProviderRequest,
                                   UpdateProviderResponse)
from app.services.provider_service import get_provider_service
from app.utils.auth import decrypt_api_key
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter(prefix="/providers", tags=["providers"])


# ============================================================================
# PROVIDER ENDPOINTS
# ============================================================================


@router.post("/list", response_model=ProvidersListResponse)
async def get_providers_list(
    filters: ProvidersFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ProvidersListResponse:
    """Get providers list with nested models (hierarchical)."""
    try:
        service = get_provider_service(conn)
        return await service.get_providers_list(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail", response_model=ProviderDetailResponse)
async def get_provider_detail(
    request: ProviderDetailRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ProviderDetailResponse:
    """Get detailed provider information."""
    try:
        service = get_provider_service(conn)
        return await service.get_provider_detail(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create", response_model=CreateProviderResponse)
async def create_provider(
    request: CreateProviderRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateProviderResponse:
    """Create a new provider."""
    try:
        service = get_provider_service(conn)
        return await service.create_provider(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update", response_model=UpdateProviderResponse)
async def update_provider(
    request: UpdateProviderRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateProviderResponse:
    """Update an existing provider."""
    try:
        service = get_provider_service(conn)
        return await service.update_provider(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/delete", response_model=DeleteProviderResponse)
async def delete_provider(
    request: DeleteProviderRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteProviderResponse:
    """Delete a provider."""
    try:
        service = get_provider_service(conn)
        return await service.delete_provider(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/decrypt-key", response_model=DecryptProviderKeyResponse)
async def decrypt_provider_key(
    request: DecryptProviderKeyRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DecryptProviderKeyResponse:
    """Decrypt provider API key for authorized users."""
    try:
        service = get_provider_service(conn)
        
        # Get provider detail to verify access and get encrypted key
        provider_detail_request = ProviderDetailRequest(
            providerId=request.providerId,
            profileId=request.profileId
        )
        provider_detail = await service.get_provider_detail(provider_detail_request)
        
        # Decrypt the API key
        decrypted_key = decrypt_api_key(provider_detail.api_key)
        
        return DecryptProviderKeyResponse(api_key=decrypted_key)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# MODEL ENDPOINTS
# ============================================================================


@router.post("/models/detail", response_model=ModelDetailResponse)
async def get_model_detail(
    request: ModelDetailRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ModelDetailResponse:
    """Get detailed model information."""
    try:
        service = get_provider_service(conn)
        return await service.get_model_detail(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/models/create", response_model=CreateModelResponse)
async def create_model(
    request: CreateModelRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateModelResponse:
    """Create a new model."""
    try:
        service = get_provider_service(conn)
        return await service.create_model(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/models/update", response_model=UpdateModelResponse)
async def update_model(
    request: UpdateModelRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateModelResponse:
    """Update an existing model."""
    try:
        service = get_provider_service(conn)
        return await service.update_model(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/models/delete", response_model=DeleteModelResponse)
async def delete_model(
    request: DeleteModelRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteModelResponse:
    """Delete a model."""
    try:
        service = get_provider_service(conn)
        return await service.delete_model(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
