"""Parameters v2 API endpoints."""

from typing import Annotated

from app.db import get_session
from app.repositories.parameter_repository import get_parameter_repository
from app.schemas.parameters import (CreateParameterItemRequest,
                                    CreateParameterItemResponse,
                                    CreateParameterRequest,
                                    CreateParameterResponse,
                                    DeleteParameterRequest,
                                    DeleteParameterResponse,
                                    DuplicateParameterRequest,
                                    DuplicateParameterResponse,
                                    ParameterDetailDefaultRequest,
                                    ParameterDetailRequest,
                                    ParameterDetailResponse, ParametersFilters,
                                    ParametersListResponse,
                                    UpdateParameterRequest,
                                    UpdateParameterResponse)
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

router = APIRouter(prefix="/parameters", tags=["parameters"])


@router.post("/list", response_model=ParametersListResponse)
async def get_parameters_list(
    filters: ParametersFilters,
    db: Annotated[Session, Depends(get_session)],
) -> ParametersListResponse:
    """Get parameters list with item counts and permissions."""
    try:
        repo = get_parameter_repository(db)
        return repo.get_parameters_list(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail", response_model=ParameterDetailResponse)
async def get_parameter_detail(
    request: ParameterDetailRequest,
    db: Annotated[Session, Depends(get_session)],
) -> ParameterDetailResponse:
    """Get detailed parameter information with nested items."""
    try:
        repo = get_parameter_repository(db)
        return repo.get_parameter_detail(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail-default", response_model=ParameterDetailResponse)
async def get_parameter_detail_default(
    request: ParameterDetailDefaultRequest,
    db: Annotated[Session, Depends(get_session)],
) -> ParameterDetailResponse:
    """Get default parameter details for a profile."""
    try:
        repo = get_parameter_repository(db)
        return repo.get_parameter_detail_default(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create", response_model=CreateParameterResponse)
async def create_parameter(
    request: CreateParameterRequest,
    db: Annotated[Session, Depends(get_session)],
) -> CreateParameterResponse:
    """Create a new parameter with nested items."""
    try:
        repo = get_parameter_repository(db)
        return repo.create_parameter(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update", response_model=UpdateParameterResponse)
async def update_parameter(
    request: UpdateParameterRequest,
    db: Annotated[Session, Depends(get_session)],
) -> UpdateParameterResponse:
    """Update an existing parameter (replaces all items)."""
    try:
        repo = get_parameter_repository(db)
        return repo.update_parameter(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/duplicate", response_model=DuplicateParameterResponse)
async def duplicate_parameter(
    request: DuplicateParameterRequest,
    db: Annotated[Session, Depends(get_session)],
) -> DuplicateParameterResponse:
    """Duplicate a parameter with all items."""
    try:
        repo = get_parameter_repository(db)
        return repo.duplicate_parameter(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/delete", response_model=DeleteParameterResponse)
async def delete_parameter(
    request: DeleteParameterRequest,
    db: Annotated[Session, Depends(get_session)],
) -> DeleteParameterResponse:
    """Delete a parameter."""
    try:
        repo = get_parameter_repository(db)
        return repo.delete_parameter(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# PARAMETER ITEM CREATION (for inline creation from pickers)
# ============================================================================


@router.post("/items/create", response_model=CreateParameterItemResponse)
async def create_parameter_item(
    request: CreateParameterItemRequest,
    db: Annotated[Session, Depends(get_session)],
) -> CreateParameterItemResponse:
    """Create a single parameter item (for inline creation from pickers)."""
    try:
        repo = get_parameter_repository(db)
        return repo.create_parameter_item(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

