"""Rubrics v2 API endpoints."""

from typing import Annotated

from app.db import get_session
from app.repositories.rubric_repository import get_rubric_repository
from app.schemas.rubrics import (CreateRubricRequest, CreateRubricResponse,
                                 DeleteRubricRequest, DeleteRubricResponse,
                                 DuplicateRubricRequest,
                                 DuplicateRubricResponse,
                                 RubricDetailDefaultRequest,
                                 RubricDetailRequest, RubricDetailResponse,
                                 RubricsFilters, RubricsListResponse,
                                 UpdateRubricRequest, UpdateRubricResponse)
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

router = APIRouter(prefix="/rubrics", tags=["rubrics"])


@router.post("/list", response_model=RubricsListResponse)
async def get_rubrics_list(
    filters: RubricsFilters,
    db: Annotated[Session, Depends(get_session)],
) -> RubricsListResponse:
    """Get rubrics list with hierarchical structure and permissions."""
    try:
        repo = get_rubric_repository(db)
        return repo.get_rubrics_list(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail", response_model=RubricDetailResponse)
async def get_rubric_detail(
    request: RubricDetailRequest,
    db: Annotated[Session, Depends(get_session)],
) -> RubricDetailResponse:
    """Get detailed rubric information."""
    try:
        repo = get_rubric_repository(db)
        return repo.get_rubric_detail(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail-default", response_model=RubricDetailResponse)
async def get_rubric_detail_default(
    request: RubricDetailDefaultRequest,
    db: Annotated[Session, Depends(get_session)],
) -> RubricDetailResponse:
    """Get default rubric details for a profile."""
    try:
        repo = get_rubric_repository(db)
        return repo.get_rubric_detail_default(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create", response_model=CreateRubricResponse)
async def create_rubric(
    request: CreateRubricRequest,
    db: Annotated[Session, Depends(get_session)],
) -> CreateRubricResponse:
    """Create a new rubric with nested structure."""
    try:
        repo = get_rubric_repository(db)
        return repo.create_rubric(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update", response_model=UpdateRubricResponse)
async def update_rubric(
    request: UpdateRubricRequest,
    db: Annotated[Session, Depends(get_session)],
) -> UpdateRubricResponse:
    """Update an existing rubric (replaces entire hierarchy)."""
    try:
        repo = get_rubric_repository(db)
        return repo.update_rubric(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/duplicate", response_model=DuplicateRubricResponse)
async def duplicate_rubric(
    request: DuplicateRubricRequest,
    db: Annotated[Session, Depends(get_session)],
) -> DuplicateRubricResponse:
    """Duplicate a rubric with entire hierarchy."""
    try:
        repo = get_rubric_repository(db)
        return repo.duplicate_rubric(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/delete", response_model=DeleteRubricResponse)
async def delete_rubric(
    request: DeleteRubricRequest,
    db: Annotated[Session, Depends(get_session)],
) -> DeleteRubricResponse:
    """Delete a rubric."""
    try:
        repo = get_rubric_repository(db)
        return repo.delete_rubric(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

