"""Cohorts v2 API endpoints."""

from typing import Annotated

from app.db import get_session
from app.repositories.cohort_repository import get_cohort_repository
from app.schemas.cohorts import (CohortDetailDefaultRequest,
                                 CohortDetailRequest, CohortDetailResponse,
                                 CohortsFilters, CohortsListResponse,
                                 CreateCohortRequest, CreateCohortResponse,
                                 DeleteCohortRequest, DeleteCohortResponse,
                                 DuplicateCohortRequest,
                                 DuplicateCohortResponse, LeaveCohortRequest,
                                 LeaveCohortResponse, UpdateCohortRequest,
                                 UpdateCohortResponse)
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

router = APIRouter(prefix="/cohorts", tags=["cohorts"])


@router.post("/list", response_model=CohortsListResponse)
async def get_cohorts_list(
    filters: CohortsFilters,
    db: Annotated[Session, Depends(get_session)],
) -> CohortsListResponse:
    """Get cohorts list with permissions and relationships."""
    try:
        repo = get_cohort_repository(db)
        return repo.get_cohorts_list(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail", response_model=CohortDetailResponse)
async def get_cohort_detail(
    request: CohortDetailRequest,
    db: Annotated[Session, Depends(get_session)],
) -> CohortDetailResponse:
    """Get detailed cohort information."""
    try:
        repo = get_cohort_repository(db)
        return repo.get_cohort_detail(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail-default", response_model=CohortDetailResponse)
async def get_cohort_detail_default(
    request: CohortDetailDefaultRequest,
    db: Annotated[Session, Depends(get_session)],
) -> CohortDetailResponse:
    """Get default cohort details for a profile."""
    try:
        repo = get_cohort_repository(db)
        return repo.get_cohort_detail_default(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create", response_model=CreateCohortResponse)
async def create_cohort(
    request: CreateCohortRequest,
    db: Annotated[Session, Depends(get_session)],
) -> CreateCohortResponse:
    """Create a new cohort."""
    try:
        repo = get_cohort_repository(db)
        return repo.create_cohort(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update", response_model=UpdateCohortResponse)
async def update_cohort(
    request: UpdateCohortRequest,
    db: Annotated[Session, Depends(get_session)],
) -> UpdateCohortResponse:
    """Update an existing cohort."""
    try:
        repo = get_cohort_repository(db)
        return repo.update_cohort(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/duplicate", response_model=DuplicateCohortResponse)
async def duplicate_cohort(
    request: DuplicateCohortRequest,
    db: Annotated[Session, Depends(get_session)],
) -> DuplicateCohortResponse:
    """Duplicate a cohort."""
    try:
        repo = get_cohort_repository(db)
        return repo.duplicate_cohort(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/delete", response_model=DeleteCohortResponse)
async def delete_cohort(
    request: DeleteCohortRequest,
    db: Annotated[Session, Depends(get_session)],
) -> DeleteCohortResponse:
    """Delete a cohort."""
    try:
        repo = get_cohort_repository(db)
        return repo.delete_cohort(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/leave", response_model=LeaveCohortResponse)
async def leave_cohort(
    request: LeaveCohortRequest,
    db: Annotated[Session, Depends(get_session)],
) -> LeaveCohortResponse:
    """Leave a cohort."""
    try:
        repo = get_cohort_repository(db)
        return repo.leave_cohort(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

