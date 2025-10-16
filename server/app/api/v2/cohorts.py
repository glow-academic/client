"""Cohorts v2 API endpoints."""

from typing import Annotated

from app.db import get_db
from app.repositories.cohort_repository import get_cohort_repository
from app.schemas.cohorts import (AddProfilesToCohortRequest,
                                 AddProfilesToCohortResponse,
                                 CohortDetailDefaultRequest,
                                 CohortDetailRequest, CohortDetailResponse,
                                 CohortDetailWithProfilesRequest,
                                 CohortDetailWithProfilesResponse,
                                 CohortsFilters, CohortsListResponse,
                                 CreateCohortRequest, CreateCohortResponse,
                                 DeleteCohortRequest, DeleteCohortResponse,
                                 DuplicateCohortRequest,
                                 DuplicateCohortResponse, LeaveCohortRequest,
                                 LeaveCohortResponse,
                                 RemoveProfilesFromCohortRequest,
                                 RemoveProfilesFromCohortResponse,
                                 UpdateCohortRequest, UpdateCohortResponse)
from fastapi import APIRouter, Depends, HTTPException
import asyncpg  # type: ignore

router = APIRouter(prefix="/cohorts", tags=["cohorts"])


@router.post("/list", response_model=CohortsListResponse)
async def get_cohorts_list(
    filters: CohortsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CohortsListResponse:
    """Get cohorts list with permissions and relationships."""
    try:
        repo = get_cohort_repository(conn)
        return await repo.get_cohorts_list(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail", response_model=CohortDetailResponse)
async def get_cohort_detail(
    request: CohortDetailRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CohortDetailResponse:
    """Get detailed cohort information."""
    try:
        repo = get_cohort_repository(conn)
        return await repo.get_cohort_detail(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail-default", response_model=CohortDetailResponse)
async def get_cohort_detail_default(
    request: CohortDetailDefaultRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CohortDetailResponse:
    """Get default cohort details for a profile."""
    try:
        repo = get_cohort_repository(conn)
        return await repo.get_cohort_detail_default(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail-with-profiles", response_model=CohortDetailWithProfilesResponse)
async def get_cohort_detail_with_profiles(
    request: CohortDetailWithProfilesRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CohortDetailWithProfilesResponse:
    """Get cohort detail with available profiles in one call."""
    try:
        repo = get_cohort_repository(conn)
        return await repo.get_cohort_detail_with_profiles(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create", response_model=CreateCohortResponse)
async def create_cohort(
    request: CreateCohortRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateCohortResponse:
    """Create a new cohort."""
    try:
        repo = get_cohort_repository(conn)
        return await repo.create_cohort(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update", response_model=UpdateCohortResponse)
async def update_cohort(
    request: UpdateCohortRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateCohortResponse:
    """Update an existing cohort."""
    try:
        repo = get_cohort_repository(conn)
        return await repo.update_cohort(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/duplicate", response_model=DuplicateCohortResponse)
async def duplicate_cohort(
    request: DuplicateCohortRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateCohortResponse:
    """Duplicate a cohort."""
    try:
        repo = get_cohort_repository(conn)
        return await repo.duplicate_cohort(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/delete", response_model=DeleteCohortResponse)
async def delete_cohort(
    request: DeleteCohortRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteCohortResponse:
    """Delete a cohort."""
    try:
        repo = get_cohort_repository(conn)
        return await repo.delete_cohort(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/leave", response_model=LeaveCohortResponse)
async def leave_cohort(
    request: LeaveCohortRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> LeaveCohortResponse:
    """Leave a cohort."""
    try:
        repo = get_cohort_repository(conn)
        return await repo.leave_cohort(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/add-profiles", response_model=AddProfilesToCohortResponse)
async def add_profiles_to_cohort(
    request: AddProfilesToCohortRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> AddProfilesToCohortResponse:
    """Add profiles to a cohort."""
    try:
        repo = get_cohort_repository(conn)
        return await repo.add_profiles_to_cohort(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/remove-profiles", response_model=RemoveProfilesFromCohortResponse)
async def remove_profiles_from_cohort(
    request: RemoveProfilesFromCohortRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RemoveProfilesFromCohortResponse:
    """Remove profiles from a cohort."""
    try:
        repo = get_cohort_repository(conn)
        return await repo.remove_profiles_from_cohort(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

